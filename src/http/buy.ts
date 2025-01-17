import dotenv from 'dotenv';
dotenv.config();

import { Request, Response } from 'express';
import { build_response } from '../utils/http_helper';
import { checkField, logDetails } from '../utils/utils';
import { get_pumpfun_contract_by_id } from '../db';
import { routeBuy } from '../api/pool';
import { Connection, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import { fork } from 'child_process';
import io_instance from '../websocket';

export const requestTokenInstructions = async (req: Request, res: Response) => {
    let user_id = res.locals['authorizedUser'].id;
    try {
        let { symbol, tokenId, value, tip, address } = req.body;
        checkField(tip, "Tip is missing");
        checkField(value, "Value is missing");
        let current_tip = +tip;
        let current_value = +value;
        if (isNaN(tokenId) || tokenId < 1) {
            throw new Error("Wrong token id!");
        }
        if (isNaN(current_tip)) {
            throw new Error("Invalid tip amount");
        }
        if (isNaN(current_value)) {
            throw new Error("Invalid value");
        }
        if (current_tip <= 0) {
            throw new Error("Tip cannot be zero or negative");
        }
        if (current_value <= 0) {
            throw new Error("Value cannot be zero or negative");
        }
        if (current_tip > 0.05) {
            throw new Error("Tip cannot exceed 0.05 SOL");
        }

        let foundContract = await get_pumpfun_contract_by_id(tokenId);
        if (!foundContract) {
            throw new Error("Pumpfun contract not found!");
        }
        io_instance.to(`room_${user_id}`).emit('buyTx', {
            pending: true,
            message: `Processing purchase of ${symbol} for ${value} SOL (${tip} SOL tip)...`,
            ok: true,
        });
        const connection = new Connection(process.env.NODE_SOLANA_HTTP!, "confirmed");
        let instructions = await routeBuy(connection, address, foundContract.public_key, current_value, current_tip)
        const recentBlockhashForSwap = await connection.getLatestBlockhash();
        const versionedTx = new VersionedTransaction(
            new TransactionMessage({
                payerKey: new PublicKey(address),
                recentBlockhash: recentBlockhashForSwap.blockhash,
                instructions,

            }).compileToV0Message()
        );
        return res.status(200).json(build_response(true, {
            instructions: Array.from(versionedTx.serialize())
        }));
    } catch (err) {
        io_instance.to(`room_${user_id}`).emit('buyTx', {
            pending: false,
            message: err,
            ok: false
        });
        logDetails(`Error requesting token instructions: ${err}`);
        return res.status(200).json(build_response(false, null, err as string));
    }
}

export const processTokenInstructions = async (req: Request, res: Response) => {
    let user_id = res.locals['authorizedUser'].id;
    try {
        let { total, symbol, instructions } = req.body;
        checkField(total, "Total is missing");
        checkField(symbol, "Symbol is missing");
        checkField(instructions, "Transaction instructions are missing");

        var child = fork('dist/api/scripts/send_jito_bundle.js');
        child.send(JSON.stringify({
            total,
            symbol,
            instructions
        }));
        child.on('data', async (data: any) => {
            console.log(data.toString());
        });

        child.on('message', async (data: string) => {
            io_instance.to(`room_${user_id}`).emit('buyTx', JSON.parse(data));
        });

        child.on('exit', async (code: any) => {
            console.log(`Buy bundle exited ${code}`);
        });

        return res.status(200).json(build_response(true, {
            message: `Successfully sent transaction!`
        }));
    } catch (err) {
        io_instance.to(`room_${user_id}`).emit('buyTx', {
            pending: false,
            message: err,
            ok: false
        });
        logDetails(`Error processing token instructions: ${err}`);
        return res.status(200).json(build_response(false, null, err as string));
    }
}
