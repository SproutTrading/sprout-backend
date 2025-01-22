import dotenv from 'dotenv';
dotenv.config();

import { searcherClient } from 'jito-ts/dist/sdk/block-engine/searcher';
import { Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { Bundle } from 'jito-ts/dist/sdk/block-engine/types';
import { VersionedTransaction } from '@solana/web3.js';
import { update_pumpfun_contract_launch } from '../../db';
import { logDetails } from '../../utils/utils';

(async () => {
    process.on('message', async (incoming: string) => {
        let config: { id: number, address: string, name: string, symbol: string, instructions: any[] } = JSON.parse(incoming);
        const keypair = Keypair.fromSecretKey(bs58.decode(process.env.JITO_KEYPAIR!));
        const jitoClient = searcherClient(process.env.JITO_ENDPOINT!, keypair);
        const versionedTxs = config.instructions.map(instructions => VersionedTransaction.deserialize(instructions));
        const bundle = new Bundle(versionedTxs, 5);
        const bundle_response = await jitoClient.sendBundle(bundle);
        if (!bundle_response.ok) {
            process.send!(JSON.stringify({
                ok: false,
                message: `Error occured while deploying`
            }));
            return;
        }
        let checked = false;
        jitoClient.onBundleResult(
            async result => {
                logDetails(JSON.stringify(result))
                if (!checked && (result.accepted || result.processed)) {
                    checked = true;
                    process.send!(JSON.stringify({
                        ok: true,
                        message: `Successfully launched ${config.name} (${config.symbol})!`,
                        address: config.address,
                        name: config.name,
                        symbol: config.symbol,
                        signature
                    }));
                    await update_pumpfun_contract_launch(config.id, true);
                    process.exit(1);
                }
            },
            e => {
                process.send!(JSON.stringify({
                    ok: false,
                    message: `Bundle result error: ${e.message}`
                }));
                throw e;
            }
        );

        const connection = new Connection(process.env.NODE_SOLANA_HTTP!, "confirmed");
        const signature = bs58.encode(versionedTxs[0].signatures[0]);
        setInterval(async () => {
            let tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
            if (tx && tx.slot) {
                await update_pumpfun_contract_launch(config.id, true);
                process.send!(JSON.stringify({
                    ok: true,
                    message: `Successfully launched ${config.name} (${config.symbol})!`,
                    address: config.address,
                    name: config.name,
                    symbol: config.symbol,
                    signature
                }));
                process.exit(1);
            }
        }, 500);

        /**
         * Force client to exit in case no transaction was processed or accepted
         */
        setTimeout(() => {
            process.send!(JSON.stringify({
                ok: false,
                message: `Failed to confirm transaction`
            }));
            process.exit(1);
        }, 30 * 1000);
    });
})();