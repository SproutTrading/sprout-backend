import dotenv from 'dotenv';
dotenv.config();

import { Request, Response } from 'express';
import { build_response } from '../utils/http_helper';
import { logDetails } from '../utils/utils';
import axios from 'axios';

export const getSproutAddress = async (req: Request, res: Response) => {
    try {

        return res.status(200).json(build_response(true, {
            token_address: process.env.TOKEN_ADDRESS!
        }));
    } catch (err) {
        logDetails(`Error get resources epochs: ${err}`);
        return res.status(200).json(build_response(false, null, err as string));
    }
}

export const getSproutStatistics = async (req: Request, res: Response) => {
    try {
        let { data: { data, success } }: any = await axios.get(`https://pro-api.solscan.io/v2.0/token/meta?address=${process.env.TOKEN_ADDRESS!}`, {
            headers: {
                "token": process.env.SOLSCAN_API_KEY!
            }
        }); 
        if (success) {
            return res.status(200).json(build_response(true, data));
        } else {
            return res.status(200).json(build_response(false, null, "Failed to get token details"));
        }
    } catch (err) {
        logDetails(`Error get resources epochs: ${err}`);
        return res.status(200).json(build_response(false, null, err as string));
    }
}