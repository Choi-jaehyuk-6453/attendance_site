import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL or POSTGRES_URL must be set. Did you forget to provision a database?",
  );
}

const poolConfig: pg.PoolConfig = { connectionString };

// In serverless environments (like Vercel), limit max connections to avoid exhausting the DB pool
if (process.env.VERCEL) {
  poolConfig.max = 1;
}

export const pool = new Pool(poolConfig);

export const db = drizzle(pool, { schema });
