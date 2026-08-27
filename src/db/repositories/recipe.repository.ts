import { eq, inArray, asc, aliasedTable, type SQL } from 'drizzle-orm';
import { db } from '../connection';
import {
  recipes,
  recipeIngredients,
  ingredients,
  recipeVariants,
  recipeVectors,
  ingredientSubstitutions,
  type StepDependencyNode,
} from '../schema';
import type { InferSelectModel } from 'drizzle-orm';
import { uuidParam } from '../helpers/sql';

// ============================================================================
// Type Definitions
// ============================================================================

export type RecipeRecord = InferSelectModel<typeof recipes>;
export type RecipeIngredientRecord = InferSelectModel<typeof recipeIngredients>;
export type IngredientRecord = InferSelectModel<typeof ingredients>;
export type RecipeVariantRecord = InferSelectModel<typeof recipeVariants>;
export type RecipeVectorRecord = InferSelectModel<typeof recipeVectors>;
export type IngredientSubstitutionRecord = InferSelectModel<typeof ingredientSubstitutions>;

export interface RecipeWithDetails {
  recipe: RecipeRecord;
  ingredients: Array<{
    id: string;
    name: string;
    category: string | null;
    quantityBase: number;
    scaledQuantity: number;
    unit: string;
    notes: string | null;
    isOptional: boolean;
  }>;
  stepDependencyGraph: StepDependencyNode[];
  vector: RecipeVectorRecord | null;
  childVariants: Array<{
    id: string;
    title: string;
    slug: string;
    variantType: string;
    notes: string | null;
  }>;
  parentVariant: {
    id: string;
    title: string;
    slug: string;
    variantType: string;
    notes: string | null;
  } | null;
}

export interface CreateRecipeInput {
  title: string;
  slug: string;
  description?: string;
  heroImageUrl?: string;
  baseServings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  caloriesPerServing?: number;
  proteinGrams?: number;
  stepDependencyGraph: StepDependencyNode[];
  ingredients: Array<{
    ingredientId: string;
    quantityBase: number;
    unit: string;
    notes?: string;
    isOptional?: boolean;
  }>;
  attributeVector: [number, number, number, number];
}

export interface IngredientSubstitutionResult {
  originalIngredientId: string;
  originalIngredientName: string;
  substituteIngredientId: string;
  substituteIngredientName: string;
  conversionRatio: number;
  dietaryTags: string[];
}

// ============================================================================
// Validation Helpers
// ============================================================================

function validateStepDependencyGraph(graph: StepDependencyNode[]): void {
  if (!Array.isArray(graph)) {
    throw new Error('[Recipe] stepDependencyGraph must be an array');
  }

  const stepIds = new Set<string>();

  for (const node of graph) {
    // snake_case properties from StepDependencyNode interface
    if (!node.step_id || typeof node.step_id !== 'string') {
      throw new Error('[Recipe] Each step node requires a string step_id');
    }
    if (node.step_id.length > 255) {
      throw new Error('[Recipe] step_id exceeds 255 character limit');
    }
    if (!node.action_type || typeof node.action_type !== 'string') {
      throw new Error('[Recipe] Each step node requires a string action_type');
    }
    if (typeof node.description !== 'string') {
      throw new Error('[Recipe] Each step node requires a string description');
    }
    if (typeof node.is_passive !== 'boolean') {
      throw new Error('[Recipe] Each step node requires a boolean is_passive');
    }
    if (!Array.isArray(node.depends_on_step_ids)) {
      throw new Error('[Recipe] Each step node requires depends_on_step_ids array');
    }

    if (stepIds.has(node.step_id)) {
      throw new Error(`[Recipe] Duplicate step_id found: ${node.step_id}`);
    }
    stepIds.add(node.step_id);

    if (node.temp_celsius !== undefined && node.temp_celsius !== null) {
      if (typeof node.temp_celsius !== 'number' || !Number.isFinite(node.temp_celsius)) {
        throw new Error(`[Recipe] Invalid temp_celsius for step ${node.step_id}`);
      }
      if (node.temp_celsius < -273.15 || node.temp_celsius > 500) {
        throw new Error(
          `[Recipe] temp_celsius out of range for step ${node.step_id}: ${node.temp_celsius}`
        );
      }
    }
  }

  // Validate dependency references
  for (const node of graph) {
    for (const depId of node.depends_on_step_ids) {
      if (!stepIds.has(depId)) {
        throw new Error(
          `[Recipe] Step ${node.step_id} references non-existent dependency: ${depId}`
        );
      }
      if (depId === node.step_id) {
        throw new Error(`[Recipe] Step ${node.step_id} cannot depend on itself`);
      }
    }
  }

  // Cycle detection (DFS)
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function hasCycle(stepId: string): boolean {
    if (visiting.has(stepId)) return true;
    if (visited.has(stepId)) return false;

    visiting.add(stepId);

    const node = graph.find((n) => n.step_id === stepId);
    if (node) {
      for (const depId of node.depends_on_step_ids) {
        if (hasCycle(depId)) return true;
      }
    }

    visiting.delete(stepId);
    visited.add(stepId);
    return false;
  }

  for (const node of graph) {
    if (hasCycle(node.step_id)) {
      throw new Error(`[Recipe] Cycle detected in step dependency graph at step ${node.step_id}`);
    }
  }
}

