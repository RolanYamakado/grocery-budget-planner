import type { AffinityScores, MealAssignment, SwipeHistoryEntry, WeeklyPlan } from '../types';
import { PLAN_HISTORY_LIMIT, STORAGE_KEYS, SWIPE_HISTORY_LIMIT } from '../data/constants';
import { DAY_KEYS, getPlanDates, toIsoDateString } from './weekUtils';
import { generateId } from './idUtils';
import { supabase } from './supabaseClient';
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

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
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
  return { ...old, weekStartDate, planDates, pricingStrategy: 'cheapest', servingsPerMeal: 1, dayAssignments };
}

function readLegacyPlanHistory(): WeeklyPlan[] {
  const v2 = safeGet<WeeklyPlan[] | null>(STORAGE_KEYS.planHistory, null);
  if (v2 !== null) return v2;
  const v1 = safeGet<WeeklyPlanV1[]>(STORAGE_KEYS.planHistoryV1, []);
  return v1.map(migratePlanV1ToV2);
}

// ---------------------------------------------------------------------------
// In-memory cache backing every getter below. Hydrated from Supabase on sign-in
// (initSyncForUser) and mirrored into localStorage as a same-origin, same-tab
// fallback/fast-path. Reads stay perfectly synchronous — CONFIRM_RESULTS calls
// getPlanHistory() inside a reducer, which cannot await.
// ---------------------------------------------------------------------------
interface UserDataCache {
  planHistory: WeeklyPlan[];
  swipeHistory: SwipeHistoryEntry[];
  affinityScores: AffinityScores;
  affinityDecayWeek: string | null;
}

function emptyCache(): UserDataCache {
  return { planHistory: [], swipeHistory: [], affinityScores: {}, affinityDecayWeek: null };
}

let cache: UserDataCache = emptyCache();
let currentUserId: string | null = null;

function persistLocalMirror(): void {
  safeSet(STORAGE_KEYS.planHistory, cache.planHistory);
  safeSet(STORAGE_KEYS.swipeHistory, cache.swipeHistory);
  safeSet(STORAGE_KEYS.affinityScores, cache.affinityScores);
  safeSet(STORAGE_KEYS.affinityDecayWeek, cache.affinityDecayWeek);
}

// Serialized write queue: every sync reads `cache` at EXECUTION time (not call
// time) and runs strictly in enqueue order, so whichever write was queued last
// always carries the freshest state and finishes last — a naive per-call
// fire-and-forget upsert can have its network response arrive out of order and
// clobber a newer write with an older snapshot even though each payload is a
// "whole row." Known v1 limitation: this only serializes one browser tab: two
// tabs/devices signed into the same account concurrently can still last-write-
// wins clobber each other. Not worth CRDT-style merging for a personal planner.
let queueTail: Promise<void> = Promise.resolve();

