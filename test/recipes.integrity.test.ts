import { describe, expect, it } from 'vitest';
import { RECIPES } from '../src/data/recipes';
import { INGREDIENTS_BY_ID } from '../src/data/ingredients';

describe('recipe/ingredient integrity', () => {
  it('has at least 300 recipes', () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(300);
  });

  it('every recipe has non-empty step-by-step instructions', () => {
    for (const recipe of RECIPES) {
      expect(recipe.steps.length, recipe.id).toBeGreaterThan(0);
      for (const step of recipe.steps) {
        expect(step.trim().length, recipe.id).toBeGreaterThan(0);
      }
    }
  });

  it('every recipe has an image URL and TheMealDB attribution', () => {
    for (const recipe of RECIPES) {
      expect(recipe.imageUrl, recipe.id).toBeTruthy();
      expect(recipe.attribution, recipe.id).toBeTruthy();
      expect(recipe.sourceUrl, recipe.id).toBeTruthy();
    }
  });

  it('every recipe ingredient reference resolves to a known ingredient', () => {
    for (const recipe of RECIPES) {
      for (const ref of recipe.ingredients) {
        expect(INGREDIENTS_BY_ID[ref.ingredientId], `${recipe.id} -> ${ref.ingredientId}`).toBeDefined();
      }
    }
  });

  it('every recipe main ingredient also appears in its ingredient list', () => {
    for (const recipe of RECIPES) {
      for (const mainId of recipe.mainIngredients) {
        const inList = recipe.ingredients.some((r) => r.ingredientId === mainId);
        expect(inList, `${recipe.id} mainIngredient ${mainId} missing from ingredients`).toBe(true);
      }
    }
  });

  it('every recipe has at least one diet tag and a cuisine', () => {
    for (const recipe of RECIPES) {
      expect(recipe.dietTags.length, recipe.id).toBeGreaterThan(0);
      expect(recipe.cuisine, recipe.id).toBeTruthy();
    }
  });

  it('recipe ingredient ref units match the referenced ingredient unit', () => {
    for (const recipe of RECIPES) {
      for (const ref of recipe.ingredients) {
        const ingredient = INGREDIENTS_BY_ID[ref.ingredientId];
        expect(ref.unit, `${recipe.id} -> ${ref.ingredientId}`).toBe(ingredient.unit);
      }
    }
  });

  it('has recipe ids that are unique', () => {
    const ids = RECIPES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
