import dotenv from 'dotenv';
dotenv.config();

import { Request, Response } from 'express';
import { build_response } from '../utils/http_helper';
import { logDetails } from '../utils/utils';
import { getTokenData } from '../api/token_data';

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
        let tokenData = await getTokenData(process.env.TOKEN_ADDRESS!, false);
        if (tokenData && tokenData.token) {
            return res.status(200).json(build_response(true, tokenData.token));
        } else {
            return res.status(200).json(build_response(false, null, "Failed to get token details"));
        }
    } catch (err) {
        logDetails(`Error get resources epochs: ${err}`);
        return res.status(200).json(build_response(false, null, err as string));
    }
}