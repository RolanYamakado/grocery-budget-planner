import type {
  Ingredient,
  IngredientDemand,
  MealAssignment,
  PricingStrategy,
  Region,
  ShoppingListLine,
  StoreId,
  WeeklyPlan,
  WeeklyPlanRecipeSelection,
} from '../types';
import { STORES } from '../data/stores';
import { BUDGET_TOLERANCE_GBP, LEFTOVER_LOOKBACK_DAYS } from '../data/constants';
import { getAllStorePrices, getIngredientPrice, round2 } from './pricing';
import { daysBetween, formatWeekRangeDDMMYYYY } from './weekUtils';

const ALL_STORE_IDS: StoreId[] = STORES.map((s) => s.id);

/**
 * Recipe ingredient quantities are per single serving/portion. `servingsPerMeal`
 * scales that up to how many people each meal instance actually feeds — e.g. a
 * mealCount of 3 at servingsPerMeal 2 needs 6 portions' worth of ingredients.
 */
export function computeRawDemand(
  selections: WeeklyPlanRecipeSelection[],
  recipesById: Record<string, { ingredients: { ingredientId: string; quantity: number; unit: IngredientDemand['unit'] }[] }>,
  servingsPerMeal: number = 1,
): IngredientDemand[] {
  const demand = new Map<string, IngredientDemand>();
  for (const selection of selections) {
    const recipe = recipesById[selection.recipeId];
    if (!recipe) continue;
    for (const ref of recipe.ingredients) {
      const existing = demand.get(ref.ingredientId);
      const addQty = ref.quantity * selection.mealCount * servingsPerMeal;
      if (existing) {
        existing.quantity += addQty;
      } else {
        demand.set(ref.ingredientId, { ingredientId: ref.ingredientId, quantity: addQty, unit: ref.unit });
      }
    }
  }
  return [...demand.values()];
}

interface LeftoverInfo {
  qty: number;
  sourceWeek: string;
}

/**
 * Looks at the last 1-2 weeks' plans for surplus (purchased-but-unused) quantity
 * of each ingredient. `ingredientDemandSnapshot` on stored plans must stay RAW
 * (pre-leftover), otherwise a second consecutive reuse would double-discount.
 */
export function getAvailableLeftovers(
  history: WeeklyPlan[],
  currentWeekStart: string,
): Map<string, LeftoverInfo> {
  const priorPlans = history
    .filter((p) => {
      const diff = daysBetween(p.weekStartDate, currentWeekStart);
      return diff >= 1 && diff <= LEFTOVER_LOOKBACK_DAYS;
    })
    .sort((a, b) => (a.weekStartDate < b.weekStartDate ? 1 : -1)); // most recent week first

  const leftovers = new Map<string, LeftoverInfo>();
  // Once the NEAREST week that touched an ingredient has been read, older weeks are
  // skipped for it — even if that nearest week had no surplus. Otherwise a stale
  // surplus from 2 weeks back could be "rediscovered" after an intervening week
  // already consumed it, crediting the same physical leftover twice.
  const resolved = new Set<string>();
  for (const plan of priorPlans) {
    for (const line of plan.shoppingList) {
      if (line.isPantryItem || resolved.has(line.ingredientId)) continue;
      resolved.add(line.ingredientId);
      const purchasedQty = line.packagesNeeded * line.packageSize;
      const usedQty = plan.ingredientDemandSnapshot.find((d) => d.ingredientId === line.ingredientId)?.quantity ?? 0;
      const surplus = purchasedQty - usedQty;
      if (surplus > 0) {
        leftovers.set(line.ingredientId, { qty: surplus, sourceWeek: plan.weekStartDate });
      }
    }
  }
  return leftovers;
}

export interface NetDemandResult {
  netDemand: (IngredientDemand & { leftoverNote?: string })[];
}

export function applyLeftovers(
  rawDemand: IngredientDemand[],
  leftovers: Map<string, LeftoverInfo>,
  ingredientsById: Record<string, Ingredient>,
): NetDemandResult {
  const netDemand = rawDemand.map((d) => {
    const leftover = leftovers.get(d.ingredientId);
    if (!leftover) return { ...d };
    const remaining = Math.max(0, d.quantity - leftover.qty);
    const name = ingredientsById[d.ingredientId]?.name ?? d.ingredientId;
    const leftoverNote =
      remaining < d.quantity
        ? `Reusing leftover ${name.toLowerCase()} from week of ${formatWeekRangeDDMMYYYY(leftover.sourceWeek)}`
        : undefined;
    return { ...d, quantity: remaining, leftoverNote };
  });
  return { netDemand };
}

