import type { AffinityScores, MealAssignment, SwipeHistoryEntry, WeeklyPlan } from '../types';
import { PLAN_HISTORY_LIMIT, STORAGE_KEYS } from '../data/constants';
import { DAY_KEYS, getPlanDates, toIsoDateString } from './weekUtils';
import { generateId } from './idUtils';
import { parseISO, setISOWeek, setISOWeekYear, startOfISOWeek } from 'date-fns';

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage unavailable (private browsing, quota) — fail silently, app still works in-session.
  }
}

interface WeeklyPlanV1 extends Omit<WeeklyPlan, 'dayAssignments' | 'planDates' | 'pricingStrategy'> {
  dayAssignments: { day: (typeof DAY_KEYS)[number]; recipeId: string | null }[];
}

/**
 * Very old (pre-calendar-picker) plans stored weekStartDate as an HTML
 * `<input type="week">` value ("2026-W36"), not a plain ISO date. parseISO()
 * can't parse that format at all, so it must be converted explicitly here —
 * otherwise the raw "2026-W36" string leaks into leftover-note display and
 * date math on migrated plans silently breaks.
 */
function resolveLegacyWeekStart(weekStartDate: string): Date {
  const weekInputMatch = /^(\d{4})-W(\d{2})$/.exec(weekStartDate);
  if (weekInputMatch) {
    const year = Number(weekInputMatch[1]);
    const week = Number(weekInputMatch[2]);
    const withYear = setISOWeekYear(new Date(year, 0, 4), year);
    return startOfISOWeek(setISOWeek(withYear, week));
  }
  return parseISO(weekStartDate);
}

/** Maps a pre-v2 plan (fixed Mon-Sun day slots, possibly a legacy week-string date) onto the current shape. */
function migratePlanV1ToV2(old: WeeklyPlanV1): WeeklyPlan {
  const weekStart = resolveLegacyWeekStart(old.weekStartDate);
  const weekStartDate = toIsoDateString(weekStart);
  const planDates = getPlanDates(weekStart);
  const dayAssignments: MealAssignment[] = old.dayAssignments.map((a) => {
    const index = DAY_KEYS.indexOf(a.day);
    return { id: generateId('meal'), date: planDates[index] ?? planDates[0], recipeId: a.recipeId };
  });
  // servingsPerMeal backfilled to 1: old plans' ingredientDemandSnapshot was
  // already computed without a servings multiplier, so 1 preserves their
  // original (recorded) totals rather than retroactively rescaling history.
  return { ...old, weekStartDate, planDates, pricingStrategy: 'cheapest', servingsPerMeal: 1, dayAssignments };
}

/** One-time lazy migration: if v2 has no data yet but v1 does, upgrade and persist under v2. */
function migratePlanHistoryIfNeeded(): void {
  const v2Existing = safeGet<WeeklyPlan[] | null>(STORAGE_KEYS.planHistory, null);
  if (v2Existing !== null) return;
  const v1History = safeGet<WeeklyPlanV1[]>(STORAGE_KEYS.planHistoryV1, []);
  if (v1History.length === 0) {
    safeSet(STORAGE_KEYS.planHistory, []);
    return;
  }
  try {
    safeSet(STORAGE_KEYS.planHistory, v1History.map(migratePlanV1ToV2));
  } catch {
    safeSet(STORAGE_KEYS.planHistory, []);
  }
}

export function getPlanHistory(): WeeklyPlan[] {
  migratePlanHistoryIfNeeded();
  return safeGet<WeeklyPlan[]>(STORAGE_KEYS.planHistory, []);
}

export function savePlanToHistory(plan: WeeklyPlan): void {
  const history = getPlanHistory();
  const next = [plan, ...history.filter((p) => p.id !== plan.id)].slice(0, PLAN_HISTORY_LIMIT);
  safeSet(STORAGE_KEYS.planHistory, next);
}

export function removePlanFromHistory(planId: string): void {
  const history = getPlanHistory();
  safeSet(STORAGE_KEYS.planHistory, history.filter((p) => p.id !== planId));
}

export function getSwipeHistory(): SwipeHistoryEntry[] {
  return safeGet<SwipeHistoryEntry[]>(STORAGE_KEYS.swipeHistory, []);
}

export function appendSwipeHistory(entry: SwipeHistoryEntry): void {
  const history = getSwipeHistory();
  safeSet(STORAGE_KEYS.swipeHistory, [...history, entry]);
}

/** Removes the most recent swipe history entry — pairs with the swipe-undo feature. */
export function popLastSwipeHistory(): void {
  const history = getSwipeHistory();
  if (history.length === 0) return;
  safeSet(STORAGE_KEYS.swipeHistory, history.slice(0, -1));
}

export function getAffinityScores(): AffinityScores {
  return safeGet<AffinityScores>(STORAGE_KEYS.affinityScores, {});
}

export function saveAffinityScores(scores: AffinityScores): void {
  safeSet(STORAGE_KEYS.affinityScores, scores);
}

export function getAffinityDecayWeek(): string | null {
  return safeGet<string | null>(STORAGE_KEYS.affinityDecayWeek, null);
}

export function saveAffinityDecayWeek(weekKey: string): void {
  safeSet(STORAGE_KEYS.affinityDecayWeek, weekKey);
}
