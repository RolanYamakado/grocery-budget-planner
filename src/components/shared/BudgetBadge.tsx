import clsx from 'clsx';
import { BUDGET_TOLERANCE_GBP } from '../../data/constants';

interface BudgetBadgeProps {
  totalCostGBP: number;
  budgetGBP: number;
  overBudgetGBP: number;
}

export function BudgetBadge({ totalCostGBP, budgetGBP, overBudgetGBP }: BudgetBadgeProps) {
  const withinTolerance = overBudgetGBP <= BUDGET_TOLERANCE_GBP;
  const isOver = overBudgetGBP > 0;

  const tone = !isOver ? 'good' : withinTolerance ? 'warn' : 'bad';

  return (
    <div
      className={clsx(
        'rounded-2xl border p-4 text-center',
        tone === 'good' && 'border-olive/30 bg-olive/10 text-olive-dark',
        tone === 'warn' && 'border-amber-200 bg-amber-50 text-amber-800',
        tone === 'bad' && 'border-red-200 bg-red-50 text-red-800',
      )}
    >
      <p className="text-3xl font-bold">£{totalCostGBP.toFixed(2)}</p>
      <p className="mt-1 text-sm">
        Budget: £{budgetGBP.toFixed(2)}
        {isOver
          ? ` — £${overBudgetGBP.toFixed(2)} over${withinTolerance ? ' (within tolerance)' : ''}`
          : ' — on budget'}
      </p>
    </div>
  );
}
