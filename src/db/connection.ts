import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    '[Database Connection Error] DATABASE_URL is not set in environment variables. ' +
    'Ensure a .env file exists in the project root containing DATABASE_URL.',
  );
}

// Pass single connectionString to prevent undefined user/password properties
export const pool = new Pool({
  connectionString,
  // Recommended pool config for Vercel/Serverless + Hono runtime
  max: process.env.NODE_ENV === 'production' ? 10 : 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Guard pool connection errors to prevent unhandled node process crashes
pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error]: Unexpected error on idle client', err);
});

export const db = drizzle(pool, { schema });

export async function closeDatabaseConnection(): Promise<void> {
  await pool.end();
}
