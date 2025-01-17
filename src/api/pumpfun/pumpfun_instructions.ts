import dotenv from 'dotenv';
dotenv.config();

import { AnchorProvider, BN, Program } from '@coral-xyz/anchor';
import { PumpFun } from './idl/pumpfun';
import { default as IDL } from "./idl/pumpfun.json";
import { createAssociatedTokenAccountInstruction, getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import { PublicKey, Keypair, Connection, Commitment, Transaction, Finality } from '@solana/web3.js';
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet';
import { BondingCurveAccount } from './bondingCurve';

const MPL_TOKEN_METADATA_PROGRAM_ID = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
const METADATA_SEED = "metadata";
const BONDING_CURVE_SEED = "bonding-curve";

export class PumpfunToken {
    public program: Program<PumpFun>;
    public connection: Connection;
    constructor(private mint: Keypair) {
        let wallet = new NodeWallet(new Keypair());
        this.connection = new Connection(process.env.NODE_SOLANA_HTTP!);
        const provider = new AnchorProvider(this.connection, wallet, {
            commitment: "finalized",
        });
        this.program = new Program<PumpFun>(IDL as PumpFun, provider);
    }

    getBondingCurvePDA(mint: PublicKey) {
        return PublicKey.findProgramAddressSync([Buffer.from(BONDING_CURVE_SEED), mint.toBuffer()], this.program.programId)[0];
    }

    async getBondingCurveAccount(mint: PublicKey) {
        const tokenAccount = await this.connection.getAccountInfo(
            this.getBondingCurvePDA(mint),
            'finalized'
        );
        if (!tokenAccount) {
            return null;
        }
        return BondingCurveAccount.fromBuffer(tokenAccount!.data);
    }

    async getCreateInstructions(creator: PublicKey, name: string, symbol: string, uri: string) {
        const mplTokenMetadata = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID);
        const [metadataPDA] = PublicKey.findProgramAddressSync(
            [
                Buffer.from(METADATA_SEED),
                mplTokenMetadata.toBuffer(),
                this.mint.publicKey.toBuffer(),
            ],
            mplTokenMetadata
        );

        const associatedBondingCurve = await getAssociatedTokenAddress(
            this.mint.publicKey,
            this.getBondingCurvePDA(this.mint.publicKey),
            true
        );

        return this.program.methods
            .create(name, symbol, uri)
            .accounts({
                mint: this.mint.publicKey,
                associatedBondingCurve: associatedBondingCurve,
                metadata: metadataPDA,
                user: creator,
            })
            .signers([this.mint])
            .instruction()
    }


    async getBuyInstructions(
        payer: PublicKey,
        buyer: PublicKey,
        mint: PublicKey,
        feeRecipient: PublicKey,
        amount: bigint,
        solAmount: bigint
    ) {
        const associatedBondingCurve = await getAssociatedTokenAddress(
            mint,
            this.getBondingCurvePDA(mint),
            true
        );

        const associatedUser = await getAssociatedTokenAddress(mint, buyer, false);

        let transaction = new Transaction();
        try {
            await getAccount(this.connection, associatedUser, 'finalized');
        } catch (e) {
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    payer,
                    associatedUser,
                    buyer,
                    mint
                )
            );
        }
        transaction.add(
            await this.program.methods
                .buy(new BN(amount.toString()), new BN(solAmount.toString()))
                .accounts({
                    feeRecipient: feeRecipient,
                    mint: mint,
                    associatedBondingCurve: associatedBondingCurve,
                    associatedUser: associatedUser,
                    user: payer,
                })
                .transaction()
        );

        return transaction.instructions;
    }
}

