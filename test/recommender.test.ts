import { describe, expect, it } from 'vitest';
import {
  applyLazyDecay,
  buildDeck,
  extractAffinityKeys,
  scoreRecipeForDeck,
  updateAffinity,
} from '../src/lib/recommender';
import { AFFINITY_CAP, MIN_DECK_SIZE } from '../src/data/constants';
import type { Recipe, SwipeHistoryEntry } from '../src/types';

const baseRecipe: Recipe = {
  id: 'r1',
  name: 'Test Recipe',
  description: '',
  imageUrl: '',
  dietTags: ['balanced'],
  cuisine: 'italian',
  mainIngredients: ['pasta-penne'],
  ingredients: [],
  prepMinutes: 10,
};

describe('recommender', () => {
  it('extracts diet, cuisine and main-ingredient affinity keys', () => {
    expect(extractAffinityKeys(baseRecipe)).toEqual(['diet:balanced', 'cuisine:italian', 'ingredient:pasta-penne']);
  });

  it('accepting a recipe increases affinity for its keys', () => {
    const scores = updateAffinity({}, baseRecipe, 'accept');
    expect(scores['diet:balanced']).toBe(1);
    expect(scores['cuisine:italian']).toBe(1);
    expect(scoreRecipeForDeck(baseRecipe, scores)).toBe(3);
  });

  it('rejecting a recipe decreases affinity for its keys', () => {
    const scores = updateAffinity({}, baseRecipe, 'reject');
    expect(scores['diet:balanced']).toBe(-1);
  });

  it('clamps affinity scores at the configured cap in both directions', () => {
    let scores = {};
    for (let i = 0; i < 20; i++) scores = updateAffinity(scores, baseRecipe, 'accept');
    expect(scores['diet:balanced' as keyof typeof scores]).toBe(AFFINITY_CAP);

    let negative = {};
    for (let i = 0; i < 20; i++) negative = updateAffinity(negative, baseRecipe, 'reject');
    expect(negative['diet:balanced' as keyof typeof negative]).toBe(-AFFINITY_CAP);
  });

  it('decays scores toward zero and drops negligible values, but only once per week key', () => {
    const scores = { 'diet:balanced': 4 };
    const first = applyLazyDecay(scores, null, '2026-W10');
    expect(first.decayed).toBe(true);
    expect(first.scores['diet:balanced']).toBeCloseTo(3.6);

    const second = applyLazyDecay(first.scores, '2026-W10', '2026-W10');
    expect(second.decayed).toBe(false);
    expect(second.scores).toEqual(first.scores);
  });

  it('excludes recipes rejected within the current calendar month', () => {
    const recipes: Recipe[] = Array.from({ length: MIN_DECK_SIZE + 2 }, (_, i) => ({
      ...baseRecipe,
      id: `r${i}`,
    }));
    const now = new Date('2026-09-15T12:00:00Z');
    const history: SwipeHistoryEntry[] = [
      { recipeId: 'r0', action: 'reject', timestamp: '2026-09-01T00:00:00Z' },
    ];
    const deck = buildDeck(recipes, 'balanced', history, {}, now);
    expect(deck.find((r) => r.id === 'r0')).toBeUndefined();
  });

  it('falls back to including rejected recipes when the filtered deck is too small', () => {
    const recipes: Recipe[] = Array.from({ length: 3 }, (_, i) => ({ ...baseRecipe, id: `r${i}` }));
    const now = new Date('2026-09-15T12:00:00Z');
    const history: SwipeHistoryEntry[] = [
      { recipeId: 'r0', action: 'reject', timestamp: '2026-09-01T00:00:00Z' },
    ];
    const deck = buildDeck(recipes, 'balanced', history, {}, now);
    expect(deck.length).toBe(3);
  });

  it('sorts higher-affinity recipes first', () => {
    const recipes: Recipe[] = Array.from({ length: MIN_DECK_SIZE + 1 }, (_, i) => ({
      ...baseRecipe,
      id: `r${i}`,
      mainIngredients: [`ingredient-${i}`],
    }));
    const scores = { 'ingredient:ingredient-3': 5 };
    const deck = buildDeck(recipes, 'balanced', [], scores, new Date('2026-09-15T12:00:00Z'));
    expect(deck[0].id).toBe('r3');
  });
});
