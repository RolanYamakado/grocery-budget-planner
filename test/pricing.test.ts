import { describe, expect, it } from 'vitest';
import { getIngredientPrice, getAllStorePrices, round2 } from '../src/lib/pricing';
import { INGREDIENTS_BY_ID } from '../src/data/ingredients';
import { LONDON_MULTIPLIER, TIER_MULTIPLIER } from '../src/data/constants';

describe('pricing', () => {
  const rice = INGREDIENTS_BY_ID['rice-basmati'];

  it('applies the mid-tier multiplier (1.0) at rest-of-uk for a mid-tier store', () => {
    expect(getIngredientPrice(rice, 'tesco', 'rest-of-uk')).toBe(round2(rice.referencePriceGBP));
  });

  it('applies the budget-tier discount at a budget store', () => {
    expect(getIngredientPrice(rice, 'aldi', 'rest-of-uk')).toBe(round2(rice.referencePriceGBP * TIER_MULTIPLIER.budget));
  });

  it('applies the premium-tier markup at a premium store', () => {
    expect(getIngredientPrice(rice, 'waitrose', 'rest-of-uk')).toBe(
      round2(rice.referencePriceGBP * TIER_MULTIPLIER.premium),
    );
  });

  it('applies the London multiplier on top of the tier multiplier', () => {
    const restOfUk = getIngredientPrice(rice, 'tesco', 'rest-of-uk')!;
    const london = getIngredientPrice(rice, 'tesco', 'london')!;
    expect(london).toBe(round2(restOfUk * LONDON_MULTIPLIER));
  });

  it('prefers an explicit price override over the derived tier price', () => {
    const withOverride = {
      ...rice,
      priceOverrides: [{ storeId: 'aldi' as const, priceGBP: 0.99 }],
    };
    expect(getIngredientPrice(withOverride, 'aldi', 'rest-of-uk')).toBe(0.99);
  });

  it('returns null when the ingredient is not available at a store', () => {
    const restricted = { ...rice, storeAvailability: ['tesco' as const] };
    expect(getIngredientPrice(restricted, 'aldi', 'rest-of-uk')).toBeNull();
  });

  it('sorts store options cheapest-first and excludes unavailable stores', () => {
    const restricted = { ...rice, storeAvailability: ['waitrose' as const, 'aldi' as const] };
    const options = getAllStorePrices(restricted, ['waitrose', 'aldi', 'tesco'], 'rest-of-uk');
    expect(options.map((o) => o.storeId)).toEqual(['aldi', 'waitrose']);
  });
});
