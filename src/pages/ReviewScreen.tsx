import { usePlanState } from '../hooks/usePlanState';
import { RECIPES_BY_ID } from '../data/recipes';
import { formatDayLabel, getPlanDates } from '../lib/weekUtils';
import { RecipeSummary } from '../components/shared/RecipeSummary';
import { DayMealsCard } from '../components/review/DayMealsCard';
import { MealChip } from '../components/review/MealChip';
import { AddMealControl } from '../components/review/AddMealControl';
import { Button } from '../components/shared/Button';
import { ScreenHeader } from '../components/shared/ScreenHeader';

export function ReviewScreen() {
  const { state, addMealAssignment, removeMealAssignment, reassignMeal, confirmResults } = usePlanState();

  const acceptedRecipes = state.selections
    .map((sel) => RECIPES_BY_ID[sel.recipeId])
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  const planDates = state.setup ? getPlanDates(state.setup.weekStart) : [];

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <ScreenHeader
        title="Review your week"
        subtitle="Your picks are spread across the week — add, remove, or reassign as you like."
      />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-stone-700">Your recipes</h2>
        <div className="space-y-2">
          {state.selections.map((sel) => {
            const recipe = RECIPES_BY_ID[sel.recipeId];
            return recipe ? <RecipeSummary key={recipe.id} recipe={recipe} mealCount={sel.mealCount} /> : null;
          })}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-stone-700">Which day?</h2>
        <div className="space-y-3">
          {planDates.map((date) => {
            const assignments = state.dayAssignments.filter((a) => a.date === date);
            return (
              <DayMealsCard key={date} label={formatDayLabel(date)}>
                {assignments.map((a) =>
                  a.recipeId && RECIPES_BY_ID[a.recipeId] ? (
                    <MealChip
                      key={a.id}
                      recipe={RECIPES_BY_ID[a.recipeId]}
                      options={acceptedRecipes}
                      onReassign={(recipeId) => reassignMeal(a.id, recipeId)}
                      onRemove={() => removeMealAssignment(a.id)}
                    />
                  ) : null,
                )}
                <AddMealControl options={acceptedRecipes} onAdd={(recipeId) => addMealAssignment(date, recipeId)} />
              </DayMealsCard>
            );
          })}
        </div>
      </section>

      <Button className="w-full" onClick={confirmResults}>
        Get my shopping list
      </Button>
    </div>
  );
}
