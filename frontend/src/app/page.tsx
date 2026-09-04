'use client';

import { useState, useEffect } from 'react';
import {
  getRecommendations,
  calculateEffectiveVector,
  type RecommendationResult,
} from '@/lib/api-client';
import { RecipeCard } from '@/components/RecipeCard';
import { SliderControl } from '@/components/SliderControl';

// Lightweight custom debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

const DEFAULT_VECTOR: [number, number, number, number] = [0.5, 0.5, 0.5, 0.5];

const PRESETS = [
  {
    label: 'Quick & Easy',
    vector: [0.9, 0.9, 0.5, 0.5] as [number, number, number, number],
  },
  {
    label: 'High Protein Boost',
    vector: [0.5, 0.5, 0.95, 0.4] as [number, number, number, number],
  },
  {
    label: 'Low Calorie Light',
    vector: [0.5, 0.5, 0.5, 0.95] as [number, number, number, number],
  },
];

export default function HomePage() {
  const [primaryVector, setPrimaryVector] = useState<[number, number, number, number]>([...DEFAULT_VECTOR]);
  const [guestVector, setGuestVector] = useState<[number, number, number, number]>([...DEFAULT_VECTOR]);
  const [guestEnabled, setGuestEnabled] = useState(false);
  const [guestWeight, setGuestWeight] = useState(0.5);

  const effectiveVector = guestEnabled
    ? calculateEffectiveVector(primaryVector, guestVector, guestWeight) as [number, number, number, number]
    : primaryVector;
  const debouncedVector = useDebounce(effectiveVector, 250);

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

  const updatePrimaryDimension = (index: number, value: number) => {
    setPrimaryVector((prev) => {
      const next = [...prev] as [number, number, number, number];
      next[index] = value;
      return next;
    });
  };

  const updateGuestDimension = (index: number, value: number) => {
    setGuestVector((prev) => {
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
        <p className="text-stone-600 mb-6">
          Adjust the sliders to find recipes that match your preferences.
        </p>

        {/* Preset Macros */}
        <div className="flex flex-wrap gap-2 mb-6">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => setPrimaryVector([...preset.vector])}
              className="px-4 py-2 bg-white border border-stone-300 rounded-full text-sm font-medium text-stone-700 hover:bg-stone-100 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Guest Overlay Toggle */}
        <div className="bg-white p-4 rounded-lg border border-stone-200 mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="font-medium text-stone-900">Guest Overlay Vector</label>
            <button
              onClick={() => setGuestEnabled((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                guestEnabled ? 'bg-stone-900' : 'bg-stone-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  guestEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {guestEnabled && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <SliderControl
                  label="Guest Speed"
                  value={guestVector[0]}
                  onChange={(val) => updateGuestDimension(0, val)}
                  description="Guest preference"
                />
                <SliderControl
                  label="Guest Minimal Prep"
                  value={guestVector[1]}
                  onChange={(val) => updateGuestDimension(1, val)}
                  description="Guest preference"
                />
                <SliderControl
                  label="Guest Protein"
                  value={guestVector[2]}
                  onChange={(val) => updateGuestDimension(2, val)}
                  description="Guest preference"
                />
                <SliderControl
                  label="Guest Low Calorie"
                  value={guestVector[3]}
                  onChange={(val) => updateGuestDimension(3, val)}
                  description="Guest preference"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-900 mb-1">
                  Guest Weight: {guestWeight.toFixed(2)}
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.1}
                  value={guestWeight}
                  onChange={(e) => setGuestWeight(Number(e.target.value))}
                  className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-900"
                />
              </div>
            </div>
          )}
        </div>

        {/* Primary Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <SliderControl
            label="Speed"
            value={primaryVector[0]}
            onChange={(val) => updatePrimaryDimension(0, val)}
            description="Fast to prepare and cook"
          />
          <SliderControl
            label="Minimal Prep"
            value={primaryVector[1]}
            onChange={(val) => updatePrimaryDimension(1, val)}
            description="Least amount of prep work"
          />
          <SliderControl
            label="Protein"
            value={primaryVector[2]}
            onChange={(val) => updatePrimaryDimension(2, val)}
            description="High protein content"
          />
          <SliderControl
            label="Low Calorie"
            value={primaryVector[3]}
            onChange={(val) => updatePrimaryDimension(3, val)}
            description="Low calorie count"
          />
        </div>

        {/* Manual Fetch Button */}
        <div className="mb-8">
          <button
            onClick={() => {
              const vectorToSend = guestEnabled
                ? (calculateEffectiveVector(primaryVector, guestVector, guestWeight) as [number, number, number, number])
                : primaryVector;
              getRecommendations({ primaryVector: vectorToSend, limit: 10 })
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

        {/* Results Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.length === 0 && !loading && !error && (
            <div className="col-span-full bg-white border border-dashed border-stone-300 rounded-lg p-12 text-center">
              <div className="text-5xl mb-4">🍳</div>
              <h3 className="text-xl font-semibold text-stone-900 mb-2">No recipes match yet</h3>
              <p className="text-stone-600">
                Try adjusting the sliders or selecting a preset above.
              </p>
            </div>
          )}
          {results.map((item) => (
            <RecipeCard key={item.recipeId} result={item} />
          ))}
        </div>
      </div>
    </main>
  );
}
