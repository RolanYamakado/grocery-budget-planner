import type { Ingredient, Region, StoreId } from '../types';
import { LONDON_MULTIPLIER, STORE_TIER, TIER_MULTIPLIER } from '../data/constants';

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Derives an ingredient's price at a given store/region from its single
 * reference price (mid-tier, rest-of-UK) rather than authoring a full
 * ingredient x store x region price matrix.
 */
export function getIngredientPrice(
  ingredient: Ingredient,
  storeId: StoreId,
  region: Region,
): number | null {
  if (ingredient.storeAvailability && !ingredient.storeAvailability.includes(storeId)) {
    return null;
  }
  const override = ingredient.priceOverrides?.find((o) => o.storeId === storeId);
  const base = override
    ? override.priceGBP
    : ingredient.referencePriceGBP * TIER_MULTIPLIER[STORE_TIER[storeId]];
  const regionMultiplier = region === 'london' ? LONDON_MULTIPLIER : 1;
  return round2(base * regionMultiplier);
}

export interface StorePriceOption {
  storeId: StoreId;
  price: number;
}

/** All stores where this ingredient is available, priced for the given region, cheapest first. */
export function getAllStorePrices(
  ingredient: Ingredient,
  storeIds: StoreId[],
  region: Region,
): StorePriceOption[] {
  return storeIds
    .map((storeId) => ({ storeId, price: getIngredientPrice(ingredient, storeId, region) }))
    .filter((o): o is StorePriceOption => o.price !== null)
    .sort((a, b) => a.price - b.price);
}
