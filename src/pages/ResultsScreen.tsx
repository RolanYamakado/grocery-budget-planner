import { usePlanState } from '../hooks/usePlanState';
import { PlanSummaryView } from '../components/results/PlanSummaryView';
import { ScreenHeader } from '../components/shared/ScreenHeader';

export function ResultsScreen() {
  const { state, savePlan, restart } = usePlanState();
  const plan = state.finalPlan;

  if (!plan) return null;

  return (
    <div>
      <div className="mx-auto max-w-md px-4 pt-8">
        <ScreenHeader title="Your grocery plan" />
      </div>
      {state.planSaved ? (
        <PlanSummaryView plan={plan} onRestart={restart} />
      ) : (
        <PlanSummaryView plan={plan} onSave={savePlan} onDiscard={restart} saved={state.planSaved} />
      )}
    </div>
  );
}
