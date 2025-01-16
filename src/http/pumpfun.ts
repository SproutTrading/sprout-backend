import dotenv from 'dotenv';
dotenv.config();

import { Request, Response } from 'express';
import { build_response } from '../utils/http_helper';
import { checkField } from '../utils/utils';
import { fork } from 'node:child_process';
import { PumpfunPayload } from '../api/pumpfun_builder';
import io_instance from '../websocket';
import { get_pumpfun_launched_contracts } from '../db';
import { getTokenData } from '../api/token_data';

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
            id,
            name,
            symbol,
            description,
            image,
            telegram,
            website,
            twitter,
            private_key,
            tip,
            value
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

export const getPumfunTokens = async (req: Request, res: Response) => {
    try {
        let pumpfun_contracts: { id: number, public_key: string, water: number, fertilizer: number, sunshine: number, total: number }[] = await get_pumpfun_launched_contracts();
        let token_data = [];
        for await (let pumpfun_contract of pumpfun_contracts) {
            let tokenData = await getTokenData(pumpfun_contract.public_key, true);
            if (tokenData && tokenData.ipfs && tokenData.token) {
                let finalTokenData = {
                    ...tokenData,
                    resources: {
                        ...pumpfun_contract,
                        water: +pumpfun_contract.water,
                        fertilizer: +pumpfun_contract.fertilizer,
                        sunshine: +pumpfun_contract.sunshine,
                        total: +pumpfun_contract.total
                    }
                }
                token_data.push(finalTokenData)
            }
        }
        return res.status(200).json(build_response(true, token_data));
    } catch (err) {
        return res.status(200).json(build_response(false, null, err as string));
    }
}
