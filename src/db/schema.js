"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recipeVectorsRelations = exports.recipeIngredientsRelations = exports.recipeVariantsRelations = exports.recipesRelations = exports.ingredientSubstitutionsRelations = exports.ingredientsRelations = exports.recipeVectors = exports.recipeIngredients = exports.recipeVariants = exports.recipes = exports.ingredientSubstitutions = exports.ingredients = exports.vector4 = void 0;
var pg_core_1 = require("drizzle-orm/pg-core");
var drizzle_orm_1 = require("drizzle-orm");
/**
 * Custom Drizzle type binding for pgvector vector(4)
 */
exports.vector4 = (0, pg_core_1.customType)({
    dataType: function () {
        return 'vector(4)';
    },
    toDriver: function (value) {
        return JSON.stringify(value);
    },
    fromDriver: function (value) {
        if (typeof value === 'string') {
            return JSON.parse(value);
        }
        return value;
    },
});
// ============================================================================
// 1. INGREDIENTS & SUBSTITUTIONS
// ============================================================================
exports.ingredients = (0, pg_core_1.pgTable)('ingredients', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull().unique(),
    category: (0, pg_core_1.varchar)('category', { length: 100 }),
    baseUnit: (0, pg_core_1.varchar)('base_unit', { length: 50 }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
}, function (table) { return [
    (0, pg_core_1.index)('idx_ingredients_name').on(table.name),
]; });
exports.ingredientSubstitutions = (0, pg_core_1.pgTable)('ingredient_substitutions', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    originalIngredientId: (0, pg_core_1.uuid)('original_ingredient_id')
        .notNull()
        .references(function () { return exports.ingredients.id; }, { onDelete: 'cascade' }),
    substituteIngredientId: (0, pg_core_1.uuid)('substitute_ingredient_id')
        .notNull()
        .references(function () { return exports.ingredients.id; }, { onDelete: 'cascade' }),
    conversionRatio: (0, pg_core_1.doublePrecision)('conversion_ratio').notNull().default(1.0),
    dietaryTags: (0, pg_core_1.text)('dietary_tags').array().notNull().default((0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["'{}'::text[]"], ["'{}'::text[]"])))),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
}, function (table) { return [
    (0, pg_core_1.index)('idx_substitutions_orig').on(table.originalIngredientId),
    (0, pg_core_1.index)('idx_substitutions_sub').on(table.substituteIngredientId),
    (0, pg_core_1.index)('idx_substitutions_tags').using('gin', table.dietaryTags),
]; });
// ============================================================================
// 2. RECIPES & VARIANTS
// ============================================================================
exports.recipes = (0, pg_core_1.pgTable)('recipes', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    title: (0, pg_core_1.varchar)('title', { length: 255 }).notNull(),
    slug: (0, pg_core_1.varchar)('slug', { length: 255 }).notNull().unique(),
    description: (0, pg_core_1.text)('description'),
    heroImageUrl: (0, pg_core_1.text)('hero_image_url'),
    baseServings: (0, pg_core_1.integer)('base_servings').notNull().default(1),
    prepTimeMinutes: (0, pg_core_1.integer)('prep_time_minutes').notNull().default(0),
    cookTimeMinutes: (0, pg_core_1.integer)('cook_time_minutes').notNull().default(0),
    totalTimeMinutes: (0, pg_core_1.integer)('total_time_minutes').notNull().default(0),
    caloriesPerServing: (0, pg_core_1.integer)('calories_per_serving'),
    proteinGrams: (0, pg_core_1.numeric)('protein_grams', { precision: 6, scale: 2 }),
    stepDependencyGraph: (0, pg_core_1.jsonb)('step_dependency_graph')
        .$type()
        .notNull()
        .default([]),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, function (table) { return [
    (0, pg_core_1.index)('idx_recipes_slug').on(table.slug),
    (0, pg_core_1.index)('idx_recipes_step_graph').using('gin', table.stepDependencyGraph),
]; });
exports.recipeVariants = (0, pg_core_1.pgTable)('recipe_variants', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    baseRecipeId: (0, pg_core_1.uuid)('base_recipe_id')
        .notNull()
        .references(function () { return exports.recipes.id; }, { onDelete: 'cascade' }),
    variantRecipeId: (0, pg_core_1.uuid)('variant_recipe_id')
        .notNull()
        .references(function () { return exports.recipes.id; }, { onDelete: 'cascade' })
        .unique(),
    variantType: (0, pg_core_1.varchar)('variant_type', { length: 100 }).notNull(),
    notes: (0, pg_core_1.text)('notes'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
}, function (table) { return [
    (0, pg_core_1.index)('idx_recipe_variants_base').on(table.baseRecipeId),
    (0, pg_core_1.index)('idx_recipe_variants_variant').on(table.variantRecipeId),
]; });
exports.recipeIngredients = (0, pg_core_1.pgTable)('recipe_ingredients', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    recipeId: (0, pg_core_1.uuid)('recipe_id')
        .notNull()
        .references(function () { return exports.recipes.id; }, { onDelete: 'cascade' }),
    ingredientId: (0, pg_core_1.uuid)('ingredient_id')
        .notNull()
        .references(function () { return exports.ingredients.id; }, { onDelete: 'restrict' }),
    quantityBase: (0, pg_core_1.doublePrecision)('quantity_base').notNull(),
    unit: (0, pg_core_1.varchar)('unit', { length: 50 }).notNull(),
    notes: (0, pg_core_1.text)('notes'),
    isOptional: (0, pg_core_1.boolean)('is_optional').notNull().default(false),
}, function (table) { return [
    (0, pg_core_1.index)('idx_recipe_ingredients_recipe').on(table.recipeId),
    (0, pg_core_1.index)('idx_recipe_ingredients_ingredient').on(table.ingredientId),
    (0, pg_core_1.index)('idx_recipe_ingredients_recipe_ingredient').on(table.recipeId, table.ingredientId),
]; });
// ============================================================================
// 3. RECOMMENDATION ENGINE (pgvector 4D)
// ============================================================================
exports.recipeVectors = (0, pg_core_1.pgTable)('recipe_vectors', {
    recipeId: (0, pg_core_1.uuid)('recipe_id')
        .primaryKey()
        .references(function () { return exports.recipes.id; }, { onDelete: 'cascade' }),
    attributeVector: (0, exports.vector4)('attribute_vector').notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, function (table) { return [
    (0, pg_core_1.index)('idx_recipe_vectors_ivfflat')
        .using('ivfflat', table.attributeVector.op('vector_cosine_ops'))
        .with({ lists: 1 }),
]; });
// ============================================================================
// DRIZZLE RELATIONS DEFINITIONS
// ============================================================================
exports.ingredientsRelations = (0, drizzle_orm_1.relations)(exports.ingredients, function (_a) {
    var many = _a.many;
    return ({
        recipeIngredients: many(exports.recipeIngredients),
        substitutesFor: many(exports.ingredientSubstitutions, { relationName: 'original_ingredient' }),
        asSubstitute: many(exports.ingredientSubstitutions, { relationName: 'substitute_ingredient' }),
    });
});
exports.ingredientSubstitutionsRelations = (0, drizzle_orm_1.relations)(exports.ingredientSubstitutions, function (_a) {
    var one = _a.one;
    return ({
        originalIngredient: one(exports.ingredients, {
            fields: [exports.ingredientSubstitutions.originalIngredientId],
            references: [exports.ingredients.id],
            relationName: 'original_ingredient',
        }),
        substituteIngredient: one(exports.ingredients, {
            fields: [exports.ingredientSubstitutions.substituteIngredientId],
            references: [exports.ingredients.id],
            relationName: 'substitute_ingredient',
        }),
    });
});
exports.recipesRelations = (0, drizzle_orm_1.relations)(exports.recipes, function (_a) {
    var one = _a.one, many = _a.many;
    return ({
        ingredients: many(exports.recipeIngredients),
        vector: one(exports.recipeVectors, {
            fields: [exports.recipes.id],
            references: [exports.recipeVectors.recipeId],
        }),
        childVariants: many(exports.recipeVariants, { relationName: 'base_recipe' }),
        parentVariant: one(exports.recipeVariants, {
            fields: [exports.recipes.id],
            references: [exports.recipeVariants.variantRecipeId],
            relationName: 'variant_recipe',
        }),
    });
});
exports.recipeVariantsRelations = (0, drizzle_orm_1.relations)(exports.recipeVariants, function (_a) {
    var one = _a.one;
    return ({
        baseRecipe: one(exports.recipes, {
            fields: [exports.recipeVariants.baseRecipeId],
            references: [exports.recipes.id],
            relationName: 'base_recipe',
        }),
        variantRecipe: one(exports.recipes, {
            fields: [exports.recipeVariants.variantRecipeId],
            references: [exports.recipes.id],
            relationName: 'variant_recipe',
        }),
    });
});
exports.recipeIngredientsRelations = (0, drizzle_orm_1.relations)(exports.recipeIngredients, function (_a) {
    var one = _a.one;
    return ({
        recipe: one(exports.recipes, {
            fields: [exports.recipeIngredients.recipeId],
            references: [exports.recipes.id],
        }),
        ingredient: one(exports.ingredients, {
            fields: [exports.recipeIngredients.ingredientId],
            references: [exports.ingredients.id],
        }),
    });
});
exports.recipeVectorsRelations = (0, drizzle_orm_1.relations)(exports.recipeVectors, function (_a) {
    var one = _a.one;
    return ({
        recipe: one(exports.recipes, {
            fields: [exports.recipeVectors.recipeId],
            references: [exports.recipes.id],
        }),
    });
});
var templateObject_1;
