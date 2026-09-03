import { useMemo, useState } from 'react';
import { RECIPES_BY_ID } from '../../data/recipes';
import { STORES_BY_ID } from '../../data/stores';
import { INGREDIENTS_BY_ID } from '../../data/ingredients';
import {
  applyAlreadyHaveOverrides,
  applyLeftoverOverrides,
  applyPantryOverrides,
  computeOverBudget,
  computeShoppingListTotal,
} from '../../lib/aggregation';
import { formatDayLabel } from '../../lib/weekUtils';
import { BudgetBadge } from '../shared/BudgetBadge';
import { ShoppingListItem } from '../shared/ShoppingListItem';
import { RecipeSummary } from '../shared/RecipeSummary';
import { Button } from '../shared/Button';
import { ShareSheet } from '../share/ShareSheet';
import { RecipeStepsModal } from './RecipeStepsModal';
import type { Recipe, StoreId, WeeklyPlan } from '../../types';

interface PlanSummaryViewProps {
  plan: WeeklyPlan;
  onRestart?: () => void;
  onSave?: () => void;
  onDiscard?: () => void;
  saved?: boolean;
}

const PRICING_STRATEGY_LABEL: Record<WeeklyPlan['pricingStrategy'], string> = {
  cheapest: 'Pricing: Cheapest available',
  'balanced-upgrade': 'Pricing: Balanced + protein upgrade',
};

