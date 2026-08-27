import { z } from 'zod';

// ============================================================================
// Step Dependency Node Schema (snake_case per src/db/schema.ts)
// ============================================================================

export const StepDependencyNodeSchema = z.object({
  step_id: z.string().min(1).max(255),
  action_type: z.string().min(1).max(255),
  description: z.string().min(1),
  is_passive: z.boolean(),
  temp_celsius: z.number().min(-273.15).max(500).optional(),
  depends_on_step_ids: z.array(z.string().min(1)).default([]),
});

// ============================================================================
// Create Recipe Input Schema (POST /api/recipes)
// ============================================================================

export const CreateRecipeInputSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().optional(),
  heroImageUrl: z.string().url().optional(),
  baseServings: z.number().int().positive().default(1),
  prepTimeMinutes: z.number().int().nonnegative().default(0),
  cookTimeMinutes: z.number().int().nonnegative().default(0),
  totalTimeMinutes: z.number().int().nonnegative().default(0),
  caloriesPerServing: z.number().int().nonnegative().optional(),
  proteinGrams: z.number().nonnegative().optional(),
  stepDependencyGraph: z.array(StepDependencyNodeSchema).default([]),
  ingredients: z
    .array(
      z.object({
        ingredientId: z.string().uuid(),
        quantityBase: z.number().positive(),
        unit: z.string().min(1).max(50),
        notes: z.string().optional(),
        isOptional: z.boolean().default(false),
      })
    )
    .min(1, 'At least one ingredient is required'),
  attributeVector: z.tuple([
    z.number().min(0).max(1),
    z.number().min(0).max(1),
    z.number().min(0).max(1),
    z.number().min(0).max(1),
  ]),
});

// ============================================================================
// Recommendation Input Schema (POST /api/recommendations)
// ============================================================================

export const RecommendationInputSchema = z.object({
  primaryVector: z.tuple([
    z.number().min(0).max(1),
    z.number().min(0).max(1),
    z.number().min(0).max(1),
    z.number().min(0).max(1),
  ]),
  guestVector: z
    .tuple([
      z.number().min(0).max(1),
      z.number().min(0).max(1),
      z.number().min(0).max(1),
      z.number().min(0).max(1),
    ])
    .optional(),
  guestWeight: z.number().min(0).max(1).default(0.5),
  limit: z.number().int().positive().default(10),
  excludeRecipeIds: z.array(z.string().uuid()).default([]),
});

// ============================================================================
// Substitution Input Schema (POST /api/substitutions)
// ============================================================================

export const SubstitutionInputSchema = z.object({
  ingredientIds: z.array(z.string().uuid()).min(1),
});

// ============================================================================
// Exported Inferred Types
// ============================================================================

export type CreateRecipeInput = z.infer<typeof CreateRecipeInputSchema>;
export type RecommendationInput = z.infer<typeof RecommendationInputSchema>;
export type SubstitutionInput = z.infer<typeof SubstitutionInputSchema>;
