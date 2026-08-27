"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubstitutionInputSchema = exports.RecommendationInputSchema = exports.CreateRecipeInputSchema = exports.StepDependencyNodeSchema = void 0;
var zod_1 = require("zod");
// ============================================================================
// Step Dependency Node Schema (snake_case per src/db/schema.ts)
// ============================================================================
exports.StepDependencyNodeSchema = zod_1.z.object({
    step_id: zod_1.z.string().min(1).max(255),
    action_type: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().min(1),
    is_passive: zod_1.z.boolean(),
    temp_celsius: zod_1.z.number().min(-273.15).max(500).optional(),
    depends_on_step_ids: zod_1.z.array(zod_1.z.string().min(1)).default([]),
});
// ============================================================================
// Create Recipe Input Schema (POST /api/recipes)
// ============================================================================
exports.CreateRecipeInputSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(255),
    slug: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().optional(),
    heroImageUrl: zod_1.z.string().url().optional(),
    baseServings: zod_1.z.number().int().positive().default(1),
    prepTimeMinutes: zod_1.z.number().int().nonnegative().default(0),
    cookTimeMinutes: zod_1.z.number().int().nonnegative().default(0),
    totalTimeMinutes: zod_1.z.number().int().nonnegative().default(0),
    caloriesPerServing: zod_1.z.number().int().nonnegative().optional(),
    proteinGrams: zod_1.z.number().nonnegative().optional(),
    stepDependencyGraph: zod_1.z.array(exports.StepDependencyNodeSchema).default([]),
    ingredients: zod_1.z
        .array(zod_1.z.object({
        ingredientId: zod_1.z.string().uuid(),
        quantityBase: zod_1.z.number().positive(),
        unit: zod_1.z.string().min(1).max(50),
        notes: zod_1.z.string().optional(),
        isOptional: zod_1.z.boolean().default(false),
    }))
        .min(1, 'At least one ingredient is required'),
    attributeVector: zod_1.z.tuple([
        zod_1.z.number().min(0).max(1),
        zod_1.z.number().min(0).max(1),
        zod_1.z.number().min(0).max(1),
        zod_1.z.number().min(0).max(1),
    ]),
});
// ============================================================================
// Recommendation Input Schema (POST /api/recommendations)
// ============================================================================
exports.RecommendationInputSchema = zod_1.z.object({
    primaryVector: zod_1.z.tuple([
        zod_1.z.number().min(0).max(1),
        zod_1.z.number().min(0).max(1),
        zod_1.z.number().min(0).max(1),
        zod_1.z.number().min(0).max(1),
    ]),
    guestVector: zod_1.z
        .tuple([
        zod_1.z.number().min(0).max(1),
        zod_1.z.number().min(0).max(1),
        zod_1.z.number().min(0).max(1),
        zod_1.z.number().min(0).max(1),
    ])
        .optional(),
    guestWeight: zod_1.z.number().min(0).max(1).default(0.5),
    limit: zod_1.z.number().int().positive().default(10),
    excludeRecipeIds: zod_1.z.array(zod_1.z.string().uuid()).default([]),
});
// ============================================================================
// Substitution Input Schema (POST /api/substitutions)
// ============================================================================
exports.SubstitutionInputSchema = zod_1.z.object({
    ingredientIds: zod_1.z.array(zod_1.z.string().uuid()).min(1),
});
