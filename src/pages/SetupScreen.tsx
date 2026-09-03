import { useState } from 'react';
import { usePlanState } from '../hooks/usePlanState';
import { useCustomCart } from '../hooks/useCustomCart';
import { STORES } from '../data/stores';
import { RECIPES_BY_ID } from '../data/recipes';
import { MAX_MEALS_PER_WEEK } from '../data/constants';
import type { DietTag, PricingStrategy, Region, StoreId } from '../types';
import { Chip } from '../components/shared/Chip';
import { Button } from '../components/shared/Button';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { CalendarPicker } from '../components/shared/CalendarPicker';
import { formatWeekRangeLabel } from '../lib/weekUtils';

const DIET_OPTIONS: { value: DietTag; label: string }[] = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'protein-heavy', label: 'Protein-heavy' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'low-carb', label: 'Low-carb' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'high-fibre', label: 'High-fibre' },
];

export function SetupScreen() {
  const { startPlan, startCustomPlan } = usePlanState();
  const cart = useCustomCart();
  const isCustom = cart.selections.length > 0;

  const [weekStart, setWeekStart] = useState<Date | null>(new Date());
  const [budget, setBudget] = useState(40);
  const [region, setRegion] = useState<Region>('rest-of-uk');
  const [stores, setStores] = useState<StoreId[]>(['tesco']);
  const [pricingStrategy, setPricingStrategy] = useState<PricingStrategy>('cheapest');
  const [mealsTarget, setMealsTarget] = useState(5);
  const [servingsPerMeal, setServingsPerMeal] = useState(2);
  const [dietPreference, setDietPreference] = useState<DietTag>('balanced');

  const canSubmit =
    weekStart !== null && budget > 0 && stores.length > 0 && servingsPerMeal > 0 && (isCustom || mealsTarget > 0);

  function toggleStore(id: StoreId) {
    setStores((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function handleSubmit() {
    if (!weekStart) return;
    if (isCustom) {
      startCustomPlan(
        {
          weekStart,
          budgetGBP: budget,
          region,
          stores,
          pricingStrategy,
          mealsTarget: cart.totalMeals,
          servingsPerMeal,
          dietPreference,
        },
        cart.selections,
      );
      cart.clear();
      return;
    }
    startPlan({ weekStart, budgetGBP: budget, region, stores, pricingStrategy, mealsTarget, servingsPerMeal, dietPreference });
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <ScreenHeader
        title="Plan your grocery week"
        subtitle={
          isCustom
            ? 'Set your budget and stores to build a shopping list from your chosen recipes.'
            : "Set a budget, pick your stores, and we'll suggest recipes to swipe through."
        }
      />

      <div className="space-y-6">
        {isCustom && (
          <section className="rounded-2xl bg-white p-4 shadow-warm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-stone-700">Your selected recipes ({cart.totalMeals} meals)</span>
              <button type="button" onClick={cart.clear} className="text-xs text-red-500 hover:underline">
                Clear all
              </button>
            </div>
            <ul className="divide-y divide-stone-100">
              {cart.selections.map((sel) => {
                const recipe = RECIPES_BY_ID[sel.recipeId];
                return (
                  <li key={sel.recipeId} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0 truncate text-stone-700">{recipe?.name ?? sel.recipeId}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => cart.setMealCount(sel.recipeId, sel.mealCount - 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-200 text-xs font-bold"
                      >
                        −
                      </button>
                      <span className="w-4 text-center text-xs font-semibold">{sel.mealCount}</span>
                      <button
                        type="button"
                        onClick={() => cart.setMealCount(sel.recipeId, sel.mealCount + 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-200 text-xs font-bold"
                      >
                        +
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section>
          <span className="mb-2 block text-sm font-semibold text-stone-700">Which day should the week start?</span>
          <CalendarPicker value={weekStart} onChange={setWeekStart} minDate={new Date()} />
          {weekStart && <p className="mt-2 text-xs text-stone-500">Plan runs {formatWeekRangeLabel(weekStart)} (7 days)</p>}
        </section>

        <section>
          <label className="mb-2 block text-sm font-semibold text-stone-700" htmlFor="budget-input">
            Weekly budget (£)
          </label>
          <input
            id="budget-input"
            type="number"
            min={1}
            step={1}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-full rounded-xl border border-stone-300 px-3 py-2"
          />
        </section>

        <section>
          <label className="mb-2 block text-sm font-semibold text-stone-700" htmlFor="servings-input">
            How many people are you cooking for? (portions per meal)
          </label>
          <input
            id="servings-input"
            type="number"
            min={1}
            max={10}
            value={servingsPerMeal}
            onChange={(e) => setServingsPerMeal(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
            className="w-full rounded-xl border border-stone-300 px-3 py-2"
          />
          <p className="mt-1 text-xs text-stone-500">Scales how much of each ingredient you'll need to buy.</p>
        </section>

        <section>
          <span className="mb-2 block text-sm font-semibold text-stone-700">Region</span>
          <div className="flex gap-2">
            <Chip selected={region === 'rest-of-uk'} onClick={() => setRegion('rest-of-uk')}>
              Rest of UK
            </Chip>
            <Chip selected={region === 'london'} onClick={() => setRegion('london')}>
              London
            </Chip>
          </div>
        </section>

        <section>
          <span className="mb-2 block text-sm font-semibold text-stone-700">Where do you shop?</span>
          <div className="flex flex-wrap gap-2">
            {STORES.map((store) => (
              <Chip key={store.id} selected={stores.includes(store.id)} onClick={() => toggleStore(store.id)}>
                {store.name}
              </Chip>
            ))}
          </div>
        </section>

        {stores.length >= 2 && (
          <section>
            <span className="mb-2 block text-sm font-semibold text-stone-700">
              How should we pick between your stores?
            </span>
            <div className="flex flex-wrap gap-2">
              <Chip selected={pricingStrategy === 'cheapest'} onClick={() => setPricingStrategy('cheapest')}>
                Cheapest available
              </Chip>
              <Chip
                selected={pricingStrategy === 'balanced-upgrade'}
                onClick={() => setPricingStrategy('balanced-upgrade')}
              >
                Randomise, upgrade protein if there's room
              </Chip>
            </div>
          </section>
        )}

        {!isCustom && (
          <section>
            <label className="mb-2 block text-sm font-semibold text-stone-700" htmlFor="meals-input">
              Meals this week
            </label>
            <input
              id="meals-input"
              type="number"
              min={1}
              max={MAX_MEALS_PER_WEEK}
              value={mealsTarget}
              onChange={(e) =>
                setMealsTarget(Math.max(1, Math.min(MAX_MEALS_PER_WEEK, Number(e.target.value) || 1)))
              }
              className="w-full rounded-xl border border-stone-300 px-3 py-2"
            />
          </section>
        )}

        {!isCustom && (
          <section>
            <span className="mb-2 block text-sm font-semibold text-stone-700">Diet preference this week</span>
            <div className="flex flex-wrap gap-2">
              {DIET_OPTIONS.map((opt) => (
                <Chip key={opt.value} selected={dietPreference === opt.value} onClick={() => setDietPreference(opt.value)}>
                  {opt.label}
                </Chip>
              ))}
            </div>
          </section>
        )}

        <Button className="w-full" disabled={!canSubmit} onClick={handleSubmit}>
          {isCustom ? 'Continue to review' : 'Start swiping'}
        </Button>
      </div>
    </div>
  );
}
