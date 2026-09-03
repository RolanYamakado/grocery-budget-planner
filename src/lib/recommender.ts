import type { AffinityScores, DietTag, Recipe, SwipeHistoryEntry } from '../types';
import { AFFINITY_CAP, AFFINITY_DECAY_FACTOR, MIN_DECK_SIZE } from '../data/constants';
import { getMonthKey } from './weekUtils';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function extractAffinityKeys(recipe: Recipe): string[] {
  const keys: string[] = [];
  for (const tag of recipe.dietTags) keys.push(`diet:${tag}`);
  keys.push(`cuisine:${recipe.cuisine}`);
  for (const ingredientId of recipe.mainIngredients) keys.push(`ingredient:${ingredientId}`);
  return keys;
}

export function updateAffinity(
  scores: AffinityScores,
  recipe: Recipe,
  action: 'accept' | 'reject',
): AffinityScores {
  const delta = action === 'accept' ? 1 : -1;
  const next = { ...scores };
  for (const key of extractAffinityKeys(recipe)) {
    next[key] = clamp((next[key] ?? 0) + delta, -AFFINITY_CAP, AFFINITY_CAP);
  }
  return next;
}

/** Decays all affinity scores once per ISO week so old preferences fade over time. */
export function applyLazyDecay(
  scores: AffinityScores,
  lastDecayWeekKey: string | null,
  currentWeekKey: string,
): { scores: AffinityScores; decayed: boolean } {
  if (lastDecayWeekKey === currentWeekKey) return { scores, decayed: false };
  const next: AffinityScores = {};
  for (const [key, value] of Object.entries(scores)) {
    const decayed = value * AFFINITY_DECAY_FACTOR;
    if (Math.abs(decayed) >= 0.05) next[key] = decayed;
  }
  return { scores: next, decayed: true };
}

export function scoreRecipeForDeck(recipe: Recipe, scores: AffinityScores): number {
  return extractAffinityKeys(recipe).reduce((total, key) => total + (scores[key] ?? 0), 0);
}

/** Simple deterministic string hash, used only as a stable tie-breaker for equal-score recipes. */
function stableHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash;
}

export function buildDeck(
  allRecipes: Recipe[],
  dietPreference: DietTag,
  swipeHistory: SwipeHistoryEntry[],
  scores: AffinityScores,
  now: Date,
): Recipe[] {
  const monthKey = getMonthKey(now);
  const rejectedThisMonth = new Set(
    swipeHistory
      .filter((e) => e.action === 'reject' && getMonthKey(e.timestamp) === monthKey)
      .map((e) => e.recipeId),
  );

  let candidates = allRecipes.filter(
    (r) => r.dietTags.includes(dietPreference) && !rejectedThisMonth.has(r.id),
  );
  if (candidates.length < MIN_DECK_SIZE) {
    // Relax the monthly-reject filter as a fallback so the deck never starves.
    candidates = allRecipes.filter((r) => r.dietTags.includes(dietPreference));
  }

  return candidates
    .map((r) => ({ recipe: r, score: scoreRecipeForDeck(r, scores) }))
    .sort((a, b) => b.score - a.score || stableHash(a.recipe.id) - stableHash(b.recipe.id))
    .map((x) => x.recipe);
}
