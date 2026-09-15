import { useState } from 'react';
import { getPlanHistory, removePlanFromHistory } from '../lib/storage';
import { formatWeekRangeLabel } from '../lib/weekUtils';
import { useAppView } from '../hooks/useAppView';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { Button } from '../components/shared/Button';

function safeWeekRangeLabel(weekStartDate: string): string {
  try {
    const label = formatWeekRangeLabel(new Date(`${weekStartDate}T00:00:00`));
    return label.includes('Invalid') ? weekStartDate : label;
  } catch {
    return weekStartDate;
  }
}

export function SavedPlansScreen() {
  const { goToSavedPlanDetail, goToWizard } = useAppView();
  const [plans, setPlans] = useState(() => getPlanHistory());

  async function handleDelete(planId: string) {
    await removePlanFromHistory(planId);
    setPlans(getPlanHistory());
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <ScreenHeader title="Saved meal plans" />

      {plans.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center shadow-warm">
          <p className="mb-4 text-stone-500">Nothing is saved.</p>
          <Button onClick={goToWizard}>Start a new plan</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <div key={plan.id} className="flex items-center gap-2 rounded-2xl bg-white p-4 shadow-warm">
              <button type="button" onClick={() => goToSavedPlanDetail(plan.id)} className="min-w-0 flex-1 text-left">
                <p className="font-semibold text-stone-900">{safeWeekRangeLabel(plan.weekStartDate)}</p>
                <p className="text-sm text-stone-500">
                  £{plan.totalCostGBP.toFixed(2)} of £{plan.budgetGBP.toFixed(2)} budget — {plan.mealsTarget} meals
                </p>
              </button>
              <button
                type="button"
                aria-label="Delete saved plan"
                onClick={() => void handleDelete(plan.id)}
                className="shrink-0 rounded-full border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
