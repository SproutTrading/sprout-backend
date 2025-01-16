import { db_pool } from "../constants";

let queries = `
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS users_inventory CASCADE;
DROP TABLE IF EXISTS users_claims CASCADE;
DROP TABLE IF EXISTS pumpfun_contracts CASCADE;
CREATE TABLE IF NOT EXISTS "users" (
    "id" SERIAL,
    "group_id" int NOT NULL,
    "role_id" int NOT NULL,
    "nonce" TEXT NOT NULL,
    "twitter" VARCHAR(100),
    "telegram" VARCHAR(100),
    "discord" VARCHAR(100),
    "github" VARCHAR(100),
    "public_key" VARCHAR(44) NOT NULL UNIQUE,
    "display_name" VARCHAR(40) NOT NULL,
    "username" VARCHAR(40) NOT NULL, 
    "date_joined" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "pumpfun_contracts" (
    "id" SERIAL,
    "user_id" int,
    "public_key" TEXT NOT NULL,
    "private_key" TEXT NOT NULL,
    "launched" boolean DEFAULT false NOT NULL,
    "date_added" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id"),
    CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "users_inventory" (
    "id" SERIAL,
    "user_id" int NOT NULL,
    "pumpfun_contract_id" int,
    "object_id" int NOT NULL,
    "contributed" boolean DEFAULT false NOT NULL,
    "epoch" int,
    "date_contributed" TIMESTAMP,
    "date_added" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id"),
    CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_pumpfun FOREIGN KEY(pumpfun_contract_id) REFERENCES pumpfun_contracts(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "users_claims" (
    "id" SERIAL,
    "user_id" int NOT NULL,
    "date_added" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id"),
    CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`; 

(async () => {
    try {
        const connected = await db_pool.connect();
        const res = await db_pool.query(queries);
        console.log(res)
        await db_pool.end();
        process.exit(1);
    } catch (err) {
        console.log(`Failed to connect: ${err}`);
    }
})()

