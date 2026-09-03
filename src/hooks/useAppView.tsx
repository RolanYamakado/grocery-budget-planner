import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type AppView =
  | { name: 'wizard' }
  | { name: 'saved-plans' }
  | { name: 'saved-plan-detail'; planId: string }
  | { name: 'recipe-search' }
  | { name: 'recipe-detail'; recipeId: string };

interface AppViewContextValue {
  view: AppView;
  goToWizard: () => void;
  goToSavedPlans: () => void;
  goToSavedPlanDetail: (planId: string) => void;
  goToRecipeSearch: () => void;
  goToRecipeDetail: (recipeId: string) => void;
}

const AppViewContext = createContext<AppViewContextValue | null>(null);

export function AppViewProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<AppView>({ name: 'wizard' });

  const goToWizard = useCallback(() => setView({ name: 'wizard' }), []);
  const goToSavedPlans = useCallback(() => setView({ name: 'saved-plans' }), []);
  const goToSavedPlanDetail = useCallback((planId: string) => setView({ name: 'saved-plan-detail', planId }), []);
  const goToRecipeSearch = useCallback(() => setView({ name: 'recipe-search' }), []);
  const goToRecipeDetail = useCallback((recipeId: string) => setView({ name: 'recipe-detail', recipeId }), []);

  const value = useMemo(
    () => ({ view, goToWizard, goToSavedPlans, goToSavedPlanDetail, goToRecipeSearch, goToRecipeDetail }),
    [view, goToWizard, goToSavedPlans, goToSavedPlanDetail, goToRecipeSearch, goToRecipeDetail],
  );

  return <AppViewContext.Provider value={value}>{children}</AppViewContext.Provider>;
}

export function useAppView(): AppViewContextValue {
  const ctx = useContext(AppViewContext);
  if (!ctx) throw new Error('useAppView must be used within an AppViewProvider');
  return ctx;
}
