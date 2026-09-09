import { sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

/**
 * Generates type-safe cosine distance SQL expression for pgvector (<=>)
 * @param column Database vector column
 * @param queryVector Target embedding array
 * @param dimensions Expected vector dimensions (default 4)
 */
export function cosineDistance(
  column: PgColumn,
  queryVector: number[],
  dimensions: number = 4,
): SQL<number> {
  if (queryVector.length !== dimensions) {
    throw new Error(
      `[Vector] Query vector dimension mismatch: expected ${dimensions}, got ${queryVector.length}`,
    );
  }

  for (const value of queryVector) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`[Vector] Query vector contains non-finite value: ${value}`);
    }
  }

  // Convert number[] to pgvector literal string: [0.5,0.5,0.5,0.5]
  const vectorLiteral = `[${queryVector.join(',')}]`;

  // Pass as text and cast to vector in SQL
  return sql<number>`(${column} <=> ${vectorLiteral}::vector)`;
}

/**
 * Converts cosine distance to cosine similarity score: (1 - distance)
 */
export function cosineSimilarity(column: any, vector: number[]): SQL<number> {
  return sql<number>`1 - (${cosineDistance(column, vector)})`;
}