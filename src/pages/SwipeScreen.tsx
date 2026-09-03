import { useState } from 'react';
import { usePlanState } from '../hooks/usePlanState';
import { SwipeDeck } from '../components/swipe/SwipeDeck';
import { MealCountPrompt } from '../components/swipe/MealCountPrompt';
import { OverBudgetWarning } from '../components/swipe/OverBudgetWarning';
import { ProgressBar } from '../components/shared/ProgressBar';
import { Button } from '../components/shared/Button';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { RECIPES_BY_ID } from '../data/recipes';
import { INGREDIENTS_BY_ID } from '../data/ingredients';
import { estimateSelectionsCost } from '../lib/aggregation';
import type { Recipe } from '../types';

export function SwipeScreen() {
  const { state, swipeReject, swipeAccept, undoSwipe, goToReview, restart } = usePlanState();
  const [pendingAccept, setPendingAccept] = useState<Recipe | null>(null);
  const [overBudgetPrompt, setOverBudgetPrompt] = useState<{ recipeId: string; count: number; estimatedTotal: number } | null>(
    null,
  );

  const mealsTarget = state.setup?.mealsTarget ?? 0;
  const remainingSlots = Math.max(1, mealsTarget - state.runningTotal);
  const cards = state.deck.slice(state.deckIndex);

  function handleSwipe(recipe: Recipe, direction: 'left' | 'right') {
    if (direction === 'left') {
      swipeReject(recipe.id);
    } else {
      setPendingAccept(recipe);
    }
  }

  function handleConfirmMealCount(count: number) {
    if (!pendingAccept || !state.setup) return;
    const tentativeSelections = [...state.selections, { recipeId: pendingAccept.id, mealCount: count }];
    const estimatedTotal = estimateSelectionsCost(
      tentativeSelections,
      RECIPES_BY_ID,
      INGREDIENTS_BY_ID,
      state.setup.stores,
      state.setup.region,
      state.setup.servingsPerMeal,
    );
    if (estimatedTotal > state.setup.budgetGBP) {
      setOverBudgetPrompt({ recipeId: pendingAccept.id, count, estimatedTotal });
      return;
    }
    swipeAccept(pendingAccept.id, count);
    setPendingAccept(null);
  }

  function handleProceedOverBudget() {
    if (!overBudgetPrompt) return;
    swipeAccept(overBudgetPrompt.recipeId, overBudgetPrompt.count);
    setOverBudgetPrompt(null);
    setPendingAccept(null);
  }

  function handleCancelOverBudget() {
    // "Cancel this selection" means don't accept this recipe at all — back to the deck.
    setOverBudgetPrompt(null);
    setPendingAccept(null);
  }

  function handleStartOverFromWarning() {
    setOverBudgetPrompt(null);
    setPendingAccept(null);
    restart();
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <ScreenHeader title="Swipe your meals" subtitle="Swipe right to add, left to skip." />

      <div className="mb-6 flex justify-center">
        <ProgressBar current={state.runningTotal} target={mealsTarget} />
      </div>

      {cards.length > 0 ? (
        <>
          <SwipeDeck cards={cards} onSwipe={handleSwipe} />
          <div className="mt-6 flex justify-center gap-6">
            <button
              type="button"
              aria-label="Reject"
              onClick={() => cards[0] && handleSwipe(cards[0], 'left')}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-red-200 bg-white text-2xl text-red-500 shadow hover:bg-red-50"
            >
              ✕
            </button>
            <button
              type="button"
              aria-label="Accept"
              onClick={() => cards[0] && handleSwipe(cards[0], 'right')}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-olive/30 bg-white text-2xl text-olive-dark shadow hover:bg-olive/10"
            >
              ♥
            </button>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white p-6 text-center">
          <p className="mb-4 text-stone-600">
            You&apos;ve been through all the recipes we have for this diet preference this month.
          </p>
          {state.selections.length > 0 ? (
            <Button onClick={goToReview}>Continue with {state.runningTotal} meals planned</Button>
          ) : (
            <Button variant="secondary" onClick={restart}>
              Start over
            </Button>
          )}
        </div>
      )}

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={undoSwipe}
          disabled={!state.lastSwipe}
          className="rounded-full border border-stone-300 px-4 py-1.5 text-sm text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-30"
        >
          ↺ Undo last swipe
        </button>
      </div>

      <button
        type="button"
        onClick={restart}
        className="fixed bottom-4 right-4 z-30 rounded-full bg-stone-800/90 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-stone-900"
      >
        Start Over
      </button>

      {pendingAccept && !overBudgetPrompt && (
        <MealCountPrompt
          recipe={pendingAccept}
          maxMeals={remainingSlots}
          onConfirm={handleConfirmMealCount}
          onCancel={() => setPendingAccept(null)}
        />
      )}

      {overBudgetPrompt && state.setup && (
        <OverBudgetWarning
          estimatedTotal={overBudgetPrompt.estimatedTotal}
          budgetGBP={state.setup.budgetGBP}
          onProceed={handleProceedOverBudget}
          onCancel={handleCancelOverBudget}
          onStartOver={handleStartOverFromWarning}
        />
      )}
    </div>
  );
}
