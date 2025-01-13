import dotenv from 'dotenv';
dotenv.config();

import { Connection, Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import { decodeUTF8 } from "tweetnacl-util";
import axios from 'axios';
import { randomIntFromInterval } from '../utils/utils';
import { insert_user_inventory } from '../db';
(async () => {
    let generated_users = true;
    let generated_resources = true;
    if (generated_users) {
        for (let i = 0; i < 100; i++) {
            let username = `Username${i + 1}`
            const keypair = Keypair.generate();
            const {
                data: { data: { address, nonce } }
            } = await axios.post(`http://localhost:${process.env.PORT}/oauth/nonce`, {
                address: keypair.publicKey.toString()
            });

            const messageBytes = decodeUTF8(nonce);
            const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
            let payload = {
                address: keypair.publicKey.toString(),
                nonce,
                signature: Array.from(signature),
                username
            };
            const {
                data
            } = await axios.post(`http://localhost:${process.env.PORT}/oauth/register`, payload);
            console.log(data)
        }
    }

    if (generated_resources) {
        let connection = new Connection(process.env.NODE_SOLANA_HTTP!, {
            wsEndpoint: process.env.NODE_SOLANA_WS!,
            commitment: 'confirmed'
        });
        let epoch = (await connection.getEpochInfo()).epoch;

        for (let i = 1; i <= 1; i++) {
            for (let j = 0; j < 50; j++) {
                let object_id = randomIntFromInterval(1, 3);
                let contributed = randomIntFromInterval(1, 100) > 50;
                let res = await insert_user_inventory(i, object_id, contributed, contributed ? epoch : undefined, contributed ? new Date() : undefined);
                console.log(res);
            }
        }
    }
    process.exit(1);
})()