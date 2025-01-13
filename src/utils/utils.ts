import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import moment from 'moment';
import { Request } from 'express';
import base58 from 'bs58';
import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { Wallet } from '@project-serum/anchor'
import bn from 'bignumber.js';

import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import { TransactionInstruction } from '@solana/web3.js';

function getOptions() {
    const now: moment.Moment = moment(new Date().toISOString());
    const datetime = now.format('DD-MM-YYYY');
    const options: winston.LoggerOptions = {
        transports: [
            new winston.transports.Console({
                level: 'error',
            }),
            new winston.transports.File({ filename: `./logs/debug_${datetime}.log`, level: 'debug' }),
        ],
    };
    return options;
}

export function logDetails(errorDescription: string) {
    let logger = winston.createLogger(getOptions());
    const now: moment.Moment = moment(new Date().toISOString());
    const datetime = now.format('YYYY-MM-DD HH:mm:ss:SSS ZZ');
    logger.log('debug', `[${datetime}] ${errorDescription}`);
}

export function getCurrentDateTime() {
    const now: moment.Moment = moment(new Date().toISOString());
    const datetime = now.format('HH:mm:ss:SSS');
    return datetime;
}

export function getTimeWithOffset() {
    return new Date().getTime() + new Date().getTimezoneOffset() * 60000;
}

export function isEmptyOrNull(value: any) {
    return value === undefined || value === null || value === '';
}

export function isEmptyOrNullParams(value: string) {
    return value === 'undefined' || value === undefined || value === null || value === '';
}

export function getAuthorization(req: Request): string | null {
    // tslint:disable-next-line:max-line-length
    const headers: string | null = req.headers.authorization ? typeof req.headers.authorization === 'string' ? req.headers.authorization : req.headers.authorization[0] : null;
    if (headers === null) {
        return null;
    }
    if (!headers.includes('Bearer ')) {
        return null;
    }
    const headersParsed = headers.trim().split('Bearer ');
    if (headersParsed.length === 2) {
        return headersParsed[1];
    } else {
        return null;
    }
}

export function generateText(length: number) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

export function randomIntFromInterval(min: number, max: number) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min);
}

export function generateUuid() {
    return uuidv4();
}

export function deepClone<T>(data: T): T {
    return JSON.parse(JSON.stringify(data));
}
export function isFulfilled<T>(val: PromiseSettledResult<T>): val is PromiseFulfilledResult<T> {
    return val.status === 'fulfilled';
}

export function getSolanaWallet(pk: string) {
    let wallet = new Wallet(Keypair.fromSecretKey(base58.decode(pk)))
    return wallet;
}

export function convertToHex(input: number | string) {
    return `0x${new bn(typeof input === 'number' ? input.toString() : input).toString(16)}`;
}

// COMPACT ARRAY

const LOW_VALUE = 127; // 0x7f
const HIGH_VALUE = 16383; // 0x3fff

/**
 * Compact u16 array header size
 * @param n elements in the compact array
 * @returns size in bytes of array header
 */
const compactHeader = (n: number) => (n <= LOW_VALUE ? 1 : n <= HIGH_VALUE ? 2 : 3);

/**
 * Compact u16 array size
 * @param n elements in the compact array
 * @param size bytes per each element
 * @returns size in bytes of array
 */
const compactArraySize = (n: number, size: number) => compactHeader(n) + n * size;

/**
 * @param tx a solana transaction
 * @param feePayer the publicKey of the signer
 * @returns size in bytes of the transaction
 */
export const getTxSize = (instructions: TransactionInstruction[], feePayer: PublicKey): number => {
    const tx = new Transaction();
    tx.instructions = instructions;
    const feePayerPk = [feePayer.toBase58()];

    const signers = new Set<string>(feePayerPk);
    const accounts = new Set<string>(feePayerPk);

    const ixsSize = tx.instructions.reduce((acc, ix) => {
        ix.keys.forEach(({ pubkey, isSigner }) => {
            const pk = pubkey.toBase58();
            if (isSigner) signers.add(pk);
            accounts.add(pk);
        });

        accounts.add(ix.programId.toBase58());

        const nIndexes = ix.keys.length;
        const opaqueData = ix.data.length;

        return (
            acc +
            1 + // PID index
            compactArraySize(nIndexes, 1) +
            compactArraySize(opaqueData, 1)
        );
    }, 0);

    return (
        compactArraySize(signers.size, 64) + // signatures
        3 + // header
        compactArraySize(accounts.size, 32) + // accounts
        32 + // blockhash
        compactHeader(tx.instructions.length) + // instructions
        ixsSize
    );
};

export function splitArray<T>(array: T[], chunkSize = 2) {
    let newArray: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        const chunk = array.slice(i, i + chunkSize);
        newArray.push(chunk);
    }
    return newArray;
}

export function log_pumpfun(token: string, description: string) {
    const now: moment.Moment = moment(new Date().toISOString());
    const options: winston.LoggerOptions = {
        transports: [
            new winston.transports.Console({
                level: 'error',
            }),
            new winston.transports.File({ filename: `./logs/pumpfun/launch_pumpfun_${token}.log`, level: 'debug' }),
        ],
    };

    let logger = winston.createLogger(options);
    const datetime_new = now.format('YYYY-MM-DD HH:mm:ss:SSS ZZ');
    logger.log('debug', `[${datetime_new}] ${description}`);
}


export function distributeTokens(totalAmount: number, length: number) {
    // Ensure totalAmount is a number
    totalAmount = Number(totalAmount);

    // Calculate base amount (approximate target per wallet)
    const baseAmount = totalAmount / length;

    // Generate random variations (between -5% to +5% of base amount)
    let amounts = [];
    for (let i = 0; i < length - 1; i++) {
        const variation = (Math.random() * 0.1 - 0.05) * baseAmount;
        amounts.push(Math.floor(baseAmount + variation));
    }

    // Calculate the last amount to ensure total sum equals totalAmount
    const distributed = amounts.reduce((a, b) => a + b, 0);
    amounts.push(totalAmount - distributed);

    // Format output
    const result = amounts.map(amount => ({
        amount: amount,
        percentage: ((amount / totalAmount) * 100).toFixed(2) + '%'
    }));

    return result;
}

export function checkField(input: string, message: string) {
    if (isEmptyOrNull(input)) {
        throw new Error(message);
    }
} 