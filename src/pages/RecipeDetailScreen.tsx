import { RECIPES_BY_ID } from '../data/recipes';
import { INGREDIENTS_BY_ID } from '../data/ingredients';
import { useAppView } from '../hooks/useAppView';
import { RecipeImage } from '../components/shared/RecipeImage';
import { Button } from '../components/shared/Button';

interface RecipeDetailScreenProps {
  recipeId: string;
}

export function RecipeDetailScreen({ recipeId }: RecipeDetailScreenProps) {
  const { goToRecipeSearch } = useAppView();
  const recipe = RECIPES_BY_ID[recipeId];

  if (!recipe) {
    return (
      <div className="mx-auto max-w-md px-4 py-8 text-center">
        <p className="mb-4 text-stone-500">Recipe not found.</p>
        <Button variant="secondary" onClick={goToRecipeSearch}>
          Back to search
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <RecipeImage src={recipe.imageUrl} alt={recipe.name} className="mb-4 h-56 w-full rounded-2xl" />
      <h1 className="mb-1 text-2xl font-bold text-stone-900">{recipe.name}</h1>
      <p className="mb-3 text-sm text-stone-500">{recipe.description}</p>
      <div className="mb-6 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{recipe.cuisine}</span>
        {recipe.dietTags.map((tag) => (
          <span key={tag} className="rounded-full bg-olive/10 px-2 py-0.5 text-xs text-olive-dark">
            {tag}
          </span>
        ))}
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{recipe.prepMinutes} min</span>
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-stone-700">Ingredients</h2>
        <ul className="space-y-1">
          {recipe.ingredients.map((ref) => (
            <li key={ref.ingredientId} className="text-sm text-stone-600">
              {INGREDIENTS_BY_ID[ref.ingredientId]?.name ?? ref.ingredientId}
            </li>
          ))}
          {recipe.unmappedIngredients?.map((u) => (
            <li key={u.rawName} className="text-sm text-stone-400">
              {u.rawName} <span className="italic">(price unavailable)</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-stone-700">Method</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-stone-700">
          {recipe.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </section>

      {recipe.attribution && (
        <p className="mb-6 text-xs text-stone-400">
          {recipe.attribution}
          {recipe.sourceUrl && (
            <>
              {' — '}
              <a href={recipe.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                view source
              </a>
            </>
          )}
        </p>
      )}

      <Button variant="secondary" onClick={goToRecipeSearch}>
        Back to search
      </Button>
    </div>
  );
}
