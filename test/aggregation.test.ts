import { describe, expect, it } from 'vitest';
import {
  applyAlreadyHaveOverrides,
  applyLeftoverOverrides,
  applyLeftovers,
  applyPantryOverrides,
  computeRawDemand,
  computeShoppingListTotal,
  deriveSelectionsFromAssignments,
  estimateSelectionsCost,
  fitToBudget,
  getAvailableLeftovers,
  resolveShoppingLine,
  resolveShoppingListForStrategy,
} from '../src/lib/aggregation';
import { formatWeekRangeDDMMYYYY, getPlanDates } from '../src/lib/weekUtils';
import type { Ingredient, MealAssignment, ShoppingListLine, WeeklyPlan } from '../src/types';

const potatoes: Ingredient = {
  id: 'potatoes',
  name: 'Potatoes',
  category: 'carb',
  isPantryItem: false,
  unit: 'g',
  packageSize: 2500,
  packageUnit: 'g',
  packageLabel: '2.5kg bag',
  referencePriceGBP: 3.0,
};

const salt: Ingredient = {
  id: 'salt',
  name: 'Salt',
  category: 'pantry',
  isPantryItem: true,
  unit: 'g',
  packageSize: 750,
  packageUnit: 'g',
  packageLabel: '750g tub',
  referencePriceGBP: 0.45,
};

const ingredientsById = { potatoes, salt };

describe('computeRawDemand', () => {
  it('sums quantity x mealCount across recipes sharing an ingredient', () => {
    const recipesById = {
      r1: { ingredients: [{ ingredientId: 'potatoes', quantity: 200, unit: 'g' as const }] },
      r2: { ingredients: [{ ingredientId: 'potatoes', quantity: 100, unit: 'g' as const }] },
    };
    const demand = computeRawDemand(
      [{ recipeId: 'r1', mealCount: 3 }, { recipeId: 'r2', mealCount: 2 }],
      recipesById,
    );
    expect(demand).toEqual([{ ingredientId: 'potatoes', quantity: 800, unit: 'g' }]);
  });

  it('scales demand by servingsPerMeal — ingredient quantities are per single serving', () => {
    const recipesById = {
      r1: { ingredients: [{ ingredientId: 'potatoes', quantity: 200, unit: 'g' as const }] },
    };
    const demand = computeRawDemand([{ recipeId: 'r1', mealCount: 3 }], recipesById, 2);
    expect(demand).toEqual([{ ingredientId: 'potatoes', quantity: 1200, unit: 'g' }]); // 200 x 3 x 2
  });

  it('defaults servingsPerMeal to 1 when omitted', () => {
    const recipesById = {
      r1: { ingredients: [{ ingredientId: 'potatoes', quantity: 200, unit: 'g' as const }] },
    };
    const demand = computeRawDemand([{ recipeId: 'r1', mealCount: 3 }], recipesById);
    expect(demand).toEqual([{ ingredientId: 'potatoes', quantity: 600, unit: 'g' }]);
  });
});

