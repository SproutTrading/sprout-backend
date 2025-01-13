import dotenv from 'dotenv';
dotenv.config();

import { Pool } from "pg";

export const db_pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: +process.env.POSTGRES_PORT!,
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    max: 20,
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 0,
});
