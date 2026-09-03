import type { Recipe } from '../../types';
import { RecipeImage } from '../shared/RecipeImage';

interface MealChipProps {
  recipe: Recipe;
  onReassign: (recipeId: string) => void;
  onRemove: () => void;
  options: Recipe[];
}

export function MealChip({ recipe, onReassign, onRemove, options }: MealChipProps) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-cream px-2 py-1.5">
      <RecipeImage src={recipe.imageUrl} alt={recipe.name} className="h-9 w-9 shrink-0 rounded-lg" />
      <select
        value={recipe.id}
        onChange={(e) => onReassign(e.target.value)}
        className="min-w-0 flex-1 truncate bg-transparent text-sm font-medium text-stone-800"
      >
        {options.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${recipe.name}`}
        className="shrink-0 rounded-full px-2 text-stone-400 hover:bg-red-50 hover:text-red-500"
      >
        ✕
      </button>
    </div>
  );
}
