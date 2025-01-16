import dotenv from 'dotenv';
dotenv.config();

import { PublicKey } from "@solana/web3.js";
import { mplTokenMetadata, fetchDigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import axios from 'axios';

export async function getTokenData(mint: string, retrieveIpfs = false) {
    try {
        let { data: { data: tokenData, success } }: any = await axios.get(`https://pro-api.solscan.io/v2.0/token/meta?address=${mint}`, {
            headers: {
                "token": process.env.SOLSCAN_API_KEY!
            }
        });

        let ipfs_data = null;
        if (success && retrieveIpfs) {
            const umi = createUmi(process.env.NODE_SOLANA_HTTP!).use(mplTokenMetadata())
            const asset = await fetchDigitalAsset(umi, new PublicKey(mint) as any);
            let ipfs_response = await fetch(asset.metadata.uri);
            ipfs_data = await ipfs_response.json();
        }

        return {
            ipfs: ipfs_data,
            token: tokenData
        }
    } catch (err) {
        return null;
    }
}