export function resolveShoppingLine(
  ingredient: Ingredient,
  netQuantity: number,
  userStores: StoreId[],
  region: Region,
  leftoverNote?: string,
): ShoppingListLine {
  const base = {
    ingredientId: ingredient.id,
    packageSize: ingredient.packageSize,
    packageUnit: ingredient.packageUnit,
    packageLabel: ingredient.packageLabel,
    isPantryItem: ingredient.isPantryItem,
    leftoverNote,
  };

  if (netQuantity <= 0) {
    return {
      ...base,
      storeId: null,
      packagesNeeded: 0,
      lineCostGBP: 0,
      isLeftoverReused: Boolean(leftoverNote),
    };
  }

  const packagesNeeded = Math.ceil(netQuantity / ingredient.packageSize);
  const candidates = getAllStorePrices(ingredient, userStores, region);
  const pool = candidates.length > 0 ? candidates : getAllStorePrices(ingredient, ALL_STORE_IDS, region);
  const cheapest = pool[0] ?? null;

  return {
    ...base,
    storeId: cheapest?.storeId ?? null,
    packagesNeeded,
    lineCostGBP: ingredient.isPantryItem ? 0 : round2((cheapest?.price ?? 0) * packagesNeeded),
    isLeftoverReused: Boolean(leftoverNote),
  };
}

/**
 * Single greedy pass, not a full optimizer: re-prices the costliest non-pantry,
 * non-leftover lines against the globally cheapest store and swaps if cheaper.
 * Matches the spec's "almost always under budget, allow up to £5 over" rather
 * than guaranteeing it in every edge case (e.g. premium-only store selections).
 */
export function fitToBudget(
  lines: ShoppingListLine[],
  budgetGBP: number,
  ingredientsById: Record<string, Ingredient>,
  region: Region,
): { lines: ShoppingListLine[]; total: number } {
  const workingLines = lines.map((l) => ({ ...l }));
  let total = round2(workingLines.filter((l) => !l.isPantryItem).reduce((sum, l) => sum + l.lineCostGBP, 0));

  if (total <= budgetGBP + BUDGET_TOLERANCE_GBP) {
    return { lines: workingLines, total };
  }

  const costliestFirst = workingLines
    .filter((l) => !l.isPantryItem && !l.isLeftoverReused && l.packagesNeeded > 0)
    .sort((a, b) => b.lineCostGBP - a.lineCostGBP);

  for (const line of costliestFirst) {
    if (total <= budgetGBP + BUDGET_TOLERANCE_GBP) break;
    const ingredient = ingredientsById[line.ingredientId];
    if (!ingredient) continue;
    const globalCheapest = getAllStorePrices(ingredient, ALL_STORE_IDS, region)[0];
    if (!globalCheapest) continue;
    const newCost = round2(globalCheapest.price * line.packagesNeeded);
    if (globalCheapest.storeId !== line.storeId && newCost < line.lineCostGBP) {
      total = round2(total - line.lineCostGBP + newCost);
      line.substitutionNote = `Switched to ${globalCheapest.storeId} for a lower price`;
      line.storeId = globalCheapest.storeId;
      line.lineCostGBP = newCost;
    }
  }

  return { lines: workingLines, total };
}

export function computeOverBudget(total: number, budgetGBP: number): number {
  return Math.max(0, round2(total - budgetGBP));
}

/**
 * The Review screen can add/remove/reassign meals after swiping, so by confirm
 * time `dayAssignments` — not the swipe-time `selections` — is the source of
 * truth for "how many of each recipe." Feeding stale swipe-time selections into
 * cost math would under/over-count anything edited during Review.
 */
export function deriveSelectionsFromAssignments(
  assignments: MealAssignment[],
): WeeklyPlanRecipeSelection[] {
  const counts = new Map<string, number>();
  for (const a of assignments) {
    if (!a.recipeId) continue;
    counts.set(a.recipeId, (counts.get(a.recipeId) ?? 0) + 1);
  }
  return [...counts.entries()].map(([recipeId, mealCount]) => ({ recipeId, mealCount }));
}