export function PlanSummaryView({ plan, onRestart, onSave, onDiscard, saved }: PlanSummaryViewProps) {
  const [disabledLeftoverIds, setDisabledLeftoverIds] = useState<Set<string>>(new Set());
  const [includedPantryIds, setIncludedPantryIds] = useState<Set<string>>(new Set());
  const [alreadyHaveIds, setAlreadyHaveIds] = useState<Set<string>>(new Set());
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);

  const leftoverIngredientIds = useMemo(
    () => new Set(plan.shoppingList.filter((l) => l.leftoverNote).map((l) => l.ingredientId)),
    [plan],
  );
  const pantryIngredientIds = useMemo(
    () => new Set(plan.shoppingList.filter((l) => l.isPantryItem).map((l) => l.ingredientId)),
    [plan],
  );
  const purchasableIngredientIds = useMemo(
    () => new Set(plan.shoppingList.filter((l) => !l.isPantryItem && l.packagesNeeded > 0).map((l) => l.ingredientId)),
    [plan],
  );

  const displayList = useMemo(() => {
    let list = plan.shoppingList;
    if (disabledLeftoverIds.size > 0) {
      list = applyLeftoverOverrides(list, plan.ingredientDemandSnapshot, disabledLeftoverIds, plan.stores, plan.region, INGREDIENTS_BY_ID);
    }
    if (includedPantryIds.size > 0) {
      list = applyPantryOverrides(list, includedPantryIds, plan.region, INGREDIENTS_BY_ID);
    }
    if (alreadyHaveIds.size > 0) {
      list = applyAlreadyHaveOverrides(list, alreadyHaveIds);
    }
    return list;
  }, [plan, disabledLeftoverIds, includedPantryIds, alreadyHaveIds]);

  const totalCostGBP = useMemo(() => computeShoppingListTotal(displayList), [displayList]);
  const overBudgetGBP = useMemo(() => computeOverBudget(totalCostGBP, plan.budgetGBP), [totalCostGBP, plan.budgetGBP]);

  function handleToggleUseLeftover(ingredientId: string, disable: boolean) {
    setDisabledLeftoverIds((prev) => {
      const next = new Set(prev);
      if (disable) next.add(ingredientId);
      else next.delete(ingredientId);
      return next;
    });
  }

  function handleTogglePantryInclude(ingredientId: string, include: boolean) {
    setIncludedPantryIds((prev) => {
      const next = new Set(prev);
      if (include) next.add(ingredientId);
      else next.delete(ingredientId);
      return next;
    });
  }

  function handleToggleAlreadyHave(ingredientId: string, alreadyHave: boolean) {
    setAlreadyHaveIds((prev) => {
      const next = new Set(prev);
      if (alreadyHave) next.add(ingredientId);
      else next.delete(ingredientId);
      return next;
    });
  }

  const pantryLines = displayList.filter((l) => l.isPantryItem);
  const leftoverOnlyLines = displayList.filter((l) => !l.isPantryItem && l.packagesNeeded === 0 && !alreadyHaveIds.has(l.ingredientId));
  const alreadyHaveLines = displayList.filter((l) => !l.isPantryItem && alreadyHaveIds.has(l.ingredientId));
  const purchasableLines = displayList.filter(
    (l) => !l.isPantryItem && l.packagesNeeded > 0 && !alreadyHaveIds.has(l.ingredientId),
  );

  const byStore = new Map<StoreId, typeof purchasableLines>();
  for (const line of purchasableLines) {
    if (!line.storeId) continue;
    const bucket = byStore.get(line.storeId) ?? [];
    bucket.push(line);
    byStore.set(line.storeId, bucket);
  }

  function itemProps(ingredientId: string) {
    return {
      hasLeftoverOption: leftoverIngredientIds.has(ingredientId),
      leftoverDisabled: disabledLeftoverIds.has(ingredientId),
      onToggleUseLeftover: handleToggleUseLeftover,
      hasPantryToggle: pantryIngredientIds.has(ingredientId),
      pantryIncluded: includedPantryIds.has(ingredientId),
      onTogglePantryInclude: handleTogglePantryInclude,
      hasAlreadyHaveToggle: purchasableIngredientIds.has(ingredientId),
      alreadyHave: alreadyHaveIds.has(ingredientId),
      onToggleAlreadyHave: handleToggleAlreadyHave,
    };
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="mb-4 flex justify-center">
        <span className="rounded-full bg-olive/10 px-3 py-1 text-xs font-semibold text-olive-dark">
          {PRICING_STRATEGY_LABEL[plan.pricingStrategy]}
        </span>
      </div>

      <div className="mb-8">
        <BudgetBadge totalCostGBP={totalCostGBP} budgetGBP={plan.budgetGBP} overBudgetGBP={overBudgetGBP} />
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-stone-700">Shopping list</h2>
        {[...byStore.entries()].map(([storeId, lines]) => (
          <div key={storeId} className="mb-4 rounded-2xl bg-white p-4 shadow-warm">
            <h3 className="mb-1 font-semibold text-stone-900">{STORES_BY_ID[storeId]?.name}</h3>
            <ul className="divide-y divide-stone-100">
              {lines.map((line) => (
                <ShoppingListItem key={line.ingredientId} line={line} {...itemProps(line.ingredientId)} />
              ))}
            </ul>
          </div>
        ))}

        {leftoverOnlyLines.length > 0 && (
          <div className="mb-4 rounded-2xl border border-olive/30 bg-olive/5 p-4">
            <h3 className="mb-1 font-semibold text-olive-dark">Already covered</h3>
            <ul className="divide-y divide-olive/10">
              {leftoverOnlyLines.map((line) => (
                <ShoppingListItem key={line.ingredientId} line={line} {...itemProps(line.ingredientId)} />
              ))}
            </ul>
          </div>
        )}

        {alreadyHaveLines.length > 0 && (
          <div className="mb-4 rounded-2xl border border-stone-300 bg-stone-50 p-4">
            <h3 className="mb-1 font-semibold text-stone-700">You already have</h3>
            <ul className="divide-y divide-stone-200">
              {alreadyHaveLines.map((line) => (
                <ShoppingListItem key={line.ingredientId} line={line} {...itemProps(line.ingredientId)} />
              ))}
            </ul>
          </div>
        )}

        {pantryLines.length > 0 && (
          <div className="rounded-2xl bg-stone-100 p-4">
            <h3 className="mb-1 font-semibold text-stone-700">Pantry items (cost not included)</h3>
            <p className="mb-2 text-xs text-stone-500">
              Condiments, spices and oil — assumed already in your cupboard. Don't have one? Toggle it below to include
              its price.
            </p>
            <ul className="divide-y divide-stone-200">
              {pantryLines.map((line) => (
                <ShoppingListItem key={line.ingredientId} line={line} {...itemProps(line.ingredientId)} />
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-stone-700">Your week</h2>
        <div className="space-y-3">
          {plan.planDates.map((date) => {
            const recipes = plan.dayAssignments
              .filter((a) => a.date === date && a.recipeId)
              .map((a) => RECIPES_BY_ID[a.recipeId as string])
              .filter((r): r is NonNullable<typeof r> => Boolean(r));
            return (
              <div key={date}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">
                  {formatDayLabel(date)}
                </p>
                {recipes.length > 0 ? (
                  <div className="space-y-2">
                    {recipes.map((recipe, i) => (
                      <RecipeSummary key={`${recipe.id}-${i}`} recipe={recipe} onClick={() => setViewingRecipe(recipe)} />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-stone-300 p-3 text-sm text-stone-400">
                    No meal planned
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="mb-8 print:hidden">
        <ShareSheet plan={plan} />
      </div>

      {(onSave || onDiscard) && (
        <div className="mb-4 flex gap-3 print:hidden">
          {onSave && (
            <Button className="flex-1" onClick={onSave} disabled={saved}>
              {saved ? 'Saved ✓' : 'Save plan'}
            </Button>
          )}
          {onDiscard && (
            <Button className="flex-1" variant="secondary" onClick={onDiscard}>
              Discard plan
            </Button>
          )}
        </div>
      )}

      {onRestart && (
        <Button className="w-full print:hidden" variant="secondary" onClick={onRestart}>
          Plan another week
        </Button>
      )}

      {viewingRecipe && <RecipeStepsModal recipe={viewingRecipe} onClose={() => setViewingRecipe(null)} />}
    </div>
  );
}
