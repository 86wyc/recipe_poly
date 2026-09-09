import { sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

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

  // Build a proper pgvector literal string: '[0.5,0.5,0.5,0.5]'
  const vectorLiteral = `[${queryVector.join(',')}]`;

  // Use sql.raw to embed the literal directly in SQL (no parameter binding)
  return sql<number>`(${column} <=> ${sql.raw(`'${vectorLiteral}'::vector`)})`;
}

export function cosineSimilarity(column: PgColumn, vector: number[]): SQL<number> {
  return sql<number>`1 - (${cosineDistance(column, vector)})`;
}