import dotenv from 'dotenv';
dotenv.config();

import { Request, Response } from 'express';
import { build_response } from '../utils/http_helper';
import { checkField, isEmptyOrNull, isFulfilled } from '../utils/utils';
import { fork } from 'node:child_process';
import { PumpfunPayload } from '../api/pumpfun_builder';
import io_instance from '../websocket';
import { get_count_pumpfun_launched_contracts, get_pumpfun_launched_contracts } from '../db';
import { getTokenData } from '../api/token_data';
import { PumpfunToken } from '../api/pumpfun/pumpfun_instructions';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import { CACHED_SOL_PRICE } from '../constants';

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
        let page = req.query && req.query.page && !isNaN(+req.query.page) && Number.isInteger(+req.query.page) ? +req.query.page : 1;
        let limit = 15;
        let offset = (page - 1) * limit;
        let count = await get_count_pumpfun_launched_contracts();
        let pumpfun_contracts: { id: number, public_key: string, water: number, fertilizer: number, sunshine: number, total: number }[] = await get_pumpfun_launched_contracts(offset, limit);
        let token_data = (await Promise.allSettled(pumpfun_contracts.map(pumpfun_contract => getTokenData(pumpfun_contract.public_key, true)))).map((response, idx) => {
            if (response.status === 'fulfilled' && response.value && response.value.ipfs && response.value.token) {
                let finalTokenData = {
                    ...response.value,
                    resources: {
                        ...pumpfun_contracts[idx],
                        water: +pumpfun_contracts[idx].water,
                        fertilizer: +pumpfun_contracts[idx].fertilizer,
                        sunshine: +pumpfun_contracts[idx].sunshine,
                        total: +pumpfun_contracts[idx].total
                    }
                }
                return finalTokenData;
            } else {
                return null
            }
        }).filter(x => !isEmptyOrNull(x));

        let bondingCurveAccountReqs = (await Promise.allSettled(token_data.filter(x => isEmptyOrNull(x!.token.market_cap) || isEmptyOrNull(x!.token.price)).map(async (x) => {
            let pumpfunToken = new PumpfunToken(Keypair.generate());
            let bondingCurveAccount = await pumpfunToken.getBondingCurveAccount(new PublicKey(x!.token.address));
            if (!bondingCurveAccount) {
                throw new Error(`Bonding curve account not found: ${new PublicKey(x!.token.address).toBase58()}`);
            }
            return {
                address: x!.token.address,
                price: (Number.parseInt(bondingCurveAccount.getBuyOutPrice(BigInt(1 * 1e6), BigInt(0)).toString()) / LAMPORTS_PER_SOL) * CACHED_SOL_PRICE,
                market_cap: (Number.parseInt(bondingCurveAccount.getMarketCapSOL().toString()) / LAMPORTS_PER_SOL) * CACHED_SOL_PRICE,
            }
        }))).filter(isFulfilled);

        for (let bondingCurveAccountReq of bondingCurveAccountReqs) {
            let idx = token_data.findIndex(data => data?.token.address === bondingCurveAccountReq.value.address);
            if (idx >= 0) {
                token_data[idx] = {
                    ...token_data[idx]!,
                    token: {
                        ...token_data[idx]!.token,
                        price: bondingCurveAccountReq.value.price,
                        market_cap: bondingCurveAccountReq.value.market_cap
                    }
                }
            }
        }

        return res.status(200).json(build_response(true, {
            token_data,
            count,
            page,
        }));
    } catch (err) {
        return res.status(200).json(build_response(false, null, err as string));
    }
}
