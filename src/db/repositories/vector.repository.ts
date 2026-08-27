import { and, asc, desc, notInArray, sql } from 'drizzle-orm';
import { db } from '../connection';
import { recipeVectors } from '../schema';
import { cosineDistance } from '../helpers/vector';

// ============================================================================
// Type Definitions
// ============================================================================

export interface SimilarRecipeResult {
  recipeId: string;
  similarityScore: number;
}

// ============================================================================
// Validation Helpers
// ============================================================================

function validateVector(vector: number[]): void {
  if (vector.length !== 4) {
    throw new Error(`[Vector] Expected 4 dimensions, got ${vector.length}`);
  }
  for (const value of vector) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`[Vector] Contains non-finite value: ${value}`);
    }
    if (value < 0 || value > 1) {
      throw new Error(`[Vector] Values must be between 0 and 1, got ${value}`);
    }
  }
}

// ============================================================================
// Repository Functions
// ============================================================================

/**
 * Executes Tier 1 hard exclusion (NOT IN excludeRecipeIds) combined with
 * Tier 2 soft cosine distance matching via pgvector `<=>` operator.
 * 
 * Returns recipe IDs sorted by similarity score descending.
 * 
 * @param userVector - 4D vector [speed, minimalPrep, protein, lowCalorie]
 * @param limit - Maximum number of results to return (default 10)
 * @param excludeRecipeIds - Recipe IDs to exclude from results
 */
export async function findSimilarRecipes(
  userVector: number[],
  limit: number = 10,
  excludeRecipeIds: string[] = [],
): Promise<SimilarRecipeResult[]> {
  // Validate inputs
  validateVector(userVector);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error('[Vector] limit must be a positive integer');
  }

  // Build distance expression: attributeVector <=> userVector
  const distance = cosineDistance(recipeVectors.attributeVector, userVector);

  // Similarity = 1 - distance (higher is better)
  const similarity = sql<number>`1 - (${distance})`;

  // Build WHERE conditions (Tier 1 exclusion)
  const conditions = [];
  if (excludeRecipeIds.length > 0) {
    conditions.push(notInArray(recipeVectors.recipeId, excludeRecipeIds));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      recipeId: recipeVectors.recipeId,
      similarityScore: similarity,
    })
    .from(recipeVectors)
    .where(whereClause)
    .orderBy(asc(distance))
    .limit(limit);

  return rows;
}

/**
 * Atomically inserts or updates a recipe vector embedding.
 * Uses PostgreSQL `INSERT ... ON CONFLICT (recipe_id) DO UPDATE`.
 * 
 * @param recipeId - Target recipe ID (primary key on recipe_vectors)
 * @param attributeVector - 4D vector [speed, minimalPrep, protein, lowCalorie]
 */
export async function upsertRecipeVector(
  recipeId: string,
  attributeVector: number[],
): Promise<void> {
  // Validate inputs
  validateVector(attributeVector);
  if (!recipeId) {
    throw new Error('[Vector] recipeId is required');
  }

  await db
    .insert(recipeVectors)
    .values({
      recipeId,
      attributeVector,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: recipeVectors.recipeId,
      set: {
        attributeVector,
        updatedAt: new Date(),
      },
    });
}

/**
 * Merges primary user preferences with optional guest preferences.
 * Formula: U_eff = (U_primary + guestWeight * U_guest) / (1 + guestWeight)
 * Each dimension clamped to [0.0, 1.0].
 * 
 * @param primaryVector - 4D primary user vector
 * @param guestVector - Optional 4D guest vector
 * @param guestWeight - Weight applied to guest vector (default 0.5)
 * @returns Merged 4D vector clamped to [0,1]
 */
export function calculateEffectiveVector(
  primaryVector: number[],
  guestVector?: number[],
  guestWeight: number = 0.5,
): number[] {
  // Validate primary
  validateVector(primaryVector);

  // If no guest vector, return primary as-is
  if (!guestVector) {
    return [...primaryVector];
  }

  // Validate guest and weight
  validateVector(guestVector);
  if (typeof guestWeight !== 'number' || !Number.isFinite(guestWeight) || guestWeight < 0) {
    throw new Error('[Vector] guestWeight must be a non-negative finite number');
  }

  // Compute weighted average and clamp
  const denominator = 1 + guestWeight;
  return primaryVector.map((val, i) => {
    const merged = (val + guestWeight * guestVector[i]) / denominator;
    return Math.min(1, Math.max(0, merged));
  });
}
