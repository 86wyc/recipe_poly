'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import {
  getRecipeBySlug,
  type RecipeWithDetails,
  type StepDependencyNode,
} from '@/lib/api-client';
import { MermaidChart } from '@/components/MermaidChart';

function buildMermaidChart(steps: StepDependencyNode[]): string {
  if (!steps.length) return 'graph TD\n  A[No steps]';
  let chart = 'graph TD\n';
  steps.forEach((step) => {
    const id = step.step_id.replace(/[^a-zA-Z0-9_]/g, '_');
    const label = step.description.replace(/"/g, "'");
    chart += `  ${id}["${label}"]\n`;
  });
  steps.forEach((step) => {
    const targetId = step.step_id.replace(/[^a-zA-Z0-9_]/g, '_');
    step.depends_on_step_ids.forEach((depId) => {
      const sourceId = depId.replace(/[^a-zA-Z0-9_]/g, '_');
      chart += `  ${sourceId} --> ${targetId}\n`;
    });
  });
  return chart;
}

export default function RecipeDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [recipe, setRecipe] = useState<RecipeWithDetails | null>(null);
  const [servings, setServings] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecipe = useCallback(
    async (targetServings: number) => {
      setLoading(true);
      setError(null);
      try {
        const data = await getRecipeBySlug(slug, targetServings);
        setRecipe(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recipe');
        setRecipe(null);
      } finally {
        setLoading(false);
      }
    },
    [slug]
  );

  useEffect(() => {
    fetchRecipe(servings);
  }, [fetchRecipe, servings]);

  const handleServingsChange = (newServings: number) => {
    if (newServings > 0) {
      setServings(newServings);
    }
  };

  if (loading && !recipe) {
    return <div className="p-8 text-center text-stone-500">Loading recipe...</div>;
  }

  if (error || !recipe) {
    return (
      <div className="p-8 text-center text-red-600">
        Error: {error || 'Recipe not found'}
      </div>
    );
  }

  const { recipe: r, ingredients, stepDependencyGraph } = recipe;

  return (
    <main className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-4xl bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        {r.heroImageUrl && (
          <div className="relative w-full h-72">
            <Image
              src={r.heroImageUrl}
              alt={r.title}
              fill
              sizes="100vw"
              className="object-cover"
            />
          </div>
        )}

        <div className="p-6 md:p-8">
          <h1 className="text-3xl font-bold text-stone-900 mb-2">{r.title}</h1>
          {r.description && <p className="text-stone-600 mb-6">{r.description}</p>}

          <div className="flex flex-wrap gap-4 text-sm text-stone-500 mb-6">
            <span>Prep: {r.prepTimeMinutes} min</span>
            <span>Cook: {r.cookTimeMinutes} min</span>
            <span>Total: {r.totalTimeMinutes} min</span>
            {r.caloriesPerServing && <span>{r.caloriesPerServing} kcal/serving</span>}
            {r.proteinGrams && <span>{r.proteinGrams}g protein</span>}
          </div>

          <div className="flex items-center gap-3 mb-8 bg-stone-100 p-4 rounded-lg">
            <label htmlFor="servings" className="font-medium text-stone-900">
              Servings:
            </label>
            <input
              id="servings"
              type="number"
              min={0.5}
              step={0.5}
              value={servings}
              onChange={(e) => handleServingsChange(Number(e.target.value))}
              className="w-24 px-3 py-2 border border-stone-300 rounded-md text-stone-900"
            />
          </div>

          <h2 className="text-xl font-semibold text-stone-900 mb-4">Ingredients</h2>
          <ul className="space-y-2 mb-8 fade-in" key={servings}>
            {ingredients.map((ing) => (
              <li key={ing.id} className="flex justify-between text-stone-700">
                <span>
                  {ing.isOptional && <span className="text-stone-400">(optional) </span>}
                  {ing.name}
                </span>
                <span className="font-medium">
                  {ing.scaledQuantity} {ing.unit}
                </span>
              </li>
            ))}
          </ul>

          <h2 className="text-xl font-semibold text-stone-900 mb-4">Steps</h2>
          <ol className="list-decimal list-inside space-y-2 mb-8">
            {stepDependencyGraph.map((step) => (
              <li key={step.step_id} className="text-stone-700">
                {step.description}
                {step.temp_celsius && (
                  <span className="text-sm text-stone-500"> ({step.temp_celsius}°C)</span>
                )}
              </li>
            ))}
          </ol>

          <h2 className="text-xl font-semibold text-stone-900 mb-4">Step Flow</h2>
          <MermaidChart graphDefinition={buildMermaidChart(stepDependencyGraph)} />
        </div>
      </div>
    </main>
  );
}
