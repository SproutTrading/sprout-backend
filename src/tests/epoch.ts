import dotenv from 'dotenv';
dotenv.config();

import { Connection } from "@solana/web3.js";

(async () => {
    let connection = new Connection(process.env.NODE_SOLANA_HTTP!, {
        wsEndpoint: process.env.NODE_SOLANA_WS!,
        commitment: 'confirmed'
    });
    {
        let epoch = await connection.getEpochInfo();
        console.log(epoch);
    }
})();