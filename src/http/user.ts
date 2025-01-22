import { Request, Response } from 'express';
import { generateUuid, logDetails, checkField } from "../utils/utils";
import * as jwthelper from '../utils/jwt-helper';
import { decodeUTF8 } from 'tweetnacl-util';
import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';
import base58 from 'bs58';
import { check_username, insert_user, select_users, update_user_nonce, update_user_socials } from '../db';
import { build_response } from '../utils/http_helper';
import { GameObjects, Groups, Roles } from '../models/enums';

export const getNonce = async (req: Request, res: Response) => {
    try {
        const { address } = req.body;
        checkField(address, "Address is missing");
        let pubkey = new PublicKey(address);
        if (!PublicKey.isOnCurve(pubkey.toBytes())) {
            throw Error("Address is invalid");
        }
        const nonce = generateUuid();
        return res.status(200).json(build_response(true, {
            address: address,
            nonce
        }))
    } catch (err: any) {
        logDetails(`Error getting nonce for user: ${err}`);
        return res.status(200).json(build_response(false, null, err))
    }
};

export const registerUser = async (req: Request, res: Response) => {
    try {
        let { address, nonce, signature, username } = req.body;
        checkField(address, "Address is missing");
        checkField(nonce, "Nonce is missing");
        checkField(signature, "Signature is missing");
        checkField(username, "Username is missing");
        username = username.trim();
        if (username.length > 40) {
            throw new Error("Username exceeds 50 characters")
        }
        if (username.length < 5) {
            throw new Error("Username needs to have at least 5 characters")
        }
        const USERNAME_REGEX = /^[a-zA-Z0-9_-]{5,40}$/;
        if (!USERNAME_REGEX.test(username)) {
            throw new Error("Only alphanumeric characters are allowed!");
        }
        let count = await check_username(username.toLowerCase());
        if (count !== 0) {
            throw new Error("Username already taken!");
        }

        let publicKey = new PublicKey(address);
        if (!PublicKey.isOnCurve(publicKey.toBytes())) {
            throw Error("Address is invalid");
        }
        const messageBytes = decodeUTF8(nonce);
        const result = nacl.sign.detached.verify(
            messageBytes,
            base58.decode(base58.encode(signature as number[])),
            publicKey.toBytes(),
        );
        if (!result) {
            throw Error("Failed to verify signature");
        }
        let users = await select_users(publicKey.toString());
        if (users.length !== 0) {
            throw Error("Public key already in use!");
        }

        const new_nonce = generateUuid();
        let new_user = await insert_user(publicKey.toString(), Groups.USER, Roles.GARDENER, new_nonce, username, username.toLowerCase());

        jwthelper.signData({
            id: new_user.id,
            group_id: new_user.group_id,
            role_id: new_user.role_id,
            public_key: new_user.public_key,
            display_name: new_user.display_name,
            date_joined: new_user.date_joined,
        }, async (err: unknown, jwt: string) => {
            if (err) {
                throw new Error(`Error while signing jwt token: ${err}`);
            } else {
                return res.status(200).json(build_response(true, {
                    jwt: jwt,
                    id: new_user.id,
                    group_id: new_user.group_id,
                    role_id: new_user.role_id,
                    public_key: new_user.public_key,
                    display_name: new_user.display_name,
                    date_joined: new_user.date_joined,
                }));
            }
        });

    } catch (err) {
        logDetails(`Error verifying nonce for user: ${err}`);
        return res.status(200).json(build_response(false, null, err as string));
    }
};

export const loginUser = async (req: Request, res: Response) => {
    try {
        const { address, nonce, signature } = req.body;
        checkField(address, "Address is missing");
        checkField(nonce, "Nonce is missing");
        checkField(signature, "Signature is missing");
        let publicKey = new PublicKey(address);
        if (!PublicKey.isOnCurve(publicKey.toBytes())) {
            throw Error("Address is invalid");
        }
        const messageBytes = decodeUTF8(nonce);
        const result = nacl.sign.detached.verify(
            messageBytes,
            base58.decode(base58.encode(signature as number[])),
            publicKey.toBytes(),
        );

        if (!result) {
            throw Error("Failed to verify signature");
        }
        const new_nonce = generateUuid();
        const users = await select_users(publicKey.toString());
        if (users.length === 0) {
            throw Error("No user found!");
        }
        let updated = await update_user_nonce(publicKey.toString(), new_nonce);
        jwthelper.signData({
            id: users[0].id,
            group_id: users[0].group_id,
            role_id: users[0].role_id,
            public_key: users[0].public_key,
            display_name: users[0].display_name,
            date_joined: users[0].date_joined,
        }, async (err: unknown, jwt: string) => {
            if (err) {
                logDetails(`Error while signing jwt token: ${err}`);
                return res.status(200).json(build_response(false, null, `Error while signing jwt token: ${err}`));
            } else {
                return res.status(200).json(build_response(true, {
                    jwt: jwt,
                    id: users[0].id,
                    group_id: users[0].group_id,
                    role_id: users[0].role_id,
                    public_key: users[0].public_key,
                    display_name: users[0].display_name,
                    date_joined: users[0].date_joined,
                }));
            }
        });
    } catch (err) {
        logDetails(`Error verifying nonce for user: ${err}`);
        return res.status(200).json(build_response(false, null, err as string));
    }
};

export const checkUsernameAvailability = async (req: Request, res: Response) => {
    try {
        let { username } = req.body;
        checkField(username, "Username is missing");
        username = username.trim();
        if (username.length > 40) {
            throw new Error("Username exceeds 50 characters")
        }
        if (username.length < 5) {
            throw new Error("Username needs to have at least 5 characters")
        }
        const USERNAME_REGEX = /^[a-zA-Z0-9_-]{5,40}$/;
        if (!USERNAME_REGEX.test(username)) {
            throw new Error("Only alphanumeric characters are allowed!");
        }
        let count = await check_username(username.toLowerCase());
        if (count === 0) {
            return res.status(200).json(build_response(true, { username, message: "Username is available!" }));
        } else {
            throw new Error("Username already taken!")
        }
    } catch (err) {
        logDetails(`Error checking username: ${err}`);
        return res.status(200).json(build_response(false, null, err as string));
    }
};

export const getSocials = async (req: Request, res: Response) => {
    try {
        let public_key = res.locals['authorizedUser'].public_key;
        const users = await select_users(public_key);
        if (users.length > 0) {
            return res.status(200).json(build_response(true, {
                twitter: users[0].twitter,
                github: users[0].github,
                discord: users[0].discord,
                telegram: users[0].telegram,
            }));
        } else {
            throw new Error("Failed to update socials")
        }
    } catch (err) {
        logDetails(`Error get socials: ${err}`);
        return res.status(200).json(build_response(false, null, err as string));
    }
}

export const updateSocials = async (req: Request, res: Response) => {
    try {
        let { twitter, telegram, github, discord } = req.body;
        let public_key = res.locals['authorizedUser'].public_key;
        if (twitter) {
            twitter = twitter.trim();
        }
        if (telegram) {
            telegram = telegram.trim();
        }
        if (github) {
            github = github.trim();
        }
        if (discord) {
            discord = discord.trim();
        }
        let updated = await update_user_socials(public_key, twitter, telegram, discord, github);
        if (updated) {
            return res.status(200).json(build_response(true, { message: "Successfully updated socials!" }));
        } else {
            throw new Error("Failed to update socials")
        }
    } catch (err) {
        logDetails(`Error updating socials: ${err}`);
        return res.status(200).json(build_response(false, null, err as string));
    }
};