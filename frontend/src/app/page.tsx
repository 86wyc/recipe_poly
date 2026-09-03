'use client';

import { useState, useEffect } from 'react';
import { getRecommendations, type RecommendationResult } from '@/lib/api-client';
import { RecipeCard } from '@/components/RecipeCard';

// Lightweight custom debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export default function HomePage() {
  const [vector, setVector] = useState<[number, number, number, number]>([
    0.5, 0.5, 0.5, 0.5,
  ]);
  const debouncedVector = useDebounce(vector, 250);

  const [results, setResults] = useState<RecommendationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchRecommendations = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getRecommendations({
          primaryVector: debouncedVector,
          limit: 10,
        });
        if (!cancelled) setResults(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch recommendations');
          setResults([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRecommendations();
    return () => {
      cancelled = true;
    };
  }, [debouncedVector]);

  const updateVectorDimension = (index: number, value: number) => {
    setVector((prev) => {
      const next = [...prev] as [number, number, number, number];
      next[index] = value;
      return next;
    });
  };

  return (
    <main className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-4xl font-bold text-stone-900 mb-2">
          Recipe Recommendation Engine
        </h1>
        <p className="text-stone-600 mb-8">
          Adjust the sliders to find recipes that match your preferences.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <SliderControl
            label="Speed"
            value={vector[0]}
            onChange={(val) => updateVectorDimension(0, val)}
            description="Fast to prepare and cook"
          />
          <SliderControl
            label="Minimal Prep"
            value={vector[1]}
            onChange={(val) => updateVectorDimension(1, val)}
            description="Least amount of prep work"
          />
          <SliderControl
            label="Protein"
            value={vector[2]}
            onChange={(val) => updateVectorDimension(2, val)}
            description="High protein content"
          />
          <SliderControl
            label="Low Calorie"
            value={vector[3]}
            onChange={(val) => updateVectorDimension(3, val)}
            description="Low calorie count"
          />
        </div>

        <div className="mb-8">
          <button
            onClick={() => {
              // Manually trigger fetch using current vector
              getRecommendations({ primaryVector: vector, limit: 10 })
                .then(setResults)
                .catch((err) =>
                  setError(err instanceof Error ? err.message : 'Failed')
                );
            }}
            disabled={loading}
            className="bg-stone-900 text-white px-6 py-2 rounded-lg hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Searching...' : 'Get Recommendations'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-8">
            Error: {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.length === 0 && !loading && !error && (
            <p className="text-stone-500">No recipes found. Try adjusting sliders.</p>
          )}
          {results.map((item) => (
            <RecipeCard key={item.recipeId} result={item} />
          ))}
        </div>
      </div>
    </main>
  );
}

interface SliderControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  description: string;
}

function SliderControl({ label, value, onChange, description }: SliderControlProps) {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-stone-200">
      <label className="block text-sm font-medium text-stone-900 mb-1">
        {label}
      </label>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-900"
      />
      <div className="flex justify-between text-xs text-stone-500 mt-1">
        <span>Low</span>
        <span className="font-semibold text-stone-900">{value.toFixed(2)}</span>
        <span>High</span>
      </div>
      <p className="text-xs text-stone-400 mt-1">{description}</p>
    </div>
  );
}
