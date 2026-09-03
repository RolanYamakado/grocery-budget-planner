import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { WeeklyPlanRecipeSelection } from '../types';

interface CustomCartContextValue {
  selections: WeeklyPlanRecipeSelection[];
  totalMeals: number;
  addRecipe: (recipeId: string) => void;
  removeRecipe: (recipeId: string) => void;
  setMealCount: (recipeId: string, mealCount: number) => void;
  clear: () => void;
}

const CustomCartContext = createContext<CustomCartContextValue | null>(null);

export function CustomCartProvider({ children }: { children: ReactNode }) {
  const [selections, setSelections] = useState<WeeklyPlanRecipeSelection[]>([]);

  const addRecipe = useCallback((recipeId: string) => {
    setSelections((prev) => {
      const existing = prev.find((s) => s.recipeId === recipeId);
      if (existing) {
        return prev.map((s) => (s.recipeId === recipeId ? { ...s, mealCount: s.mealCount + 1 } : s));
      }
      return [...prev, { recipeId, mealCount: 1 }];
    });
  }, []);

  const removeRecipe = useCallback((recipeId: string) => {
    setSelections((prev) => prev.filter((s) => s.recipeId !== recipeId));
  }, []);

  const setMealCount = useCallback((recipeId: string, mealCount: number) => {
    setSelections((prev) => {
      if (mealCount <= 0) return prev.filter((s) => s.recipeId !== recipeId);
      return prev.map((s) => (s.recipeId === recipeId ? { ...s, mealCount } : s));
    });
  }, []);

  const clear = useCallback(() => setSelections([]), []);

  const totalMeals = selections.reduce((sum, s) => sum + s.mealCount, 0);

  const value = useMemo(
    () => ({ selections, totalMeals, addRecipe, removeRecipe, setMealCount, clear }),
    [selections, totalMeals, addRecipe, removeRecipe, setMealCount, clear],
  );

  return <CustomCartContext.Provider value={value}>{children}</CustomCartContext.Provider>;
}

export function useCustomCart(): CustomCartContextValue {
  const ctx = useContext(CustomCartContext);
  if (!ctx) throw new Error('useCustomCart must be used within a CustomCartProvider');
  return ctx;
}