function validateAttributeVector(vector: number[]): void {
  if (vector.length !== 4) {
    throw new Error(`[Recipe] attributeVector must have exactly 4 dimensions, got ${vector.length}`);
  }
  for (const value of vector) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`[Recipe] attributeVector contains non-finite value: ${value}`);
    }
    if (value < 0 || value > 1) {
      throw new Error(`[Recipe] attributeVector values must be between 0 and 1, got ${value}`);
    }
  }
}

// ============================================================================
// Shared Query Builder
// ============================================================================

async function buildRecipeWithDetails(
  whereClause: SQL,
  targetServings: number,
): Promise<RecipeWithDetails | null> {
  const [recipe] = await db.select().from(recipes).where(whereClause).limit(1);

  if (!recipe) {
    return null;
  }

  const [ingredientRows, vectorRows, childVariantRows, parentVariantRows] = await Promise.all([
    db
      .select({
        id: recipeIngredients.id,
        name: ingredients.name,
        category: ingredients.category,
        quantityBase: recipeIngredients.quantityBase,
        unit: recipeIngredients.unit,
        notes: recipeIngredients.notes,
        isOptional: recipeIngredients.isOptional,
      })
      .from(recipeIngredients)
      .innerJoin(ingredients, eq(recipeIngredients.ingredientId, ingredients.id))
      .where(eq(recipeIngredients.recipeId, uuidParam(recipe.id)))
      .orderBy(asc(ingredients.name)),

    db
      .select()
      .from(recipeVectors)
      .where(eq(recipeVectors.recipeId, uuidParam(recipe.id)))
      .limit(1),

    db
      .select({
        id: recipes.id,
        title: recipes.title,
        slug: recipes.slug,
        variantType: recipeVariants.variantType,
        notes: recipeVariants.notes,
      })
      .from(recipeVariants)
      .innerJoin(recipes, eq(recipeVariants.variantRecipeId, recipes.id))
      .where(eq(recipeVariants.baseRecipeId, uuidParam(recipe.id)))
      .orderBy(asc(recipes.title)),

    db
      .select({
        id: recipes.id,
        title: recipes.title,
        slug: recipes.slug,
        variantType: recipeVariants.variantType,
        notes: recipeVariants.notes,
      })
      .from(recipeVariants)
      .innerJoin(recipes, eq(recipeVariants.baseRecipeId, recipes.id))
      .where(eq(recipeVariants.variantRecipeId, uuidParam(recipe.id)))
      .limit(1),
  ]);

  const scaledIngredients = ingredientRows.map((ing) => ({
    ...ing,
    scaledQuantity: ing.quantityBase * targetServings,
  }));

  return {
    recipe,
    ingredients: scaledIngredients,
    stepDependencyGraph: recipe.stepDependencyGraph,
    vector: vectorRows[0] ?? null,
    childVariants: childVariantRows,
    parentVariant: parentVariantRows[0] ?? null,
  };
}

