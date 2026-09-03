interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

export function Stepper({ value, min = 0, max = Infinity, onChange }: StepperProps) {
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-stone-300 bg-white px-2 py-1">
      <button
        type="button"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="h-8 w-8 rounded-full text-lg font-semibold text-stone-600 hover:bg-stone-100 disabled:opacity-30"
        aria-label="Decrease"
      >
        −
      </button>
      <span className="w-6 text-center text-base font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="h-8 w-8 rounded-full text-lg font-semibold text-stone-600 hover:bg-stone-100 disabled:opacity-30"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}
