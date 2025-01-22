import dotenv from 'dotenv';
dotenv.config();

import { searcherClient } from 'jito-ts/dist/sdk/block-engine/searcher';
import { Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { Bundle } from 'jito-ts/dist/sdk/block-engine/types';
import { VersionedTransaction } from '@solana/web3.js';

(async () => {
    process.on('message', async (incoming: string) => {
        let config: { total: number, symbol: string, instructions: any } = JSON.parse(incoming);
        const keypair = Keypair.fromSecretKey(bs58.decode(process.env.JITO_KEYPAIR!));
        const jitoClient = searcherClient(process.env.JITO_ENDPOINT!, keypair);
        const versionedTx = VersionedTransaction.deserialize(config.instructions);

        const bundle = new Bundle([versionedTx], 5);
        const bundle_response = await jitoClient.sendBundle(bundle);
        if (!bundle_response.ok) {
            process.send!(JSON.stringify({
                pending: false,
                ok: false,
                message: `Error occured while sending buy transaction`
            }));
            process.exit(1);
        }

        let checked = false;
        jitoClient.onBundleResult(
            async result => {
                if (!checked && (result.accepted || result.processed)) {
                    process.send!(JSON.stringify({
                        pending: false,
                        ok: true,
                        message: `Successfully purchased ${config.symbol} for ${config.total} SOL total! Transaction confirmed.`
                    }));

                    checked = true;
                    process.exit(1);
                }
            }, e => {
                process.send!(JSON.stringify({
                    pending: false,
                    ok: false,
                    message: e.message
                }));
                throw e.message;
            });

        /**
         * Jito client might disconnect suddenly due to network outage
         * Added manual checking by looping every 400ms
         */
        const signature = bs58.encode(versionedTx.signatures[0]);
        const connection = new Connection(process.env.NODE_SOLANA_HTTP!, "confirmed");
        setInterval(async () => {
            let tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
            if (tx && tx.slot) {
                process.send!(JSON.stringify({
                    pending: false,
                    ok: true,
                    message: `Successfully purchased ${config.symbol} for ${config.total} SOL total! Transaction confirmed.`
                }));
                process.exit(1);
            }
        }, 400);

        /**
         * Force client to exit in case no transaction was processed or accepted
         */
        setTimeout(() => {
            process.send!(JSON.stringify({
                pending: false,
                ok: false,
                message: `Failed to confirm transaction`
            }));
            process.exit(1);
        }, 30 * 1000);
    });
})();