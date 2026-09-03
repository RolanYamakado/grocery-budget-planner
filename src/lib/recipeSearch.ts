import type { DietTag, Ingredient, Recipe } from '../types';

export interface RecipeSearchFilters {
  query?: string;
  ingredientId?: string;
  /** Free-text ingredient name search, e.g. "chicken" matches any ingredient whose name contains it. */
  ingredientQuery?: string;
  cuisine?: string;
  dietTag?: DietTag;
  maxPrepMinutes?: number;
}

export function searchRecipes(
  recipes: Recipe[],
  filters: RecipeSearchFilters,
  ingredientsById: Record<string, Ingredient> = {},
): Recipe[] {
  const ingredientQueryNorm = filters.ingredientQuery?.trim().toLowerCase();

  return recipes.filter((r) => {
    if (filters.query && !r.name.toLowerCase().includes(filters.query.toLowerCase())) return false;
    if (filters.ingredientId && !r.ingredients.some((i) => i.ingredientId === filters.ingredientId)) return false;
    if (
      ingredientQueryNorm &&
      !r.ingredients.some((i) => ingredientsById[i.ingredientId]?.name.toLowerCase().includes(ingredientQueryNorm))
    ) {
      return false;
    }
    if (filters.cuisine && r.cuisine !== filters.cuisine) return false;
    if (filters.dietTag && !r.dietTags.includes(filters.dietTag)) return false;
    if (filters.maxPrepMinutes && r.prepMinutes > filters.maxPrepMinutes) return false;
    return true;
  });
}
