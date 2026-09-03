import type { StoreId, StoreTier } from '../types';

export const STORE_TIER: Record<StoreId, StoreTier> = {
  aldi: 'budget',
  lidl: 'budget',
  asda: 'mid',
  morrisons: 'mid',
  tesco: 'mid',
  sainsburys: 'mid',
  coop: 'mid',
  waitrose: 'premium',
  mands: 'premium',
};

export const TIER_MULTIPLIER: Record<StoreTier, number> = {
  budget: 0.85,
  mid: 1.0,
  premium: 1.18,
};

export const LONDON_MULTIPLIER = 1.12;

export const BUDGET_TOLERANCE_GBP = 5;

export const AFFINITY_CAP = 5;
export const AFFINITY_DECAY_FACTOR = 0.9;

export const MIN_DECK_SIZE = 6;

export const MAX_MEALS_PER_WEEK = 99;

export const PLAN_HISTORY_LIMIT = 8;

export const LEFTOVER_LOOKBACK_DAYS = 14;

/**
 * Only `planHistory` bumped to v2 (WeeklyPlan shape changed: MealAssignment[]
 * instead of DayAssignment[], plus planDates/pricingStrategy). Swipe history and
 * affinity scores are unchanged shapes, so they stay on their v1 keys.
 */
export const STORAGE_KEYS = {
  planHistoryV1: 'gbp:v1:planHistory',
  planHistory: 'gbp:v2:planHistory',
  swipeHistory: 'gbp:v1:swipeHistory',
  affinityScores: 'gbp:v1:affinityScores',
  affinityDecayWeek: 'gbp:v1:affinityDecayWeek',
};
