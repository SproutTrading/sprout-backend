import dotenv from 'dotenv';
dotenv.config();

import bs58 from 'bs58';
import { PublicKey, SystemProgram, Keypair, TransactionInstruction, LAMPORTS_PER_SOL, VersionedTransaction, TransactionMessage, Connection } from "@solana/web3.js";
import { searcherClient } from 'jito-ts/dist/sdk/block-engine/searcher';
import { Bundle } from 'jito-ts/dist/sdk/block-engine/types';
import { PumpfunIpfsResponse } from "../models/pumpfun.model";
import { PumpfunToken } from './pumpfun/pumpfun_instructions';
import { buyRaydium } from './raydium/raydium_instructions';
import { getGlobalAccount } from './pumpfun/globalAccount';
import { fetchSolanaPrice } from './coingecko';
import { get_pumpfun_contract, update_pumpfun_contract_launch, update_pumpfun_contract_user } from '../db';

export type PumpfunPayload = {
    id: number,
    name: string,
    symbol: string,
    description: string,
    image: string,
    telegram: string,
    website: string,
    twitter: string,
    private_key: string,
    tip: string,
    value: string
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
    });
})();