/**
 * Randomised-store strategy: picks a random store per ingredient among the
 * user's selected stores, then — if there's budget headroom left — spends it
 * upgrading protein lines to the priciest store option that still fits.
 * Never downgrades a line and never exceeds budget + tolerance.
 */
function resolveBalancedUpgrade(
  netDemand: (IngredientDemand & { leftoverNote?: string })[],
  userStores: StoreId[],
  region: Region,
  ingredientsById: Record<string, Ingredient>,
  budgetGBP: number,
  rng: () => number,
): { lines: ShoppingListLine[]; total: number } {
  const lines: ShoppingListLine[] = netDemand.map((d) => {
    const ingredient = ingredientsById[d.ingredientId];
    if (d.quantity <= 0 || ingredient.isPantryItem) {
      return resolveShoppingLine(ingredient, d.quantity, userStores, region, d.leftoverNote);
    }
    const options = getAllStorePrices(ingredient, userStores, region);
    if (options.length === 0) {
      return resolveShoppingLine(ingredient, d.quantity, userStores, region, d.leftoverNote);
    }
    const pick = options[Math.floor(rng() * options.length)];
    const packagesNeeded = Math.ceil(d.quantity / ingredient.packageSize);
    return {
      ingredientId: ingredient.id,
      storeId: pick.storeId,
      packagesNeeded,
      packageSize: ingredient.packageSize,
      packageUnit: ingredient.packageUnit,
      packageLabel: ingredient.packageLabel,
      lineCostGBP: round2(pick.price * packagesNeeded),
      isPantryItem: false,
      isLeftoverReused: Boolean(d.leftoverNote),
      leftoverNote: d.leftoverNote,
    };
  });

  let total = round2(lines.filter((l) => !l.isPantryItem).reduce((sum, l) => sum + l.lineCostGBP, 0));

  if (total > budgetGBP + BUDGET_TOLERANCE_GBP) {
    // Random assignment already breaches tolerance — discard it entirely rather
    // than partially repair, and fall back to the deterministic cheapest pass.
    const preBudget = netDemand.map((d) =>
      resolveShoppingLine(ingredientsById[d.ingredientId], d.quantity, userStores, region, d.leftoverNote),
    );
    return fitToBudget(preBudget, budgetGBP, ingredientsById, region);
  }

  let headroom = round2(budgetGBP + BUDGET_TOLERANCE_GBP - total);
  const proteinLines = lines
    .filter((l) => !l.isPantryItem && ingredientsById[l.ingredientId]?.category === 'protein' && l.packagesNeeded > 0)
    .sort(() => rng() - 0.5);

  for (const line of proteinLines) {
    if (headroom <= 0) break;
    const ingredient = ingredientsById[line.ingredientId];
    const options = getAllStorePrices(ingredient, userStores, region); // cheapest-first
    const currentIdx = options.findIndex((o) => o.storeId === line.storeId);
    for (let i = options.length - 1; i > currentIdx; i--) {
      const candidate = options[i];
      const newCost = round2(candidate.price * line.packagesNeeded);
      const delta = round2(newCost - line.lineCostGBP);
      if (delta > 0 && delta <= headroom) {
        headroom = round2(headroom - delta);
        total = round2(total + delta);
        line.storeId = candidate.storeId;
        line.lineCostGBP = newCost;
        line.substitutionNote = `Upgraded to ${candidate.storeId} — extra budget spent on protein quality`;
        break;
      }
    }
  }

  return { lines, total };
}

export function resolveShoppingListForStrategy(
  netDemand: (IngredientDemand & { leftoverNote?: string })[],
  strategy: PricingStrategy,
  userStores: StoreId[],
  region: Region,
  ingredientsById: Record<string, Ingredient>,
  budgetGBP: number,
  rng: () => number = Math.random,
): { lines: ShoppingListLine[]; total: number } {
  if (strategy === 'cheapest' || userStores.length < 2) {
    const preBudget = netDemand.map((d) =>
      resolveShoppingLine(ingredientsById[d.ingredientId], d.quantity, userStores, region, d.leftoverNote),
    );
    return fitToBudget(preBudget, budgetGBP, ingredientsById, region);
  }
  return resolveBalancedUpgrade(netDemand, userStores, region, ingredientsById, budgetGBP, rng);
}

