import type { Recipe } from '../../types';

interface AddMealControlProps {
  options: Recipe[];
  onAdd: (recipeId: string) => void;
}

export function AddMealControl({ options, onAdd }: AddMealControlProps) {
  if (options.length === 0) return null;
  return (
    <select
      defaultValue=""
      onChange={(e) => {
        if (e.target.value) {
          onAdd(e.target.value);
          e.target.value = '';
        }
      }}
      className="w-full rounded-xl border border-dashed border-stone-300 px-3 py-2 text-sm text-stone-500"
    >
      <option value="" disabled>
        + Add a meal to this day
      </option>
      {options.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </select>
  );
}
