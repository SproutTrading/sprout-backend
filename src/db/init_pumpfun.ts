import { insert_pumpfun_wallet } from ".";
import { db_pool } from "../constants";
import fs from 'fs/promises';
(async () => {
    try {
        const connected = await db_pool.connect();
        let path = `./src/wallets.json`;
        let wallets = JSON.parse(await fs.readFile(path, 'utf-8'));
        for await (let wallet of wallets) {
            let added = await insert_pumpfun_wallet(wallet.public, wallet.private);
            console.log(added)
        }
        await db_pool.end();
        process.exit(1);
    } catch (err) {
        console.log(`Failed to connect: ${err}`);
    }
})()

