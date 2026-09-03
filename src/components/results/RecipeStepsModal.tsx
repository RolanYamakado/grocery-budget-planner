import type { Recipe } from '../../types';
import { RecipeImage } from '../shared/RecipeImage';
import { INGREDIENTS_BY_ID } from '../../data/ingredients';

interface RecipeStepsModalProps {
  recipe: Recipe;
  onClose: () => void;
}

export function RecipeStepsModal({ recipe, onClose }: RecipeStepsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-warm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-stone-900">{recipe.name}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full px-2 text-stone-400 hover:bg-stone-100"
          >
            ✕
          </button>
        </div>
        <RecipeImage src={recipe.imageUrl} alt={recipe.name} className="mb-4 h-40 w-full rounded-xl" />

        <h3 className="mb-2 text-sm font-semibold text-stone-700">Ingredients</h3>
        <ul className="mb-4 space-y-1">
          {recipe.ingredients.map((ref) => (
            <li key={ref.ingredientId} className="text-sm text-stone-600">
              {INGREDIENTS_BY_ID[ref.ingredientId]?.name ?? ref.ingredientId}
            </li>
          ))}
        </ul>

        <h3 className="mb-2 text-sm font-semibold text-stone-700">Method</h3>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-stone-700">
          {recipe.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>

        {recipe.attribution && <p className="mt-4 text-xs text-stone-400">{recipe.attribution}</p>}
      </div>
    </div>
  );
}
