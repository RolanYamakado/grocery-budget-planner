import { useMemo, useState } from 'react';
import { RECIPES } from '../data/recipes';
import { INGREDIENTS_BY_ID } from '../data/ingredients';
import { searchRecipes } from '../lib/recipeSearch';
import { useAppView } from '../hooks/useAppView';
import { useCustomCart } from '../hooks/useCustomCart';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { Chip } from '../components/shared/Chip';
import { RecipeImage } from '../components/shared/RecipeImage';
import { KNOWN_CUISINES } from '../types';
import type { DietTag } from '../types';

const DIET_OPTIONS: DietTag[] = [
  'balanced',
  'protein-heavy',
  'vegetarian',
  'vegan',
  'low-carb',
  'pescatarian',
  'high-fibre',
];

export function RecipeSearchScreen() {
  const { goToRecipeDetail, goToWizard } = useAppView();
  const cart = useCustomCart();
  const [query, setQuery] = useState('');
  const [ingredientQuery, setIngredientQuery] = useState('');
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [dietTag, setDietTag] = useState<DietTag | null>(null);

  const results = useMemo(
    () =>
      searchRecipes(
        RECIPES,
        {
          query: query || undefined,
          ingredientQuery: ingredientQuery || undefined,
          cuisine: cuisine || undefined,
          dietTag: dietTag || undefined,
        },
        INGREDIENTS_BY_ID,
      ).slice(0, 60),
    [query, ingredientQuery, cuisine, dietTag],
  );

  const cuisinesInPool = useMemo(() => {
    const inUse = new Set(RECIPES.map((r) => r.cuisine));
    return KNOWN_CUISINES.filter((c) => inUse.has(c));
  }, []);

  function cartCountFor(recipeId: string): number {
    return cart.selections.find((s) => s.recipeId === recipeId)?.mealCount ?? 0;
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8 pb-24">
      <ScreenHeader
        title="Search recipes"
        subtitle={`${RECIPES.length} recipes to browse — tap + to build your own plan`}
      />

      <input
        type="search"
        placeholder="Search by name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-3 w-full rounded-xl border border-stone-300 px-3 py-2"
      />

      <input
        type="search"
        placeholder="Search by ingredient (e.g. chicken, potatoes)…"
        value={ingredientQuery}
        onChange={(e) => setIngredientQuery(e.target.value)}
        className="mb-4 w-full rounded-xl border border-stone-300 px-3 py-2"
      />

      <div className="mb-3 flex flex-wrap gap-2">
        {DIET_OPTIONS.map((tag) => (
          <Chip key={tag} selected={dietTag === tag} onClick={() => setDietTag(dietTag === tag ? null : tag)}>
            {tag}
          </Chip>
        ))}
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {cuisinesInPool.map((c) => (
          <Chip key={c} selected={cuisine === c} onClick={() => setCuisine(cuisine === c ? null : c)}>
            {c}
          </Chip>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {results.map((recipe) => {
          const count = cartCountFor(recipe.id);
          return (
            <div key={recipe.id} className="relative overflow-hidden rounded-2xl bg-white shadow-warm">
              <button type="button" onClick={() => goToRecipeDetail(recipe.id)} className="block w-full text-left">
                <RecipeImage src={recipe.imageUrl} alt={recipe.name} className="h-28 w-full" />
                <div className="p-2 pb-10">
                  <p className="truncate text-sm font-semibold text-stone-800">{recipe.name}</p>
                  <p className="truncate text-xs text-stone-500">{recipe.cuisine}</p>
                </div>
              </button>
              <div className="absolute bottom-2 right-2 flex items-center gap-1">
                {count > 0 && (
                  <button
                    type="button"
                    onClick={() => cart.setMealCount(recipe.id, count - 1)}
                    aria-label={`Remove one ${recipe.name}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-200 text-sm font-bold text-stone-700"
                  >
                    −
                  </button>
                )}
                {count > 0 && <span className="text-xs font-semibold text-stone-700">×{count}</span>}
                <button
                  type="button"
                  onClick={() => cart.addRecipe(recipe.id)}
                  aria-label={`Add ${recipe.name} to your plan`}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-terracotta text-sm font-bold text-white"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {results.length === 0 && <p className="text-center text-sm text-stone-400">No recipes match those filters.</p>}

      {cart.totalMeals > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-1">
            <p className="text-sm font-medium text-stone-700">
              {cart.totalMeals} meal{cart.totalMeals === 1 ? '' : 's'} selected
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cart.clear}
                className="rounded-full border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={goToWizard}
                className="rounded-full bg-terracotta px-4 py-1.5 text-sm font-semibold text-white hover:bg-terracotta-dark"
              >
                Build this plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
