import { getPlanHistory } from '../lib/storage';
import { useAppView } from '../hooks/useAppView';
import { PlanSummaryView } from '../components/results/PlanSummaryView';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { Button } from '../components/shared/Button';

interface SavedPlanDetailScreenProps {
  planId: string;
}

export function SavedPlanDetailScreen({ planId }: SavedPlanDetailScreenProps) {
  const { goToSavedPlans } = useAppView();
  const plan = getPlanHistory().find((p) => p.id === planId);

  if (!plan) {
    return (
      <div className="mx-auto max-w-md px-4 py-8 text-center">
        <p className="mb-4 text-stone-500">This plan is no longer available.</p>
        <Button variant="secondary" onClick={goToSavedPlans}>
          Back to saved plans
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto max-w-md px-4 pt-8">
        <ScreenHeader title="Saved plan" />
      </div>
      <PlanSummaryView plan={plan} />
      <div className="mx-auto max-w-md px-4 pb-8">
        <Button variant="secondary" className="w-full" onClick={goToSavedPlans}>
          Back to saved plans
        </Button>
      </div>
    </div>
  );
}
