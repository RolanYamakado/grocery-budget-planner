import type { Recipe } from '../../types';
import { RecipeImage } from './RecipeImage';

interface RecipeSummaryProps {
  recipe: Recipe;
  mealCount?: number;
  onClick?: () => void;
}

export function RecipeSummary({ recipe, mealCount, onClick }: RecipeSummaryProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
      className={`flex items-center gap-3 rounded-2xl bg-white p-3 shadow-warm ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
    >
      <RecipeImage src={recipe.imageUrl} alt={recipe.name} className="h-16 w-16 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-stone-900">{recipe.name}</p>
        <p className="truncate text-sm text-stone-500">{recipe.description}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {recipe.dietTags.map((tag) => (
            <span key={tag} className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
              {tag}
            </span>
          ))}
        </div>
      </div>
      {mealCount !== undefined && (
        <span className="shrink-0 rounded-full bg-terracotta/15 px-3 py-1 text-sm font-semibold text-terracotta-dark">
          ×{mealCount}
        </span>
      )}
    </div>
  );
}
