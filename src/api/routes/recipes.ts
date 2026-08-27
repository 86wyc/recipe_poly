import { Hono } from 'hono';
import {
  getRecipeById,
  getRecipeBySlug,
  createRecipe,
  getIngredientSubstitutions,
} from '../../db/repositories/recipe.repository';
import {
  findSimilarRecipes,
  calculateEffectiveVector,
} from '../../db/repositories/vector.repository';
import {
  CreateRecipeInputSchema,
  RecommendationInputSchema,
  SubstitutionInputSchema,
} from '../validation/schemas';
import { ApiError } from '../errors';

// ============================================================================
// Recipe CRUD Router (mounted at /api/recipes)
// ============================================================================

export const recipesRouter = new Hono();

function parseServings(query: string | undefined): number {
  const raw = query ?? '1';
  const servings = Number(raw);
  if (!Number.isFinite(servings) || servings <= 0) {
    throw new ApiError(400, 'servings must be a positive number');
  }
  return servings;
}

function parseUuid(id: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    throw new ApiError(400, 'Invalid recipe ID format. Expected UUID.');
  }
  return id;
}

recipesRouter.get('/:id', async (c) => {
  const id = parseUuid(c.req.param('id'));
  const servings = parseServings(c.req.query('servings'));

  const recipe = await getRecipeById(id, servings);
  if (!recipe) {
    throw new ApiError(404, 'Recipe not found');
  }

  return c.json({ success: true, data: recipe });
});

recipesRouter.get('/slug/:slug', async (c) => {
  const slug = c.req.param('slug');
  const servings = parseServings(c.req.query('servings'));

  const recipe = await getRecipeBySlug(slug, servings);
  if (!recipe) {
    throw new ApiError(404, 'Recipe not found');
  }

  return c.json({ success: true, data: recipe });
});

recipesRouter.post('/', async (c) => {
  const payload = CreateRecipeInputSchema.parse(await c.req.json());
  const recipeId = await createRecipe(payload);

  return c.json({ success: true, recipeId }, 201);
});

// ============================================================================
// Recommendation & Substitution Router (mounted at /api)
// ============================================================================

export const recommendationRouter = new Hono();

recommendationRouter.post('/recommendations', async (c) => {
  const body = RecommendationInputSchema.parse(await c.req.json());

  const effectiveVector = calculateEffectiveVector(
    body.primaryVector,
    body.guestVector,
    body.guestWeight,
  );

  const similarResults = await findSimilarRecipes(
    effectiveVector,
    body.limit,
    body.excludeRecipeIds,
  );

  const hydrated = await Promise.all(
    similarResults.map(async ({ recipeId, similarityScore }) => {
      const recipe = await getRecipeById(recipeId);
      return recipe ? { recipeId, similarityScore, recipe } : null;
    }),
  );

  const finalResults = hydrated.filter(
    (item): item is { recipeId: string; similarityScore: number; recipe: NonNullable<Awaited<ReturnType<typeof getRecipeById>>> } =>
      item !== null,
  );

  return c.json({ success: true, data: finalResults });
});

recommendationRouter.post('/substitutions', async (c) => {
  const body = SubstitutionInputSchema.parse(await c.req.json());
  const substitutions = await getIngredientSubstitutions(body.ingredientIds);

  return c.json({ success: true, data: substitutions });
});
