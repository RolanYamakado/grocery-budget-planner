import type { ShoppingListLine, StoreId, WeeklyPlan } from '../types';
import { STORES_BY_ID } from '../data/stores';
import { INGREDIENTS_BY_ID } from '../data/ingredients';
import { RECIPES_BY_ID } from '../data/recipes';
import { formatDayLabel } from './weekUtils';

export function groupShoppingListByStore(lines: ShoppingListLine[]): Map<StoreId, ShoppingListLine[]> {
  const byStore = new Map<StoreId, ShoppingListLine[]>();
  for (const line of lines) {
    if (line.isPantryItem || line.packagesNeeded === 0 || !line.storeId) continue;
    const bucket = byStore.get(line.storeId) ?? [];
    bucket.push(line);
    byStore.set(line.storeId, bucket);
  }
  return byStore;
}

/** Full plan text: budget summary + shopping list grouped by store + day-by-day meals. */
export function buildShareText(plan: WeeklyPlan): string {
  const lines: string[] = [];
  lines.push('UK Grocery Budget Planner — Weekly plan');
  lines.push(`Budget £${plan.budgetGBP.toFixed(2)} — Total £${plan.totalCostGBP.toFixed(2)}`);
  lines.push('');
  lines.push('Shopping list:');
  for (const [storeId, storeLines] of groupShoppingListByStore(plan.shoppingList)) {
    lines.push(`  ${STORES_BY_ID[storeId]?.name ?? storeId}:`);
    for (const line of storeLines) {
      const name = INGREDIENTS_BY_ID[line.ingredientId]?.name ?? line.ingredientId;
      lines.push(`    - ${name}: ${line.packagesNeeded} x ${line.packageLabel} (£${line.lineCostGBP.toFixed(2)})`);
    }
  }
  lines.push('');
  lines.push('Your week:');
  for (const date of plan.planDates) {
    const recipeNames = plan.dayAssignments
      .filter((a) => a.date === date && a.recipeId)
      .map((a) => RECIPES_BY_ID[a.recipeId as string]?.name)
      .filter(Boolean);
    lines.push(`  ${formatDayLabel(date)}: ${recipeNames.length > 0 ? recipeNames.join(', ') : 'No meal planned'}`);
  }
  return lines.join('\n');
}

/** Short summary for mailto: — full bodies truncate silently around ~2000 chars in many mail clients. */
export function buildShortSummary(plan: WeeklyPlan): string {
  const itemCount = plan.shoppingList.filter((l) => !l.isPantryItem && l.packagesNeeded > 0).length;
  return [
    'UK Grocery Budget Planner — Weekly plan',
    `Budget £${plan.budgetGBP.toFixed(2)} — Total £${plan.totalCostGBP.toFixed(2)}`,
    `${itemCount} items across ${groupShoppingListByStore(plan.shoppingList).size} store(s).`,
    'Open the app to see the full shopping list and day-by-day meals.',
  ].join('\n');
}
