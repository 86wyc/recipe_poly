import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
// NOTE: Schema import required once delivered by System Architect
import * as schema from './schema';

const globalForPg = globalThis as unknown as {
  pgPool: Pool | undefined;
};

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPg.pgPool = pool;
}

export const db = drizzle(pool, { schema });

export async function closeDatabaseConnection(): Promise<void> {
  await pool.end();
}
