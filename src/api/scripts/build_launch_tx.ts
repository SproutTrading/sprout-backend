import dotenv from 'dotenv';
dotenv.config();

import bs58 from 'bs58';
import { PublicKey, SystemProgram, Keypair, TransactionInstruction, LAMPORTS_PER_SOL, VersionedTransaction, TransactionMessage, Connection, Transaction } from "@solana/web3.js";
import { searcherClient } from 'jito-ts/dist/sdk/block-engine/searcher';
import { PumpfunIpfsResponse } from '../../models/pumpfun.model';
import { PumpfunToken } from './../pumpfun/pumpfun_instructions';
import { buyRaydium } from './../raydium/raydium_instructions';
import { getGlobalAccount } from './../pumpfun/globalAccount';
import { fetchSolanaPrice } from './../coingecko';
import { get_pumpfun_contract, update_pumpfun_contract_user } from '../../db';
import { fork } from 'node:child_process';

export type PumpfunPayload = {
    launchMethod: string,
    id: number,
    name: string,
    symbol: string,
    description: string,
    image: string,
    telegram: string,
    website: string,
    twitter: string,
    tip: string,
    value: string,
    public_key: string | null,
    private_key: string | null,
}

export const calculateWithSlippageBuy = (amount: bigint, basisPoints: bigint) => {
    return amount + (amount * basisPoints) / 10000n;
};

export async function uploadToPumpfun(config: PumpfunPayload): Promise<PumpfunIpfsResponse> {
    let imgfetched = await fetch(config.image);
    let blob = await imgfetched.blob();

    let formData = new FormData();
    formData.append("file", blob);
    formData.append("name", config.name);
    formData.append("symbol", config.symbol);
    formData.append("description", config.description);
    formData.append("twitter", config.twitter || "");
    formData.append("telegram", config.telegram || "");
    formData.append("website", config.website || "");
    formData.append("showName", "true");
    formData.append("createdOn", "https://pump.fun");
    let request = await fetch("https://pump.fun/api/ipfs", {
        method: "POST",
        body: formData,
    });
    let response = await request.json();
    return response as PumpfunIpfsResponse;
}

