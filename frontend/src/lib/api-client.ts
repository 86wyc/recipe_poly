// ============================================================================
// Type Definitions Matching Hono API Responses
// ============================================================================

export interface StepDependencyNode {
  step_id: string;
  action_type: string;
  description: string;
  is_passive: boolean;
  temp_celsius?: number;
  depends_on_step_ids: string[];
}

export interface RecipeRecord {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  heroImageUrl: string | null;
  baseServings: number;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  totalTimeMinutes: number;
  caloriesPerServing: number | null;
  proteinGrams: string | null; // numeric comes as string from PostgreSQL
  stepDependencyGraph: StepDependencyNode[];
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  id: string; // recipe_ingredients.id (join table ID)
  name: string;
  category: string | null;
  quantityBase: number;
  unit: string;
  notes: string | null;
  isOptional: boolean;
  scaledQuantity: number;
}

export interface RecipeVector {
  recipeId: string;
  attributeVector: number[]; // 4D [speed, minimalPrep, protein, lowCalorie]
  updatedAt: string;
}

export interface RecipeVariantSummary {
  id: string;
  title: string;
  slug: string;
  variantType: string;
  notes: string | null;
}

export interface RecipeWithDetails {
  recipe: RecipeRecord;
  ingredients: RecipeIngredient[];
  stepDependencyGraph: StepDependencyNode[];
  vector: RecipeVector | null;
  childVariants: RecipeVariantSummary[];
  parentVariant: RecipeVariantSummary | null;
}

export interface RecommendationRequest {
  primaryVector: [number, number, number, number];
  guestVector?: [number, number, number, number];
  guestWeight?: number;
  limit?: number;
  excludeRecipeIds?: string[];
}

export interface RecommendationResult {
  recipeId: string;
  similarityScore: number;
  recipe: RecipeWithDetails;
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
// Generic API Fetch Wrapper
// ============================================================================

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data || data.success === false) {
    const message =
      data?.error?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data.data as T;
}

// ============================================================================
// Exported API Functions
// ============================================================================

export async function getRecipeById(
  id: string,
  servings?: number,
): Promise<RecipeWithDetails> {
  const query = servings ? `?servings=${servings}` : '';
  return request<RecipeWithDetails>(`/recipes/${id}${query}`);
}

export async function getRecipeBySlug(
  slug: string,
  servings?: number,
): Promise<RecipeWithDetails> {
  const query = servings ? `?servings=${servings}` : '';
  return request<RecipeWithDetails>(`/recipes/slug/${slug}${query}`);
}

export async function getRecommendations(
  params: RecommendationRequest,
): Promise<RecommendationResult[]> {
  return request<RecommendationResult[]>('/recommendations', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getSubstitutions(
  ingredientIds: string[],
): Promise<IngredientSubstitutionResult[]> {
  return request<IngredientSubstitutionResult[]>('/substitutions', {
    method: 'POST',
    body: JSON.stringify({ ingredientIds }),
  });
}
