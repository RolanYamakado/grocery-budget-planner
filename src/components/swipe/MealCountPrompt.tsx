import { useState } from 'react';
import type { Recipe } from '../../types';
import { Stepper } from '../shared/Stepper';
import { Button } from '../shared/Button';

interface MealCountPromptProps {
  recipe: Recipe;
  maxMeals: number;
  onConfirm: (mealCount: number) => void;
  onCancel: () => void;
}

export function MealCountPrompt({ recipe, maxMeals, onConfirm, onCancel }: MealCountPromptProps) {
  const [count, setCount] = useState(Math.min(1, maxMeals));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <p className="text-sm text-stone-500">Added to your week</p>
        <h3 className="mb-4 text-lg font-bold text-stone-900">{recipe.name}</h3>
        <p className="mb-2 text-sm font-semibold text-stone-700">How many meals this week?</p>
        <div className="mb-6 flex justify-center">
          <Stepper value={count} min={1} max={maxMeals} onChange={setCount} />
        </div>
        <Button className="w-full" onClick={() => onConfirm(count)}>
          Confirm
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 w-full text-center text-sm text-stone-500 hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