describe('leftover crossover', () => {
  function planWithPurchase(weekStartDate: string, purchasedG: number, usedG: number): WeeklyPlan {
    return {
      id: weekStartDate,
      weekStartDate,
      planDates: getPlanDates(new Date(`${weekStartDate}T00:00:00`)),
      createdAt: `${weekStartDate}T00:00:00Z`,
      budgetGBP: 40,
      region: 'rest-of-uk',
      stores: ['tesco'],
      pricingStrategy: 'cheapest',
      servingsPerMeal: 1,
      mealsTarget: 5,
      dietPreference: 'balanced',
      selections: [],
      dayAssignments: [],
      ingredientDemandSnapshot: [{ ingredientId: 'potatoes', quantity: usedG, unit: 'g' }],
      shoppingList: [
        {
          ingredientId: 'potatoes',
          storeId: 'tesco',
          packagesNeeded: Math.ceil(purchasedG / potatoes.packageSize),
          packageSize: potatoes.packageSize,
          packageUnit: 'g',
          packageLabel: potatoes.packageLabel,
          lineCostGBP: 3.0,
          isPantryItem: false,
          isLeftoverReused: false,
        },
      ],
      totalCostGBP: 3.0,
      overBudgetGBP: 0,
    };
  }

  it('finds surplus from a prior week where less was used than purchased', () => {
    const history = [planWithPurchase('2026-08-24', 2500, 500)];
    const leftovers = getAvailableLeftovers(history, '2026-08-31');
    expect(leftovers.get('potatoes')?.qty).toBe(2000);
  });

  it('ignores weeks outside the 1-2 week lookback window', () => {
    const history = [planWithPurchase('2026-08-03', 2500, 500)];
    const leftovers = getAvailableLeftovers(history, '2026-08-31');
    expect(leftovers.has('potatoes')).toBe(false);
  });

  it('offsets net demand and produces a note when leftovers partially cover demand', () => {
    const leftovers = new Map([['potatoes', { qty: 300, sourceWeek: '2026-08-24' }]]);
    const { netDemand } = applyLeftovers(
      [{ ingredientId: 'potatoes', quantity: 800, unit: 'g' }],
      leftovers,
      ingredientsById,
    );
    expect(netDemand[0].quantity).toBe(500);
    expect(netDemand[0].leftoverNote).toContain('leftover potatoes');
  });

  it('never goes negative when leftovers exceed demand', () => {
    const leftovers = new Map([['potatoes', { qty: 5000, sourceWeek: '2026-08-24' }]]);
    const { netDemand } = applyLeftovers(
      [{ ingredientId: 'potatoes', quantity: 800, unit: 'g' }],
      leftovers,
      ingredientsById,
    );
    expect(netDemand[0].quantity).toBe(0);
  });

  it('does not double-discount: raw snapshot in history stays raw regardless of that week own leftover reuse', () => {
    // Week 2 reused leftovers from week 1 (net purchase much lower than raw demand),
    // but its stored snapshot is RAW demand — so week 3 computing off week 2 sees the truth.
    const week1 = planWithPurchase('2026-08-17', 2500, 500); // surplus 2000 after week 1
    const week2 = planWithPurchase('2026-08-24', 0, 800); // bought nothing (used week 1 leftover), used 800 raw
    const history = [week1, week2];
    const leftovers = getAvailableLeftovers(history, '2026-08-31');
    // Nearest week (week2) purchased 0, used 800 -> surplus = -800 -> no leftover carried from week2.
    expect(leftovers.has('potatoes')).toBe(false);
  });

  it('works with a non-Monday plan start date (day-based lookback, not ISO-week-bucket based)', () => {
    const history = [planWithPurchase('2026-08-26', 2500, 500)]; // a Wednesday
    const leftovers = getAvailableLeftovers(history, '2026-09-02'); // 7 days later, also Wednesday
    expect(leftovers.get('potatoes')?.qty).toBe(2000);
  });
});

describe('deriveSelectionsFromAssignments', () => {
  it('counts non-null recipe assignments by recipeId', () => {
    const assignments: MealAssignment[] = [
      { id: 'a', date: '2026-09-01', recipeId: 'r1' },
      { id: 'b', date: '2026-09-01', recipeId: 'r2' },
      { id: 'c', date: '2026-09-02', recipeId: 'r1' },
      { id: 'd', date: '2026-09-03', recipeId: null },
    ];
    const selections = deriveSelectionsFromAssignments(assignments);
    expect(selections).toEqual(
      expect.arrayContaining([
        { recipeId: 'r1', mealCount: 2 },
        { recipeId: 'r2', mealCount: 1 },
      ]),
    );
    expect(selections.length).toBe(2);
  });

  it('returns an empty array when nothing is assigned', () => {
    expect(deriveSelectionsFromAssignments([])).toEqual([]);
  });
});

describe('resolveShoppingListForStrategy', () => {
  const netDemand = [{ ingredientId: 'potatoes', quantity: 3000, unit: 'g' as const }];

  it('cheapest strategy matches the existing resolveShoppingLine + fitToBudget pipeline', () => {
    const result = resolveShoppingListForStrategy(netDemand, 'cheapest', ['waitrose', 'aldi'], 'rest-of-uk', ingredientsById, 40);
    expect(result.lines[0].storeId).toBe('aldi');
  });

  it('falls back to cheapest when fewer than 2 stores are selected, even if balanced-upgrade is requested', () => {
    const result = resolveShoppingListForStrategy(netDemand, 'balanced-upgrade', ['aldi'], 'rest-of-uk', ingredientsById, 40);
    expect(result.lines[0].storeId).toBe('aldi');
  });

  it('balanced-upgrade never exceeds budget + tolerance', () => {
    const rng = () => 0.99; // always picks the priciest random store
    const result = resolveShoppingListForStrategy(
      netDemand,
      'balanced-upgrade',
      ['waitrose', 'aldi'],
      'rest-of-uk',
      ingredientsById,
      1,
      rng,
    );
    expect(result.total).toBeLessThanOrEqual(1 + 5);
  });

  it('balanced-upgrade spends headroom upgrading protein lines when budget allows', () => {
    const proteinDemand = [{ ingredientId: 'potatoes', quantity: 2500, unit: 'g' as const }];
    const proteinIngredientsById = {
      potatoes: { ...potatoes, category: 'protein' as const },
    };
    const rng = () => 0; // always picks the cheapest random store first
    const result = resolveShoppingListForStrategy(
      proteinDemand,
      'balanced-upgrade',
      ['aldi', 'waitrose'],
      'rest-of-uk',
      proteinIngredientsById,
      100, // huge headroom
      rng,
    );
    // With huge headroom, the protein-upgrade pass should move it to the priciest store (waitrose).
    expect(result.lines[0].storeId).toBe('waitrose');
  });
});

