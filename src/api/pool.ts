import dotenv, { config } from 'dotenv';
dotenv.config();

import { LIQUIDITY_STATE_LAYOUT_V4, Liquidity, LiquidityPoolKeys, LiquidityPoolKeysV4, MARKET_STATE_LAYOUT_V3, Market } from "@raydium-io/raydium-sdk";
import { AccountInfo, Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { isFulfilled } from "../utils/utils";
import { PumpfunToken } from './pumpfun/pumpfun_instructions';
import { Keypair } from '@solana/web3.js';
import { calculateWithSlippageBuy } from './pumpfun_builder';
import { getGlobalAccount } from './pumpfun/globalAccount';
import { buyRaydium } from './raydium/raydium_instructions';
import { TransactionInstruction } from '@solana/web3.js';

export const SOLANA_TIP_ACCOUNTS = [
    "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
    "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
    "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
    "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
    "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
    "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
    "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
    "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT"
].map(x => new PublicKey(x));

const RAYDIUM_LIQUIDITY_POOL_V4_ADDRESS = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');

export type SolanaPool = {
    id: string | null,
    quoteMint: string,
    baseMint: string,
    quoteDecimals: number,
    baseDecimals: number,
    solBalance: number,
    tokensBalance: number,
    price: number,
    poolKeys: LiquidityPoolKeysV4 | null,
    type: 'pumpfun' | 'raydium',
    complete: boolean
}

async function getRaydiumLiquidityPools(connection: Connection, baseMint: string, quoteMint: string) {
    const layout = LIQUIDITY_STATE_LAYOUT_V4;
    return connection.getProgramAccounts(new PublicKey(RAYDIUM_LIQUIDITY_POOL_V4_ADDRESS), {
        filters: [
            { dataSize: layout.span },
            {
                memcmp: {
                    offset: layout.offsetOf('baseMint'),
                    bytes: new PublicKey(baseMint).toBase58(),
                },
            },
            {
                memcmp: {
                    offset: layout.offsetOf('quoteMint'),
                    bytes: new PublicKey(quoteMint).toBase58(),
                },
            },
        ],
    })
}

export async function getSolanaOptimalPool(connection: Connection, token: string) {
    let quoteMint = new PublicKey(`So11111111111111111111111111111111111111112`);
    let data: SolanaPool[] = [];

    try {
        let pumpfunToken = new PumpfunToken(Keypair.generate());
        let bondingCurveAccount = await pumpfunToken.getBondingCurveAccount(new PublicKey(token));

        if (bondingCurveAccount) {
            let price = 0;
            try {
                price = Number(bondingCurveAccount.getSellPrice(BigInt(1 * 1e6), BigInt(0))) / LAMPORTS_PER_SOL;
            } catch (err) {
            }
            data.push({
                id: null,
                quoteMint: quoteMint.toString(),
                baseMint: new PublicKey(token).toString(),
                quoteDecimals: 9,
                baseDecimals: 6,
                solBalance: 0,
                tokensBalance: 0,
                price,
                poolKeys: null,
                type: 'pumpfun',
                complete: bondingCurveAccount.complete
            })
        }
    } catch (err) {
        console.log(`Error retrieve pumpfun token data for ${token}: ${err}`)
    }

    let pools: {
        account: AccountInfo<Buffer>;
        pubkey: PublicKey;
    }[] = (await Promise.allSettled([
        getRaydiumLiquidityPools(connection, quoteMint.toString(), token.toString()),
        getRaydiumLiquidityPools(connection, token.toString(), quoteMint.toString())
    ])).filter(isFulfilled).map(x => x.value).flat();

    for (let pool of pools) {
        let poolData = LIQUIDITY_STATE_LAYOUT_V4.decode(pool.account.data);
        let baseVaultBalance = 0;
        let quoteVaultBalance = 0;
        {
            const _balance = await connection.getTokenAccountBalance(poolData.baseVault);
            baseVaultBalance = parseFloat(_balance.value.amount) / Math.pow(10, poolData.baseDecimal.toNumber());
        }

        {
            const _balance = await connection.getTokenAccountBalance(poolData.quoteVault);
            quoteVaultBalance = parseFloat(_balance.value.amount) / Math.pow(10, poolData.quoteDecimal.toNumber());
        }

        let price = poolData.baseMint.equals(quoteMint) ? baseVaultBalance / quoteVaultBalance : quoteVaultBalance / baseVaultBalance;

        const market = await connection.getAccountInfo(poolData.marketId).then((item) => ({
            programId: item!.owner,
            ...MARKET_STATE_LAYOUT_V3.decode(item!.data),
        }))

        const authority = Liquidity.getAssociatedAuthority({
            programId: new PublicKey(RAYDIUM_LIQUIDITY_POOL_V4_ADDRESS),
        }).publicKey

        const marketProgramId = market.programId

        const poolKeys = {
            id: pool.pubkey,
            baseMint: poolData.baseMint,
            quoteMint: poolData.quoteMint,
            lpMint: poolData.lpMint,
            baseDecimals: Number.parseInt(poolData.baseDecimal.toString()),
            quoteDecimals: Number.parseInt(poolData.quoteDecimal.toString()),
            lpDecimals: Number.parseInt(poolData.baseDecimal.toString()),
            version: 4,
            programId: new PublicKey(RAYDIUM_LIQUIDITY_POOL_V4_ADDRESS),
            openOrders: poolData.openOrders,
            targetOrders: poolData.targetOrders,
            baseVault: poolData.baseVault,
            quoteVault: poolData.quoteVault,
            marketVersion: 3,
            authority: authority,
            marketProgramId,
            marketId: market.ownAddress,
            marketAuthority: Market.getAssociatedAuthority({
                programId: marketProgramId,
                marketId: market.ownAddress,
            }).publicKey,
            marketBaseVault: market.baseVault,
            marketQuoteVault: market.quoteVault,
            marketBids: market.bids,
            marketAsks: market.asks,
            marketEventQueue: market.eventQueue,
            withdrawQueue: poolData.withdrawQueue,
            lpVault: poolData.lpVault,
            lookupTableAccount: PublicKey.default,
        } as LiquidityPoolKeys;

        data.push({
            id: pool.pubkey.toString(),
            quoteMint: poolData.quoteMint.toString(),
            baseMint: poolData.baseMint.toString(),
            quoteDecimals: poolData.quoteDecimal.toNumber(),
            baseDecimals: poolData.baseDecimal.toNumber(),
            solBalance: poolData.baseMint.equals(quoteMint) ? baseVaultBalance : quoteVaultBalance,
            tokensBalance: !poolData.baseMint.equals(quoteMint) ? baseVaultBalance : quoteVaultBalance,
            price,
            poolKeys,
            type: 'raydium',
            complete: true
        })
    }
    let max;
    if (data.length > 0) {
        let pumpfunIncomplete = data.find(x => x.type === 'pumpfun' && !x.complete);
        if (pumpfunIncomplete) {
            return pumpfunIncomplete;
        }
        let nonPumpFunData = data.filter(x => x.type === 'raydium');
        if (nonPumpFunData.length > 0) {
            max = data.reduce(function (prev, current) {
                return (prev && prev.solBalance > current.solBalance) ? prev : current
            })
        }
    }
    return max;
}

export async function routeBuy(connection: Connection, buyer: string, token: string, value: number, tip: number) {
    let optimalPool = await getSolanaOptimalPool(connection, token);
    if (!optimalPool) {
        throw new Error(`No pool found for ${token}!`);
    }

    let buy_instructions: TransactionInstruction[] = [];
    if (optimalPool.type === 'pumpfun') {
        let slippageBasisPoints: bigint = 500n;
        let mint = new PublicKey(token);
        let pumpfunToken = new PumpfunToken(Keypair.generate());
        let bondingCurveAccount = await pumpfunToken.getBondingCurveAccount(mint);
        if (!bondingCurveAccount) {
            throw new Error(`Bonding curve account not found: ${mint.toBase58()}`);
        }

        let solValue = BigInt(Math.floor(value * LAMPORTS_PER_SOL));
        let buyAmount = bondingCurveAccount.getBuyPrice(solValue);
        let solAmount = calculateWithSlippageBuy(solValue, slippageBasisPoints);

        let globalAccount = await getGlobalAccount(connection);

        let instructions = await pumpfunToken.getBuyInstructions(
            new PublicKey(buyer),
            new PublicKey(buyer),
            mint,
            globalAccount.feeRecipient,
            buyAmount,
            solAmount
        );
        buy_instructions = instructions;
    } else {
        let { instructions } = await buyRaydium(connection, new PublicKey(buyer), new PublicKey(buyer), value, token, optimalPool);
        buy_instructions = instructions;
    }

    buy_instructions = [
        ...buy_instructions,
        SystemProgram.transfer({
            fromPubkey: new PublicKey(buyer),
            toPubkey: new PublicKey(SOLANA_TIP_ACCOUNTS[0]),
            lamports: Math.floor(tip * LAMPORTS_PER_SOL),
        })
    ];

    return buy_instructions
}