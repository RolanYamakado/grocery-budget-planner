import { Button } from '../shared/Button';

interface OverBudgetWarningProps {
  estimatedTotal: number;
  budgetGBP: number;
  onProceed: () => void;
  onCancel: () => void;
  onStartOver: () => void;
}

export function OverBudgetWarning({ estimatedTotal, budgetGBP, onProceed, onCancel, onStartOver }: OverBudgetWarningProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <p className="mb-1 font-bold text-stone-900">Selecting this will cost more than your budget.</p>
        <p className="mb-5 text-sm text-stone-500">
          Estimated so far: £{estimatedTotal.toFixed(2)} of your £{budgetGBP.toFixed(2)} budget.
        </p>
        <div className="space-y-2">
          <Button className="w-full" onClick={onProceed}>
            Proceed anyway
          </Button>
          <Button className="w-full" variant="secondary" onClick={onCancel}>
            Cancel this selection
          </Button>
          <Button className="w-full" variant="ghost" onClick={onStartOver}>
            Start over
          </Button>
        </div>
      </div>
    </div>
  );
}