/**
 * Display-only recompute for the "don't reuse this leftover" per-item toggle on
 * Results. Re-resolves just the toggled-off lines from their RAW pre-leftover
 * quantity (already stored on the plan) so the user can see the honest price
 * without that discount — never mutates or re-saves the underlying plan.
 * Operates on a plain shoppingList (not a whole WeeklyPlan) so it composes with
 * applyPantryOverrides in either order.
 */
export function applyLeftoverOverrides(
  shoppingList: ShoppingListLine[],
  ingredientDemandSnapshot: IngredientDemand[],
  disabledIngredientIds: Set<string>,
  userStores: StoreId[],
  region: Region,
  ingredientsById: Record<string, Ingredient>,
): ShoppingListLine[] {
  return shoppingList.map((line) => {
    if (!line.leftoverNote || !disabledIngredientIds.has(line.ingredientId)) return line;
    const ingredient = ingredientsById[line.ingredientId];
    if (!ingredient) return line;
    const rawQty = ingredientDemandSnapshot.find((d) => d.ingredientId === line.ingredientId)?.quantity ?? 0;
    const recomputed = resolveShoppingLine(ingredient, rawQty, userStores, region);
    return { ...recomputed, substitutionNote: line.substitutionNote };
  });
}

/**
 * Display-only recompute for the "I don't have this pantry item" per-item
 * toggle on Results — includes its real cost (at its already-assigned store)
 * instead of treating it as free. Composes with applyLeftoverOverrides.
 */
export function applyPantryOverrides(
  shoppingList: ShoppingListLine[],
  includedPantryIds: Set<string>,
  region: Region,
  ingredientsById: Record<string, Ingredient>,
): ShoppingListLine[] {
  return shoppingList.map((line) => {
    if (!line.isPantryItem || !includedPantryIds.has(line.ingredientId) || !line.storeId) return line;
    const ingredient = ingredientsById[line.ingredientId];
    if (!ingredient) return line;
    const price = getIngredientPrice(ingredient, line.storeId, region) ?? 0;
    return { ...line, isPantryItem: false, lineCostGBP: round2(price * line.packagesNeeded) };
  });
}

export function computeShoppingListTotal(shoppingList: ShoppingListLine[]): number {
  return round2(shoppingList.filter((l) => !l.isPantryItem).reduce((sum, l) => sum + l.lineCostGBP, 0));
}

/**
 * Display-only recompute for the "Already have" per-item toggle on Results —
 * zeroes out an ordinary (non-pantry) line entirely, as if it were fully
 * covered, since the user is telling us they don't need to buy it this week.
 * Composes with applyLeftoverOverrides/applyPantryOverrides in any order.
 */
export function applyAlreadyHaveOverrides(
  shoppingList: ShoppingListLine[],
  alreadyHaveIds: Set<string>,
): ShoppingListLine[] {
  return shoppingList.map((line) => {
    if (line.isPantryItem || !alreadyHaveIds.has(line.ingredientId) || line.packagesNeeded === 0) return line;
    return {
      ...line,
      packagesNeeded: 0,
      lineCostGBP: 0,
      isLeftoverReused: false,
      leftoverNote: undefined,
      substitutionNote: undefined,
    };
  });
}

/**
 * Fast, conservative cost estimate used during swiping to warn the user before
 * they exceed budget — cheapest-store per ingredient, no leftover offset (an
 * overestimate is the safe direction for a warning), no budget-fit pass.
 */
export function estimateSelectionsCost(
  selections: WeeklyPlanRecipeSelection[],
  recipesById: Record<string, { ingredients: { ingredientId: string; quantity: number; unit: IngredientDemand['unit'] }[] }>,
  ingredientsById: Record<string, Ingredient>,
  userStores: StoreId[],
  region: Region,
  servingsPerMeal: number = 1,
): number {
  const rawDemand = computeRawDemand(selections, recipesById, servingsPerMeal);
  let total = 0;
  for (const d of rawDemand) {
    const ingredient = ingredientsById[d.ingredientId];
    if (!ingredient || ingredient.isPantryItem) continue;
    total += resolveShoppingLine(ingredient, d.quantity, userStores, region).lineCostGBP;
  }
  return round2(total);
}

export { getIngredientPrice };
