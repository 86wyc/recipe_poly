'use client';

interface SliderControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  description: string;
}

function getValueLabel(value: number): string {
  if (value >= 0.7) return 'High';
  if (value <= 0.3) return 'Low';
  return 'Medium';
}

export function SliderControl({ label, value, onChange, description }: SliderControlProps) {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-stone-200">
      <label className="block text-sm font-medium text-stone-900 mb-1">{label}</label>
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
        <span className="font-semibold text-stone-900">
          {Math.round(value * 100)}% · {getValueLabel(value)}
        </span>
        <span>High</span>
      </div>
      <p className="text-xs text-stone-400 mt-1">{description}</p>
    </div>
  );
}
