import { Request, Response } from 'express';
import { build_response } from '../utils/http_helper';
import { checkField, logDetails } from '../utils/utils';
import { fork } from 'node:child_process';
import { PumpfunPayload } from '../api/pumpfun_builder';
import { Keypair } from '@solana/web3.js';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
import io_instance from '../websocket';

export const launchPumpfun = async (req: Request, res: Response) => {
    let id = res.locals['authorizedUser'].id;
    try {
        io_instance.to(`room_${id}`).emit('pumpfun', {
            ok: true,
            message: `Validating token configuration...`
        });
        const { name, symbol, description, image, telegram, website, twitter, private_key, tip, value }: PumpfunPayload = req.body;
        checkField(name, "Name is missing");
        checkField(symbol, "Symbol is missing");
        checkField(description, "Description is missing");
        checkField(image, "Image is missing");
        checkField(private_key, "Private key is missing");
        checkField(tip, "Private key is missing");
        checkField(value, "Private key is missing");
        let current_tip = +tip;
        let current_value = +value;
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

        let payload: PumpfunPayload = {
            name,
            symbol,
            description,
            image,
            telegram,
            website,
            twitter,
            private_key,
            tip,
            value,
            pumpfun_pk: bs58.encode(Keypair.generate().secretKey)
        }
        var child = fork('dist/api/pumpfun_builder.js');
        child.send(JSON.stringify(payload));
        child.on('data', async (data: any) => {
            console.log(data.toString());
        });

        child.on('message', async (data: string) => {
            io_instance.to(`room_${id}`).emit('pumpfun', JSON.parse(data));
        });

        child.on('exit', async (code: any) => {
            console.log(`Bundler exited ${code}`);
        });
        io_instance.to(`room_${id}`).emit('pumpfun', {
            ok: true,
            message: `Processing launch of ${name} (${symbol})...`
        });
        return res.status(200).json(build_response(true, {
            message: `Processing launch of ${name} (${symbol})...`
        }));
    } catch (err) {
        io_instance.to(`room_${id}`).emit('pumpfun', {
            ok: false,
            message: err as string
        });
        return res.status(200).json(build_response(false, null, err as string));
    }
}