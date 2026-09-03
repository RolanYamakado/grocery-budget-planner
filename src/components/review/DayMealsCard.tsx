import type { ReactNode } from 'react';

interface DayMealsCardProps {
  label: string;
  children: ReactNode;
}

export function DayMealsCard({ label, children }: DayMealsCardProps) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-warm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
