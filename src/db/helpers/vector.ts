import { sql, SQL } from 'drizzle-orm';

/**
 * Generates type-safe cosine distance SQL expression for pgvector (<=>)
 * @param column Database vector column
 * @param vector Target embedding array
 */
export function cosineDistance(column: any, vector: number[]): SQL<number> {
  if (!vector || vector.length === 0) {
    throw new Error('[Vector Error]: Target vector cannot be empty.');
  }

  const vectorString = `[${vector.join(',')}]`;
  return sql<number>`${column} <=> ${vectorString}::vector`;
}

/**
 * Converts cosine distance to cosine similarity score: (1 - distance)
 */
export function cosineSimilarity(column: any, vector: number[]): SQL<number> {
  return sql<number>`1 - (${cosineDistance(column, vector)})`;
}
