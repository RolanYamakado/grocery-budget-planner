import type { ShoppingListLine } from '../../types';
import { INGREDIENTS_BY_ID } from '../../data/ingredients';
import { STORES_BY_ID } from '../../data/stores';

interface ShoppingListItemProps {
  line: ShoppingListLine;
  /** Whether the plan's original (pre-toggle) line had a leftover applied. */
  hasLeftoverOption?: boolean;
  leftoverDisabled?: boolean;
  onToggleUseLeftover?: (ingredientId: string, disable: boolean) => void;
  /** Whether the plan's original (pre-toggle) line was a pantry item. */
  hasPantryToggle?: boolean;
  pantryIncluded?: boolean;
  onTogglePantryInclude?: (ingredientId: string, include: boolean) => void;
  /** "Already have this" toggle — available for any non-pantry purchasable line. */
  hasAlreadyHaveToggle?: boolean;
  alreadyHave?: boolean;
  onToggleAlreadyHave?: (ingredientId: string, alreadyHave: boolean) => void;
}

export function ShoppingListItem({
  line,
  hasLeftoverOption,
  leftoverDisabled,
  onToggleUseLeftover,
  hasPantryToggle,
  pantryIncluded,
  onTogglePantryInclude,
  hasAlreadyHaveToggle,
  alreadyHave,
  onToggleAlreadyHave,
}: ShoppingListItemProps) {
  const ingredient = INGREDIENTS_BY_ID[line.ingredientId];
  const storeName = line.storeId ? STORES_BY_ID[line.storeId]?.name : null;
  const showLeftoverToggle = Boolean(hasLeftoverOption) && Boolean(onToggleUseLeftover);
  const showPantryToggle = Boolean(hasPantryToggle) && Boolean(onTogglePantryInclude);
  const showAlreadyHaveToggle = Boolean(hasAlreadyHaveToggle) && Boolean(onToggleAlreadyHave);

  if (alreadyHave) {
    return (
      <li className="flex items-center justify-between gap-3 py-2 text-sm">
        <div className="min-w-0">
          <span className="text-stone-500 line-through">{ingredient?.name}</span>
          <p className="text-stone-500">Already have this</p>
        </div>
        <button
          type="button"
          onClick={() => onToggleAlreadyHave?.(line.ingredientId, false)}
          className="shrink-0 whitespace-nowrap rounded-full border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
        >
          Add back
        </button>
      </li>
    );
  }

  if (line.packagesNeeded === 0 && line.isLeftoverReused) {
    return (
      <li className="flex items-center justify-between gap-3 py-2 text-sm">
        <div className="min-w-0">
          <span className="text-stone-500 line-through">{ingredient?.name}</span>
          <p className="text-olive-dark">{line.leftoverNote ?? 'Using leftovers'}</p>
        </div>
        {showLeftoverToggle && (
          <button
            type="button"
            onClick={() => onToggleUseLeftover?.(line.ingredientId, true)}
            className="shrink-0 whitespace-nowrap rounded-full border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
          >
            Show price without it
          </button>
        )}
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium text-stone-800">{ingredient?.name}</p>
        <p className="truncate text-xs text-stone-500">
          {line.packagesNeeded} × {line.packageLabel}
          {storeName ? ` — ${storeName}` : ''}
        </p>
        {line.leftoverNote && <p className="text-xs text-olive-dark">{line.leftoverNote}</p>}
        {line.substitutionNote && <p className="text-xs text-amber-600">{line.substitutionNote}</p>}
        <div className="mt-1 flex flex-wrap gap-1.5">
          {showLeftoverToggle && (
            <button
              type="button"
              onClick={() => onToggleUseLeftover?.(line.ingredientId, !leftoverDisabled)}
              className="rounded-full border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
            >
              {leftoverDisabled ? 'Reuse leftover instead' : 'Show price without it'}
            </button>
          )}
          {showPantryToggle && (
            <button
              type="button"
              onClick={() => onTogglePantryInclude?.(line.ingredientId, !pantryIncluded)}
              className="rounded-full border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
            >
              {pantryIncluded ? 'I already have this' : "I don't have this — include cost"}
            </button>
          )}
          {showAlreadyHaveToggle && (
            <button
              type="button"
              onClick={() => onToggleAlreadyHave?.(line.ingredientId, true)}
              className="rounded-full border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
            >
              Already have
            </button>
          )}
        </div>
      </div>
      <span className="shrink-0 font-semibold text-stone-800">
        {line.isPantryItem ? 'not included' : `£${line.lineCostGBP.toFixed(2)}`}
      </span>
    </li>
  );
}
