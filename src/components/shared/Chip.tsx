import type { ReactNode } from 'react';
import clsx from 'clsx';

interface ChipProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function Chip({ selected, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        'rounded-full border px-4 py-2 text-sm font-medium transition',
        selected
          ? 'border-terracotta bg-terracotta text-white'
          : 'border-stone-300 bg-white text-stone-700 hover:border-terracotta/60',
      )}
    >
      {children}
    </button>
  );
}
