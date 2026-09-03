import { describe, expect, it } from 'vitest';
import { searchRecipes } from '../src/lib/recipeSearch';
import type { Ingredient, Recipe } from '../src/types';

const recipes: Recipe[] = [
  {
    id: 'r1',
    name: 'Chicken Tikka Masala',
    description: '',
    imageUrl: '',
    dietTags: ['protein-heavy', 'balanced'],
    cuisine: 'indian',
    mainIngredients: ['chicken-breast'],
    ingredients: [{ ingredientId: 'chicken-breast', quantity: 150, unit: 'g' }],
    prepMinutes: 30,
    steps: ['Cook it.'],
  },
  {
    id: 'r2',
    name: 'Vegetable Chow Mein',
    description: '',
    imageUrl: '',
    dietTags: ['vegan', 'vegetarian'],
    cuisine: 'chinese',
    mainIngredients: ['noodles-egg'],
    ingredients: [{ ingredientId: 'noodles-egg', quantity: 100, unit: 'g' }],
    prepMinutes: 15,
    steps: ['Stir-fry it.'],
  },
];

describe('searchRecipes', () => {
  it('filters by case-insensitive name substring', () => {
    expect(searchRecipes(recipes, { query: 'chicken' })).toEqual([recipes[0]]);
  });

  it('filters by ingredient', () => {
    expect(searchRecipes(recipes, { ingredientId: 'noodles-egg' })).toEqual([recipes[1]]);
  });

  it('filters by cuisine', () => {
    expect(searchRecipes(recipes, { cuisine: 'indian' })).toEqual([recipes[0]]);
  });

  it('filters by diet tag', () => {
    expect(searchRecipes(recipes, { dietTag: 'vegan' })).toEqual([recipes[1]]);
  });

  it('filters by max prep time', () => {
    expect(searchRecipes(recipes, { maxPrepMinutes: 20 })).toEqual([recipes[1]]);
  });

  it('returns all recipes when no filters are given', () => {
    expect(searchRecipes(recipes, {})).toEqual(recipes);
  });

  it('combines multiple filters with AND semantics', () => {
    expect(searchRecipes(recipes, { cuisine: 'indian', dietTag: 'vegan' })).toEqual([]);
  });

  it('filters by free-text ingredient name query', () => {
    const ingredientsById: Record<string, Ingredient> = {
      'chicken-breast': { id: 'chicken-breast', name: 'Chicken breast fillets' } as Ingredient,
      'noodles-egg': { id: 'noodles-egg', name: 'Straight-to-wok noodles' } as Ingredient,
    };
    expect(searchRecipes(recipes, { ingredientQuery: 'chicken' }, ingredientsById)).toEqual([recipes[0]]);
    expect(searchRecipes(recipes, { ingredientQuery: 'noodle' }, ingredientsById)).toEqual([recipes[1]]);
    expect(searchRecipes(recipes, { ingredientQuery: 'nonexistent' }, ingredientsById)).toEqual([]);
  });
});