function enqueueServerSync(): Promise<void> {
  if (!currentUserId) return Promise.resolve();
  const userId = currentUserId;
  const attempt = queueTail.then(async () => {
    const { error } = await supabase.from('user_data').upsert({
      user_id: userId,
      plan_history: cache.planHistory,
      swipe_history: cache.swipeHistory,
      affinity_scores: cache.affinityScores,
      affinity_decay_week: cache.affinityDecayWeek,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  });
  queueTail = attempt.then(
    () => undefined,
    () => undefined, // never let one failed write stall later ones in the queue
  );
  return attempt;
}

interface UserDataRow {
  plan_history: WeeklyPlan[];
  swipe_history: SwipeHistoryEntry[];
  affinity_scores: AffinityScores;
  affinity_decay_week: string | null;
}

/**
 * Called once on sign-in. Atomically seeds the server row if it doesn't exist
 * yet (using whatever's currently in the local cache/localStorage as the seed),
 * then unconditionally re-pulls and treats the server as authoritative —
 * regardless of whether this tab's own insert won the race.
 *
 * This specifically avoids a data-loss race with Supabase's default email-
 * confirmation flow: signUp() returns no session until the confirmation link is
 * clicked, which commonly completes in a different tab. A naive "check if
 * missing, then act" has a read/act gap a second tab can race through — if the
 * *empty* tab's insert won, a naive design would let the tab holding real
 * pre-signup data trust its own cache and never re-pull, silently losing it.
 * `ignoreDuplicates` makes the seed atomic, and the unconditional re-pull here
 * means whichever insert actually landed becomes the truth for every tab.
 */
export async function initSyncForUser(userId: string): Promise<void> {
  currentUserId = userId;

  const seedCandidate = cache.planHistory.length || cache.swipeHistory.length ? cache : { ...cache, planHistory: readLegacyPlanHistory() };

  await supabase.from('user_data').upsert(
    {
      user_id: userId,
      plan_history: seedCandidate.planHistory,
      swipe_history: seedCandidate.swipeHistory,
      affinity_scores: seedCandidate.affinityScores,
      affinity_decay_week: seedCandidate.affinityDecayWeek,
    },
    { onConflict: 'user_id', ignoreDuplicates: true },
  );

  const { data, error } = await supabase
    .from('user_data')
    .select('plan_history, swipe_history, affinity_scores, affinity_decay_week')
    .eq('user_id', userId)
    .single<UserDataRow>();

  if (error || !data) {
    // Network hiccup right after sign-in — fall back to whatever we had locally
    // rather than wiping the UI; the next write will retry the sync.
    return;
  }

  cache = {
    planHistory: data.plan_history ?? [],
    swipeHistory: data.swipe_history ?? [],
    affinityScores: data.affinity_scores ?? {},
    affinityDecayWeek: data.affinity_decay_week ?? null,
  };
  persistLocalMirror();
}

/** Called on sign-out — prevents a different person on a shared browser from seeing leftover data. */
export function clearSync(): void {
  currentUserId = null;
  cache = emptyCache();
  safeRemove(STORAGE_KEYS.planHistory);
  safeRemove(STORAGE_KEYS.planHistoryV1);
  safeRemove(STORAGE_KEYS.swipeHistory);
  safeRemove(STORAGE_KEYS.affinityScores);
  safeRemove(STORAGE_KEYS.affinityDecayWeek);
}

export function getPlanHistory(): WeeklyPlan[] {
  return cache.planHistory;
}

export async function savePlanToHistory(plan: WeeklyPlan): Promise<void> {
  cache.planHistory = [plan, ...cache.planHistory.filter((p) => p.id !== plan.id)].slice(0, PLAN_HISTORY_LIMIT);
  persistLocalMirror();
  await enqueueServerSync();
}

export async function removePlanFromHistory(planId: string): Promise<void> {
  cache.planHistory = cache.planHistory.filter((p) => p.id !== planId);
  persistLocalMirror();
  await enqueueServerSync();
}

export function getSwipeHistory(): SwipeHistoryEntry[] {
  return cache.swipeHistory;
}

export function appendSwipeHistory(entry: SwipeHistoryEntry): void {
  cache.swipeHistory = [...cache.swipeHistory, entry].slice(-SWIPE_HISTORY_LIMIT);
  persistLocalMirror();
  void enqueueServerSync();
}

/** Removes the most recent swipe history entry — pairs with the swipe-undo feature. */
export function popLastSwipeHistory(): void {
  if (cache.swipeHistory.length === 0) return;
  cache.swipeHistory = cache.swipeHistory.slice(0, -1);
  persistLocalMirror();
  void enqueueServerSync();
}

export function getAffinityScores(): AffinityScores {
  return cache.affinityScores;
}

export function saveAffinityScores(scores: AffinityScores): void {
  cache.affinityScores = scores;
  persistLocalMirror();
  void enqueueServerSync();
}

export function getAffinityDecayWeek(): string | null {
  return cache.affinityDecayWeek;
}

export function saveAffinityDecayWeek(weekKey: string): void {
  cache.affinityDecayWeek = weekKey;
  persistLocalMirror();
  void enqueueServerSync();
}
