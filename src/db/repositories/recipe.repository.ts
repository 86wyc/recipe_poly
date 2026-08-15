import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  doublePrecision,
  boolean,
  timestamp,
  jsonb,
  index,
  customType,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

/**
 * Custom Drizzle type binding for pgvector vector(4)
 */
export const vector4 = customType<{ data: number[] }>({
  dataType() {
    return 'vector(4)';
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: unknown): number[] {
    if (typeof value === 'string') {
      return JSON.parse(value);
    }
    return value as number[];
  },
});

/**
 * Step Node Interface for Step Dependency Graph (JSONB)
 */
export interface StepDependencyNode {
  step_id: string;
  action_type: string;
  description: string;
  is_passive: boolean;
  temp_celsius?: number;
  depends_on_step_ids: string[];
}

// ============================================================================
// 1. INGREDIENTS & SUBSTITUTIONS
// ============================================================================

export const ingredients = pgTable(
  'ingredients',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull().unique(),
    category: varchar('category', { length: 100 }),
    baseUnit: varchar('base_unit', { length: 50 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_ingredients_name').on(table.name),
  ]
);

export const ingredientSubstitutions = pgTable(
  'ingredient_substitutions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    originalIngredientId: uuid('original_ingredient_id')
      .notNull()
      .references(() => ingredients.id, { onDelete: 'cascade' }),
    substituteIngredientId: uuid('substitute_ingredient_id')
      .notNull()
      .references(() => ingredients.id, { onDelete: 'cascade' }),
    conversionRatio: doublePrecision('conversion_ratio').notNull().default(1.0),
    dietaryTags: text('dietary_tags').array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_substitutions_orig').on(table.originalIngredientId),
    index('idx_substitutions_sub').on(table.substituteIngredientId),
    index('idx_substitutions_tags').using('gin', table.dietaryTags),
  ]
);

// ============================================================================
// 2. RECIPES & VARIANTS
// ============================================================================

export const recipes = pgTable(
  'recipes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    description: text('description'),
    heroImageUrl: text('hero_image_url'),
    baseServings: integer('base_servings').notNull().default(1),
    prepTimeMinutes: integer('prep_time_minutes').notNull().default(0),
    cookTimeMinutes: integer('cook_time_minutes').notNull().default(0),
    totalTimeMinutes: integer('total_time_minutes').notNull().default(0),
    caloriesPerServing: integer('calories_per_serving'),
    proteinGrams: numeric('protein_grams', { precision: 6, scale: 2 }),
    
    stepDependencyGraph: jsonb('step_dependency_graph')
      .$type<StepDependencyNode[]>()
      .notNull()
      .default([]),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_recipes_slug').on(table.slug),
    index('idx_recipes_step_graph').using('gin', table.stepDependencyGraph),
  ]
);

export const recipeVariants = pgTable(
  'recipe_variants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    baseRecipeId: uuid('base_recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    variantRecipeId: uuid('variant_recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' })
      .unique(),
    variantType: varchar('variant_type', { length: 100 }).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_recipe_variants_base').on(table.baseRecipeId),
    index('idx_recipe_variants_variant').on(table.variantRecipeId),
  ]
);

export const recipeIngredients = pgTable(
  'recipe_ingredients',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    ingredientId: uuid('ingredient_id')
      .notNull()
      .references(() => ingredients.id, { onDelete: 'restrict' }),
    
    quantityBase: doublePrecision('quantity_base').notNull(),
    unit: varchar('unit', { length: 50 }).notNull(),
    notes: text('notes'),
    isOptional: boolean('is_optional').notNull().default(false),
  },
  (table) => [
    index('idx_recipe_ingredients_recipe').on(table.recipeId),
    index('idx_recipe_ingredients_ingredient').on(table.ingredientId),
    index('idx_recipe_ingredients_recipe_ingredient').on(
      table.recipeId,
      table.ingredientId
    ),
  ]
);

// ============================================================================
// 3. RECOMMENDATION ENGINE (pgvector 4D)
// ============================================================================

export const recipeVectors = pgTable(
  'recipe_vectors',
  {
    recipeId: uuid('recipe_id')
      .primaryKey()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    
    attributeVector: vector4('attribute_vector').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_recipe_vectors_ivfflat')
      .using('ivfflat', table.attributeVector.op('vector_cosine_ops'))
      .with({ lists: 1 }),
  ]
);

// ============================================================================
// DRIZZLE RELATIONS DEFINITIONS
// ============================================================================

export const ingredientsRelations = relations(ingredients, ({ many }) => ({
  recipeIngredients: many(recipeIngredients),
  substitutesFor: many(ingredientSubstitutions, { relationName: 'original_ingredient' }),
  asSubstitute: many(ingredientSubstitutions, { relationName: 'substitute_ingredient' }),
}));

export const ingredientSubstitutionsRelations = relations(ingredientSubstitutions, ({ one }) => ({
  originalIngredient: one(ingredients, {
    fields: [ingredientSubstitutions.originalIngredientId],
    references: [ingredients.id],
    relationName: 'original_ingredient',
  }),
  substituteIngredient: one(ingredients, {
    fields: [ingredientSubstitutions.substituteIngredientId],
    references: [ingredients.id],
    relationName: 'substitute_ingredient',
  }),
}));

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  ingredients: many(recipeIngredients),
  vector: one(recipeVectors, {
    fields: [recipes.id],
    references: [recipeVectors.recipeId],
  }),
  childVariants: many(recipeVariants, { relationName: 'base_recipe' }),
  parentVariant: one(recipeVariants, {
    fields: [recipes.id],
    references: [recipeVariants.variantRecipeId],
    relationName: 'variant_recipe',
  }),
}));

export const recipeVariantsRelations = relations(recipeVariants, ({ one }) => ({
  baseRecipe: one(recipes, {
    fields: [recipeVariants.baseRecipeId],
    references: [recipes.id],
    relationName: 'base_recipe',
  }),
  variantRecipe: one(recipes, {
    fields: [recipeVariants.variantRecipeId],
    references: [recipes.id],
    relationName: 'variant_recipe',
  }),
}));

export const recipeIngredientsRelations = relations(recipeIngredients, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeIngredients.recipeId],
    references: [recipes.id],
  }),
  ingredient: one(ingredients, {
    fields: [recipeIngredients.ingredientId],
    references: [ingredients.id],
  }),
}));

export const recipeVectorsRelations = relations(recipeVectors, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeVectors.recipeId],
    references: [recipes.id],
  }),
}));
