interface ProgressBarProps {
  current: number;
  target: number;
}

export function ProgressBar({ current, target }: ProgressBarProps) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div className="w-full max-w-sm">
      <div className="mb-1 flex justify-between text-xs font-medium text-stone-500">
        <span>Meals planned</span>
        <span>
          {current}/{target}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
        <div
          className="h-full rounded-full bg-terracotta transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
