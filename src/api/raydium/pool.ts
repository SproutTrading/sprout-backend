import dotenv from 'dotenv';
dotenv.config();

import { LIQUIDITY_STATE_LAYOUT_V4, Liquidity, LiquidityPoolKeys, LiquidityPoolKeysV4, MARKET_STATE_LAYOUT_V3, Market } from "@raydium-io/raydium-sdk";
import { AccountInfo, Connection, PublicKey } from "@solana/web3.js";
import { isFulfilled } from "../../utils/utils";

const RAYDIUM_LIQUIDITY_POOL_V4_ADDRESS = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');

type SolanaPool = {
    id: string | null,
    quoteMint: string,
    baseMint: string,
    quoteDecimals: number,
    baseDecimals: number,
    solBalance: number,
    tokensBalance: number,
    price: number,
    poolKeys: LiquidityPoolKeysV4 | null,
    type: 'pumpfun' | 'raydium',
    complete: boolean
}

async function getRaydiumLiquidityPools(connection: Connection, baseMint: string, quoteMint: string) {
    const layout = LIQUIDITY_STATE_LAYOUT_V4;
    return connection.getProgramAccounts(new PublicKey(RAYDIUM_LIQUIDITY_POOL_V4_ADDRESS), {
        filters: [
            { dataSize: layout.span },
            {
                memcmp: {
                    offset: layout.offsetOf('baseMint'),
                    bytes: new PublicKey(baseMint).toBase58(),
                },
            },
            {
                memcmp: {
                    offset: layout.offsetOf('quoteMint'),
                    bytes: new PublicKey(quoteMint).toBase58(),
                },
            },
        ],
    })
}

export async function getSolanaOptimalPool(connection: Connection, token: string) {
    let quoteMint = new PublicKey(`So11111111111111111111111111111111111111112`);
    let data: SolanaPool[] = [];

    let pools: {
        account: AccountInfo<Buffer>;
        pubkey: PublicKey;
    }[] = (await Promise.allSettled([
        getRaydiumLiquidityPools(connection, quoteMint.toString(), token.toString()),
        getRaydiumLiquidityPools(connection, token.toString(), quoteMint.toString())
    ])).filter(isFulfilled).map(x => x.value).flat();

    for (let pool of pools) {
        let poolData = LIQUIDITY_STATE_LAYOUT_V4.decode(pool.account.data);
        let baseVaultBalance = 0;
        let quoteVaultBalance = 0;
        {
            const _balance = await connection.getTokenAccountBalance(poolData.baseVault);
            baseVaultBalance = parseFloat(_balance.value.amount) / Math.pow(10, poolData.baseDecimal.toNumber());
        }

        {
            const _balance = await connection.getTokenAccountBalance(poolData.quoteVault);
            quoteVaultBalance = parseFloat(_balance.value.amount) / Math.pow(10, poolData.quoteDecimal.toNumber());
        }

        let price = poolData.baseMint.equals(quoteMint) ? baseVaultBalance / quoteVaultBalance : quoteVaultBalance / baseVaultBalance;

        const market = await connection.getAccountInfo(poolData.marketId).then((item) => ({
            programId: item!.owner,
            ...MARKET_STATE_LAYOUT_V3.decode(item!.data),
        }))

        const authority = Liquidity.getAssociatedAuthority({
            programId: new PublicKey(RAYDIUM_LIQUIDITY_POOL_V4_ADDRESS),
        }).publicKey

        const marketProgramId = market.programId

        const poolKeys = {
            id: pool.pubkey,
            baseMint: poolData.baseMint,
            quoteMint: poolData.quoteMint,
            lpMint: poolData.lpMint,
            baseDecimals: Number.parseInt(poolData.baseDecimal.toString()),
            quoteDecimals: Number.parseInt(poolData.quoteDecimal.toString()),
            lpDecimals: Number.parseInt(poolData.baseDecimal.toString()),
            version: 4,
            programId: new PublicKey(RAYDIUM_LIQUIDITY_POOL_V4_ADDRESS),
            openOrders: poolData.openOrders,
            targetOrders: poolData.targetOrders,
            baseVault: poolData.baseVault,
            quoteVault: poolData.quoteVault,
            marketVersion: 3,
            authority: authority,
            marketProgramId,
            marketId: market.ownAddress,
            marketAuthority: Market.getAssociatedAuthority({
                programId: marketProgramId,
                marketId: market.ownAddress,
            }).publicKey,
            marketBaseVault: market.baseVault,
            marketQuoteVault: market.quoteVault,
            marketBids: market.bids,
            marketAsks: market.asks,
            marketEventQueue: market.eventQueue,
            withdrawQueue: poolData.withdrawQueue,
            lpVault: poolData.lpVault,
            lookupTableAccount: PublicKey.default,
        } as LiquidityPoolKeys;

        data.push({
            id: pool.pubkey.toString(),
            quoteMint: poolData.quoteMint.toString(),
            baseMint: poolData.baseMint.toString(),
            quoteDecimals: poolData.quoteDecimal.toNumber(),
            baseDecimals: poolData.baseDecimal.toNumber(),
            solBalance: poolData.baseMint.equals(quoteMint) ? baseVaultBalance : quoteVaultBalance,
            tokensBalance: !poolData.baseMint.equals(quoteMint) ? baseVaultBalance : quoteVaultBalance,
            price,
            poolKeys,
            type: 'raydium',
            complete: true
        })
    }
    let max;
    if (data.length > 0) {
        let pumpfunIncomplete = data.find(x => x.type === 'pumpfun' && !x.complete);
        if (pumpfunIncomplete) {
            return pumpfunIncomplete;
        }
        let nonPumpFunData = data.filter(x => x.type === 'raydium');
        if (nonPumpFunData.length > 0) {
            max = data.reduce(function (prev, current) {
                return (prev && prev.solBalance > current.solBalance) ? prev : current
            })
        }
    }
    return max;
}