// ============================================================================
// Repository Functions
// ============================================================================

export async function getRecipeById(
  id: string,
  targetServings: number = 1,
): Promise<RecipeWithDetails | null> {
  if (targetServings <= 0) {
    throw new Error('[Recipe] targetServings must be greater than 0');
  }
  return buildRecipeWithDetails(eq(recipes.id, uuidParam(id)), targetServings);
}

export async function getRecipeBySlug(
  slug: string,
  targetServings: number = 1,
): Promise<RecipeWithDetails | null> {
  if (targetServings <= 0) {
    throw new Error('[Recipe] targetServings must be greater than 0');
  }
  return buildRecipeWithDetails(eq(recipes.slug, slug), targetServings);
}

export async function getIngredientSubstitutions(
  ingredientIds: string[],
): Promise<IngredientSubstitutionResult[]> {
  if (ingredientIds.length === 0) {
    return [];
  }

  const originalIngredients = aliasedTable(ingredients, 'original_ingredients');
  const substituteIngredients = aliasedTable(ingredients, 'substitute_ingredients');

  return db
    .select({
      originalIngredientId: ingredientSubstitutions.originalIngredientId,
      originalIngredientName: originalIngredients.name,
      substituteIngredientId: ingredientSubstitutions.substituteIngredientId,
      substituteIngredientName: substituteIngredients.name,
      conversionRatio: ingredientSubstitutions.conversionRatio,
      dietaryTags: ingredientSubstitutions.dietaryTags,
    })
    .from(ingredientSubstitutions)
    .innerJoin(
      originalIngredients,
      eq(ingredientSubstitutions.originalIngredientId, originalIngredients.id),
    )
    .innerJoin(
      substituteIngredients,
      eq(ingredientSubstitutions.substituteIngredientId, substituteIngredients.id),
    )
    .where(inArray(ingredientSubstitutions.originalIngredientId, ingredientIds));
}

export async function createRecipe(input: CreateRecipeInput): Promise<string> {
  validateStepDependencyGraph(input.stepDependencyGraph);
  validateAttributeVector(input.attributeVector);

  if (!input.title || input.title.length === 0 || input.title.length > 255) {
    throw new Error('[Recipe] title must be between 1 and 255 characters');
  }
  if (!input.slug || input.slug.length === 0 || input.slug.length > 255) {
    throw new Error('[Recipe] slug must be between 1 and 255 characters');
  }
  if (input.ingredients.length === 0) {
    throw new Error('[Recipe] At least one ingredient is required');
  }

  return db.transaction(async (tx) => {
    const [insertedRecipe] = await tx
      .insert(recipes)
      .values({
        title: input.title,
        slug: input.slug,
        description: input.description,
        heroImageUrl: input.heroImageUrl,
        baseServings: input.baseServings ?? 1,
        prepTimeMinutes: input.prepTimeMinutes ?? 0,
        cookTimeMinutes: input.cookTimeMinutes ?? 0,
        totalTimeMinutes: input.totalTimeMinutes ?? 0,
        caloriesPerServing: input.caloriesPerServing,
        proteinGrams: input.proteinGrams?.toString(),
        stepDependencyGraph: input.stepDependencyGraph,
      })
      .returning({ id: recipes.id });

    const recipeId = insertedRecipe.id;

    await tx.insert(recipeIngredients).values(
      input.ingredients.map((ing) => ({
        recipeId: recipeId,
        ingredientId: ing.ingredientId,
        quantityBase: ing.quantityBase,
        unit: ing.unit,
        notes: ing.notes,
        isOptional: ing.isOptional ?? false,
      })),
    );

    await tx.insert(recipeVectors).values({
      recipeId: recipeId,
      attributeVector: input.attributeVector,
    });

    return recipeId;
  });
}

export function scaleIngredientQuantity(
  quantityBase: number,
  targetServings: number,
): number {
  if (targetServings <= 0) {
    throw new Error('[Recipe] targetServings must be greater than 0');
  }
  if (quantityBase < 0) {
    throw new Error('[Recipe] quantityBase cannot be negative');
  }
  return quantityBase * targetServings;
}