describe('resolveShoppingLine', () => {
  it('rounds demand up to whole packages and picks the cheapest available store', () => {
    const line = resolveShoppingLine(potatoes, 3000, ['waitrose', 'aldi'], 'rest-of-uk');
    expect(line.packagesNeeded).toBe(2); // ceil(3000/2500)
    expect(line.storeId).toBe('aldi'); // cheaper tier
    expect(line.lineCostGBP).toBeGreaterThan(0);
  });

  it('zeroes out cost for pantry items while still reporting a package', () => {
    const line = resolveShoppingLine(salt, 100, ['tesco'], 'rest-of-uk');
    expect(line.isPantryItem).toBe(true);
    expect(line.lineCostGBP).toBe(0);
  });

  it('marks a fully-offset ingredient as leftover-reused with zero packages', () => {
    const line = resolveShoppingLine(potatoes, 0, ['tesco'], 'rest-of-uk', 'Reusing leftover potatoes from week of 2026-08-24');
    expect(line.packagesNeeded).toBe(0);
    expect(line.isLeftoverReused).toBe(true);
    expect(line.lineCostGBP).toBe(0);
  });
});

describe('fitToBudget', () => {
  function line(overrides: Partial<ShoppingListLine>): ShoppingListLine {
    return {
      ingredientId: 'potatoes',
      storeId: 'waitrose',
      packagesNeeded: 1,
      packageSize: 2500,
      packageUnit: 'g',
      packageLabel: '2.5kg bag',
      lineCostGBP: 3.54,
      isPantryItem: false,
      isLeftoverReused: false,
      ...overrides,
    };
  }

  it('leaves the list untouched when already within budget + tolerance', () => {
    const lines = [line({ lineCostGBP: 10 })];
    const result = fitToBudget(lines, 40, ingredientsById, 'rest-of-uk');
    expect(result.total).toBe(10);
    expect(result.lines[0].storeId).toBe('waitrose');
  });

  it('switches the costliest line to a cheaper store when over budget + tolerance', () => {
    const lines = [line({ lineCostGBP: 20, storeId: 'waitrose' })];
    const result = fitToBudget(lines, 1, ingredientsById, 'rest-of-uk');
    expect(result.total).toBeLessThan(20);
    expect(result.lines[0].storeId).not.toBe('waitrose');
  });

  it('never increases total cost', () => {
    const lines = [line({ lineCostGBP: 3.54 }), line({ ingredientId: 'potatoes', lineCostGBP: 5, storeId: 'mands' })];
    const before = lines.reduce((s, l) => s + l.lineCostGBP, 0);
    const result = fitToBudget(lines, 1, ingredientsById, 'rest-of-uk');
    expect(result.total).toBeLessThanOrEqual(before);
  });
});

