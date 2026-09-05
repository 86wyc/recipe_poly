import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Use pooled connection string if provided (Supabase transaction pooler / Neon pooled).
// Fallback to DATABASE_URL for local development.
const connectionString =
  process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    '[Database Connection Error] DATABASE_URL or DATABASE_URL_POOLED is not set. ' +
    'Ensure a .env file exists in the project root with the correct connection string.',
  );
}

// Serverless-safe pool configuration:
// - max: 1 prevents connection exhaustion in serverless functions.
// - idleTimeoutMillis: 5000 releases idle connections quickly.
// - connectionTimeoutMillis: 10000 avoids hanging during cold starts.
// - ssl: required for managed PostgreSQL providers (Supabase/Neon) in production.
const pool = new Pool({
  connectionString,
  max: 1,
  idleTimeoutMillis: 5000,
  connectionTimeoutMillis: 10000,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : undefined,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error]: Unexpected error on idle client', err);
});

export const db = drizzle(pool, { schema });

export async function closeDatabaseConnection(): Promise<void> {
  await pool.end();
}
