import BN from "bn.js";
import { Liquidity, SPL_ACCOUNT_LAYOUT, TOKEN_PROGRAM_ID, Token, TokenAccount, TokenAmount } from "@raydium-io/raydium-sdk";
import { Connection, LAMPORTS_PER_SOL, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { getSolanaOptimalPool } from "./pool";

async function getWalletTokenAccount(connection: Connection, wallet: PublicKey): Promise<TokenAccount[]> {
    const walletTokenAccount = await connection.getTokenAccountsByOwner(wallet, {
        programId: TOKEN_PROGRAM_ID,
    });
    return walletTokenAccount.value.map((i) => ({
        pubkey: i.pubkey,
        programId: i.account.owner,
        accountInfo: SPL_ACCOUNT_LAYOUT.decode(i.account.data),
    }));
}

export async function buyRaydium(connection: Connection, payer: PublicKey, receiver: PublicKey, input: number, token: string): Promise<{ instructions: TransactionInstruction[] }> {
    let pool = await getSolanaOptimalPool(connection, token);
    if (!pool || !pool.poolKeys) {
        throw new Error("Pool not found");
    }

    let poolKeys = pool.poolKeys;

    let baseMint = new PublicKey('So11111111111111111111111111111111111111112');
    let baseDecimals = 9;
    let quoteMint = poolKeys.quoteMint;
    let quoteDecimals = poolKeys.quoteDecimals;
    if (quoteMint.equals(baseMint)) {
        quoteMint = poolKeys.baseMint;
        quoteDecimals = poolKeys.baseDecimals;
    }

    let tokenAccounts: TokenAccount[] = await getWalletTokenAccount(connection, receiver);

    let inputToken = new Token(TOKEN_PROGRAM_ID, baseMint, baseDecimals);
    let outputToken = new Token(TOKEN_PROGRAM_ID, quoteMint, quoteDecimals);

    let instructions: TransactionInstruction[] = [];

    let _amountIn = new TokenAmount(inputToken, new BN(Math.floor(input * LAMPORTS_PER_SOL)));
    let _amountOut = new TokenAmount(outputToken, new BN(1));

    const swapTransaction = await Liquidity.makeSwapInstructionSimple({
        connection: connection,
        makeTxVersion: 0,
        poolKeys: {
            ...poolKeys,
        },
        userKeys: {
            tokenAccounts,
            owner: receiver,
            payer
        },
        amountIn: _amountIn,
        amountOut: _amountOut,
        fixedSide: 'in',
        config: {
            bypassAssociatedCheck: false,
        }
    })

    instructions = [...instructions, ...swapTransaction.innerTransactions[0].instructions.filter(Boolean)];
    return { instructions }
}