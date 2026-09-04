'use client';

import Image from 'next/image';
import type { RecommendationResult } from '@/lib/api-client';

function getDietaryTags(attributeVector: number[] | undefined): string[] {
  if (!attributeVector) return [];
  const tags: string[] = [];
  const [speed, minimalPrep, protein, lowCalorie] = attributeVector;
  if (protein > 0.7) tags.push('High Protein');
  if (lowCalorie > 0.7) tags.push('Low Calorie');
  if (speed > 0.7) tags.push('Quick');
  if (minimalPrep > 0.7) tags.push('Easy Prep');
  return tags;
}

export function RecipeCard({ result }: { result: RecommendationResult }) {
  const { recipe, similarityScore } = result;
  const tags = getDietaryTags(recipe.vector?.attributeVector);

  return (
    <a
      href={`/recipes/${recipe.recipe.slug}`}
      className="block bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden hover:shadow-md transition-shadow"
    >
      {recipe.recipe.heroImageUrl && (
        <div className="relative w-full h-48">
          <Image
            src={recipe.recipe.heroImageUrl}
            alt={recipe.recipe.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
          />
        </div>
      )}
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-lg font-semibold text-stone-900 leading-tight">
            {recipe.recipe.title}
          </h2>
          <span className="ml-2 px-2 py-1 bg-stone-900 text-white text-xs rounded-full whitespace-nowrap">
            {Math.round(similarityScore * 100)}% match
          </span>
        </div>

        {/* Dietary Tag Pills */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-stone-100 text-stone-700 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <p className="text-sm text-stone-600 line-clamp-2 mb-3">
          {recipe.recipe.description || 'No description available.'}
        </p>
        <div className="flex flex-wrap gap-2 text-xs text-stone-500">
          <span>{recipe.recipe.totalTimeMinutes} min</span>
          <span>•</span>
          <span>{recipe.recipe.caloriesPerServing ?? '?'} kcal</span>
          <span>•</span>
          <span>{recipe.ingredients.length} ingredients</span>
        </div>
      </div>
    </a>
  );
}