(async () => {
    process.on('message', async (incoming: string) => {
        let config: PumpfunPayload = JSON.parse(incoming);
        const keypair = Keypair.fromSecretKey(bs58.decode(process.env.JITO_KEYPAIR!));
        const jitoClient = searcherClient(process.env.JITO_ENDPOINT!, keypair);
        let tipAccounts = await jitoClient.getTipAccounts();
        if (!tipAccounts.ok) {
            process.send!(JSON.stringify({
                ok: false,
                message: `Error fetching tip accounts: ${tipAccounts.error}`
            }));
            return;
        }

        let price = await fetchSolanaPrice();
        let sproutCollector = Keypair.fromSecretKey(bs58.decode(process.env.SPROUT_COLLECTOR!));
        const connection = new Connection(process.env.NODE_SOLANA_HTTP!, "confirmed");

        let pumpfunResponse = await uploadToPumpfun(config);
        let metadata_uri = pumpfunResponse.metadataUri;

        let deployerPublicKey: PublicKey;
        if (config.launchMethod === 'wallet') {
            deployerPublicKey = new PublicKey(config.public_key!);
        } else {
            deployerPublicKey = Keypair.fromSecretKey(bs58.decode(config.private_key!)).publicKey;
        }

        let createTokenInstructions: TransactionInstruction[] = [];
        let buySproutTokenInstructions = await buyRaydium(connection, deployerPublicKey, sproutCollector.publicKey, +(+process.env.SPROUT_BUYS_USD! / price).toFixed(9), process.env.TOKEN_ADDRESS!);
        process.send!(JSON.stringify({
            ok: true,
            message: `Purchasing $25 worth of Sprout v1 tokens...`
        }));

        let pumpfun_contract: { id: number, public_key: string, private_key: string } = await get_pumpfun_contract();
        if (!pumpfun_contract) {
            process.send!(JSON.stringify({
                ok: false,
                message: `No pumpfun key found...`
            }));
        }

        await update_pumpfun_contract_user(pumpfun_contract.id, config.id);

        const mint = Keypair.fromSecretKey(bs58.decode(pumpfun_contract.private_key));
        {
            let pumpfunToken = new PumpfunToken(mint);
            let instructions = await pumpfunToken.getCreateInstructions(deployerPublicKey, config.name, config.symbol, metadata_uri);
            createTokenInstructions.push(instructions);
            const tipIx = SystemProgram.transfer({
                fromPubkey: deployerPublicKey,
                toPubkey: new PublicKey(tipAccounts.value[0]),
                lamports: +config.tip * LAMPORTS_PER_SOL,
            });
            createTokenInstructions.push(tipIx);

            let devBuyValue = config.value && !isNaN(+config.value) ? Math.floor(+config.value * LAMPORTS_PER_SOL) : 0;
            const globalAccount = await getGlobalAccount(connection);
            {
                let tokens = BigInt(parseInt(globalAccount.tokenTotalSupply.toString()) * 0.005);
                let solValue = globalAccount.getBuyPriceSol(tokens);
                const solValueSlippage = calculateWithSlippageBuy(solValue, 500n);

                console.log(`${Number(solValueSlippage) / LAMPORTS_PER_SOL} -> ${tokens.toString()}`)

                const buyTx = await pumpfunToken.getBuyInstructions(
                    deployerPublicKey,
                    sproutCollector.publicKey,
                    mint.publicKey,
                    globalAccount.feeRecipient,
                    tokens,
                    solValueSlippage
                );

                globalAccount.adjustTokensBalance(solValueSlippage, tokens);
                createTokenInstructions = [...createTokenInstructions, ...buyTx];
                process.send!(JSON.stringify({
                    ok: true,
                    message: `Allocating 0.5% token supply to collector wallet...`
                }));
            }

            if (devBuyValue > 0) {
                {
                    const buyAmount = globalAccount.getInitialBuyPrice(BigInt(devBuyValue));
                    const buyAmountWithSlippage = calculateWithSlippageBuy(BigInt(devBuyValue), 500n);
                    console.log(`${Number(buyAmountWithSlippage) / LAMPORTS_PER_SOL} -> ${buyAmount.toString()}`)

                    const buyTx = await pumpfunToken.getBuyInstructions(
                        deployerPublicKey,
                        deployerPublicKey,
                        mint.publicKey,
                        globalAccount.feeRecipient,
                        buyAmount,
                        buyAmountWithSlippage
                    );

                    createTokenInstructions = [...createTokenInstructions, ...buyTx];
                }
            }
        }

        const recentBlockhashForSwap = await connection.getLatestBlockhash();
        const devTx = new VersionedTransaction(
            new TransactionMessage({
                payerKey: new PublicKey(deployerPublicKey),
                recentBlockhash: recentBlockhashForSwap.blockhash,
                instructions: createTokenInstructions,

            }).compileToV0Message()
        );
        devTx.sign([mint]);

        const buySproutTx = new VersionedTransaction(
            new TransactionMessage({
                payerKey: new PublicKey(deployerPublicKey),
                recentBlockhash: recentBlockhashForSwap.blockhash,
                instructions: buySproutTokenInstructions.instructions,

            }).compileToV0Message()
        );
        buySproutTx.sign([sproutCollector]);

        if (config.launchMethod === 'wallet') {
            process.send!(JSON.stringify({
                ok: true,
                message: `Deploying ${config.name}..`,
                id: pumpfun_contract.id,
                address: mint.publicKey.toString(),
                name: config.name,
                symbol: config.symbol,
                instructions: [
                    Array.from(devTx.serialize()),
                    Array.from(buySproutTx.serialize())
                ]
            }));
            process.exit(1);
        } else {
            let deployerKp = Keypair.fromSecretKey(bs58.decode(config.private_key!));
            devTx.sign([deployerKp]);
            buySproutTx.sign([deployerKp]);
            process.send!(JSON.stringify({
                ok: true,
                message: `Deploying ${config.name}..`,
                id: pumpfun_contract.id,
                address: mint.publicKey.toString(),
                name: config.name,
                symbol: config.symbol
            }));

            var child = fork('dist/api/scripts/send_jito_launch_bundle.js');
            child.send(JSON.stringify({
                id: pumpfun_contract.id,
                address: mint.publicKey.toString(),
                name: config.name,
                symbol: config.symbol,
                instructions: [
                    Array.from(devTx.serialize()),
                    Array.from(buySproutTx.serialize())
                ]
            }));

            child.on('data', async (data: any) => {
                console.log(data.toString());
            });
            child.on('message', async (data: string) => {
                process.send!(data);
            });
            child.on('exit', async (code: any) => {
                console.log(`Jito launch bundle (build launch) processor exited ${code}`);
                process.exit(1);
            });
        }
    });
})();