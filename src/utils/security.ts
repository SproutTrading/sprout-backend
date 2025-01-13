import dotenv from 'dotenv';
dotenv.config();

import { NextFunction, Request, Response } from 'express';
import { getAuthorization, isEmptyOrNull } from "./utils";
import { decodeToken, verifyData } from "./jwt-helper";

export function getAuthorizedUser(req: Request, res: Response, next: NextFunction) {
    const token = getAuthorization(req);
    if (!token) {
        return null;
    }
    return decodeToken(token);
}

export async function isAuthorized(req: Request, res: Response, next: NextFunction) {
    const token = getAuthorization(req);
    if (token === null) {
        return res.status(401).send('Unauthorized access');
    }

    const authorizedUser: any = getAuthorizedUser(req, res, next);
    if (authorizedUser === null) {
        return res.status(401).send("Unauthorized access");
    }
    res.locals['authorizedUser'] = authorizedUser;
    try {
        let verified = await verifyDateInternal(token);
        return next();
    } catch (err) {
        return res.status(401).send(err);
    }
}

export function verifyDateInternal(token: string) {
    return new Promise((resolve, reject) => {
        verifyData(token, (err: any, decoded: any) => {
            if (err) {
                return reject('Error parsing jwt');
            }
            if (!isEmptyOrNull(decoded.exp) && (new Date(decoded.exp * 1000).getTime() - new Date().getTime() > 0)) {
                return resolve(true)
            } else {
                return reject('Token expired, please re-login');
            }
        });
    })
}