import { Connection, PublicKey } from "@solana/web3.js";
import { struct, bool, u64, publicKey, Layout } from "@coral-xyz/borsh";

const GLOBAL_ACCOUNT_SEED = "global";
const PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

export async function getGlobalAccount(connection: Connection) {
    const [globalAccountPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from(GLOBAL_ACCOUNT_SEED)],
        new PublicKey(PROGRAM_ID)
    );

    const tokenAccount = await connection.getAccountInfo(
        globalAccountPDA,
        'finalized'
    );

    return GlobalAccount.fromBuffer(tokenAccount!.data);
}

export class GlobalAccount {
    public discriminator: bigint;
    public initialized: boolean = false;
    public authority: PublicKey;
    public feeRecipient: PublicKey;
    public initialVirtualTokenReserves: bigint;
    public initialVirtualSolReserves: bigint;
    public initialRealTokenReserves: bigint;
    public tokenTotalSupply: bigint;
    public feeBasisPoints: bigint;

    constructor(
        discriminator: bigint,
        initialized: boolean,
        authority: PublicKey,
        feeRecipient: PublicKey,
        initialVirtualTokenReserves: bigint,
        initialVirtualSolReserves: bigint,
        initialRealTokenReserves: bigint,
        tokenTotalSupply: bigint,
        feeBasisPoints: bigint
    ) {
        this.discriminator = discriminator;
        this.initialized = initialized;
        this.authority = authority;
        this.feeRecipient = feeRecipient;
        this.initialVirtualTokenReserves = initialVirtualTokenReserves;
        this.initialVirtualSolReserves = initialVirtualSolReserves;
        this.initialRealTokenReserves = initialRealTokenReserves;
        this.tokenTotalSupply = tokenTotalSupply;
        this.feeBasisPoints = feeBasisPoints;
    }

    getInitialBuyPrice(amount: bigint): bigint {
        if (amount <= 0n) {
            return 0n;
        }

        let n = this.initialVirtualSolReserves * this.initialVirtualTokenReserves;
        let i = this.initialVirtualSolReserves + amount;
        let r = n / i + 1n;
        let s = this.initialVirtualTokenReserves - r;
        return s < this.initialRealTokenReserves
            ? s
            : this.initialRealTokenReserves;
    }

    getBuyPrice(tokens: bigint): bigint {
        const product_of_reserves = this.initialVirtualSolReserves * this.initialVirtualTokenReserves;
        const new_virtual_token_reserves = this.initialVirtualTokenReserves - tokens;
        const new_virtual_sol_reserves = product_of_reserves / new_virtual_token_reserves + 1n;
        const amount_needed = new_virtual_sol_reserves > this.initialVirtualSolReserves ? new_virtual_sol_reserves - this.initialVirtualSolReserves : 0n;
        return amount_needed > 0n ? amount_needed : 0n;
    }

    getBuyPriceSol(token_amount: bigint): bigint {
        const final_token_amount = token_amount > this.initialRealTokenReserves ? this.initialRealTokenReserves : token_amount;
        const sol_amount = this.getBuyPrice(final_token_amount);
        return sol_amount
    }


    public static fromBuffer(buffer: Buffer): GlobalAccount {
        const structure: Layout<GlobalAccount> = struct([
            u64("discriminator"),
            bool("initialized"),
            publicKey("authority"),
            publicKey("feeRecipient"),
            u64("initialVirtualTokenReserves"),
            u64("initialVirtualSolReserves"),
            u64("initialRealTokenReserves"),
            u64("tokenTotalSupply"),
            u64("feeBasisPoints"),
        ]);

        let value = structure.decode(buffer);
        return new GlobalAccount(
            BigInt(value.discriminator),
            value.initialized,
            value.authority,
            value.feeRecipient,
            BigInt(value.initialVirtualTokenReserves),
            BigInt(value.initialVirtualSolReserves),
            BigInt(value.initialRealTokenReserves),
            BigInt(value.tokenTotalSupply),
            BigInt(value.feeBasisPoints)
        );
    }

    adjustTokensBalance(sol_amount: bigint, token_amount: bigint) {
        this.initialVirtualTokenReserves = this.initialVirtualTokenReserves - token_amount;
        this.initialRealTokenReserves = this.initialRealTokenReserves - token_amount;

        this.initialVirtualSolReserves = this.initialVirtualSolReserves + sol_amount;
        this.initialRealTokenReserves = this.initialRealTokenReserves + sol_amount;
    }
}