describe('applyLeftoverOverrides / applyPantryOverrides', () => {
  function planWithLeftoverLine(): WeeklyPlan {
    return {
      id: 'p1',
      weekStartDate: '2026-08-31',
      planDates: getPlanDates(new Date('2026-08-31T00:00:00')),
      createdAt: '2026-08-31T00:00:00Z',
      budgetGBP: 40,
      region: 'rest-of-uk',
      stores: ['tesco'],
      pricingStrategy: 'cheapest',
      servingsPerMeal: 1,
      mealsTarget: 5,
      dietPreference: 'balanced',
      selections: [],
      dayAssignments: [],
      ingredientDemandSnapshot: [{ ingredientId: 'potatoes', quantity: 800, unit: 'g' }],
      shoppingList: [
        {
          ingredientId: 'potatoes',
          storeId: null,
          packagesNeeded: 0,
          packageSize: 2500,
          packageUnit: 'g',
          packageLabel: '2.5kg bag',
          lineCostGBP: 0,
          isPantryItem: false,
          isLeftoverReused: true,
          leftoverNote: 'Reusing leftover potatoes from week of 24/08/2026 - 30/08/2026',
        },
        {
          ingredientId: 'salt',
          storeId: 'tesco',
          packagesNeeded: 1,
          packageSize: 750,
          packageUnit: 'g',
          packageLabel: '750g tub',
          lineCostGBP: 0,
          isPantryItem: true,
          isLeftoverReused: false,
        },
      ],
      totalCostGBP: 0,
      overBudgetGBP: 0,
    };
  }

  it('recomputes a fully-covered leftover line from raw demand when disabled', () => {
    const plan = planWithLeftoverLine();
    const list = applyLeftoverOverrides(
      plan.shoppingList,
      plan.ingredientDemandSnapshot,
      new Set(['potatoes']),
      plan.stores,
      plan.region,
      ingredientsById,
    );
    expect(list[0].packagesNeeded).toBe(1); // ceil(800/2500)
    expect(list[0].lineCostGBP).toBeGreaterThan(0);
    expect(computeShoppingListTotal(list)).toBeGreaterThan(0);
  });

  it('leaves the line untouched when not in the disabled set', () => {
    const plan = planWithLeftoverLine();
    const list = applyLeftoverOverrides(
      plan.shoppingList,
      plan.ingredientDemandSnapshot,
      new Set(),
      plan.stores,
      plan.region,
      ingredientsById,
    );
    expect(list[0].packagesNeeded).toBe(0);
    expect(computeShoppingListTotal(list)).toBe(0);
  });

  it('includes a pantry item cost and flips isPantryItem when toggled "don\'t have"', () => {
    const plan = planWithLeftoverLine();
    const list = applyPantryOverrides(plan.shoppingList, new Set(['salt']), plan.region, ingredientsById);
    const saltLine = list.find((l) => l.ingredientId === 'salt')!;
    expect(saltLine.isPantryItem).toBe(false);
    expect(saltLine.lineCostGBP).toBeGreaterThan(0);
    expect(computeShoppingListTotal(list)).toBe(saltLine.lineCostGBP);
  });

  it('leaves pantry cost at zero when not toggled', () => {
    const plan = planWithLeftoverLine();
    const list = applyPantryOverrides(plan.shoppingList, new Set(), plan.region, ingredientsById);
    expect(list.find((l) => l.ingredientId === 'salt')!.lineCostGBP).toBe(0);
  });

  it('composes: leftover-disable and pantry-include can both apply at once', () => {
    const plan = planWithLeftoverLine();
    let list = applyLeftoverOverrides(
      plan.shoppingList,
      plan.ingredientDemandSnapshot,
      new Set(['potatoes']),
      plan.stores,
      plan.region,
      ingredientsById,
    );
    list = applyPantryOverrides(list, new Set(['salt']), plan.region, ingredientsById);
    expect(list.find((l) => l.ingredientId === 'potatoes')!.lineCostGBP).toBeGreaterThan(0);
    expect(list.find((l) => l.ingredientId === 'salt')!.lineCostGBP).toBeGreaterThan(0);
  });
});

describe('applyAlreadyHaveOverrides', () => {
  function purchasableLine(): ShoppingListLine {
    return {
      ingredientId: 'potatoes',
      storeId: 'tesco',
      packagesNeeded: 1,
      packageSize: 2500,
      packageUnit: 'g',
      packageLabel: '2.5kg bag',
      lineCostGBP: 3.0,
      isPantryItem: false,
      isLeftoverReused: false,
    };
  }

  it('zeroes out a purchasable line when marked already-have', () => {
    const list = applyAlreadyHaveOverrides([purchasableLine()], new Set(['potatoes']));
    expect(list[0].packagesNeeded).toBe(0);
    expect(list[0].lineCostGBP).toBe(0);
  });

  it('leaves the line untouched when not marked', () => {
    const list = applyAlreadyHaveOverrides([purchasableLine()], new Set());
    expect(list[0].lineCostGBP).toBe(3.0);
  });

  it('never touches pantry items', () => {
    const pantryLine: ShoppingListLine = { ...purchasableLine(), ingredientId: 'salt', isPantryItem: true, lineCostGBP: 0 };
    const list = applyAlreadyHaveOverrides([pantryLine], new Set(['salt']));
    expect(list[0]).toEqual(pantryLine);
  });
});

describe('estimateSelectionsCost', () => {
  const recipesById = {
    r1: { ingredients: [{ ingredientId: 'potatoes', quantity: 500, unit: 'g' as const }] },
  };

  it('estimates cost from cheapest available store, ignoring pantry items', () => {
    const cost = estimateSelectionsCost(
      [{ recipeId: 'r1', mealCount: 5 }],
      recipesById,
      ingredientsById,
      ['waitrose', 'aldi'],
      'rest-of-uk',
    );
    // 500g x 5 = 2500g -> ceil(2500/2500) = 1 package, cheapest store (aldi tier)
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeCloseTo(potatoes.referencePriceGBP * 0.85, 2);
  });

  it('returns 0 for no selections', () => {
    expect(estimateSelectionsCost([], recipesById, ingredientsById, ['tesco'], 'rest-of-uk')).toBe(0);
  });
});

describe('formatWeekRangeDDMMYYYY', () => {
  it('formats a week start ISO date as a dd/mm/yyyy range', () => {
    expect(formatWeekRangeDDMMYYYY('2026-08-24')).toBe('24/08/2026 - 30/08/2026');
  });
});
