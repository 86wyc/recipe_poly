import { sql, type SQL } from 'drizzle-orm';

/**
 * Casts a string parameter to PostgreSQL `uuid` type.
 * Use this when comparing uuid columns to string values in eq().
 */
export function uuidParam(value: string): SQL {
  return sql`${value}::uuid`;
}
