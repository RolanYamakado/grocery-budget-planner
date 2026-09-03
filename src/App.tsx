import { usePlanState, PlanProvider } from './hooks/usePlanState';
import { AppViewProvider, useAppView } from './hooks/useAppView';
import { CustomCartProvider } from './hooks/useCustomCart';
import { TopNav } from './components/nav/TopNav';
import { SetupScreen } from './pages/SetupScreen';
import { SwipeScreen } from './pages/SwipeScreen';
import { ReviewScreen } from './pages/ReviewScreen';
import { ResultsScreen } from './pages/ResultsScreen';
import { SavedPlansScreen } from './pages/SavedPlansScreen';
import { SavedPlanDetailScreen } from './pages/SavedPlanDetailScreen';
import { RecipeSearchScreen } from './pages/RecipeSearchScreen';
import { RecipeDetailScreen } from './pages/RecipeDetailScreen';

function WizardScreens() {
  const { state } = usePlanState();

  switch (state.screen) {
    case 'setup':
      return <SetupScreen />;
    case 'swipe':
      return <SwipeScreen />;
    case 'review':
      return <ReviewScreen />;
    case 'results':
      return <ResultsScreen />;
    default:
      return null;
  }
}

function AppRouter() {
  const { view } = useAppView();

  switch (view.name) {
    case 'wizard':
      return <WizardScreens />;
    case 'saved-plans':
      return <SavedPlansScreen />;
    case 'saved-plan-detail':
      return <SavedPlanDetailScreen planId={view.planId} />;
    case 'recipe-search':
      return <RecipeSearchScreen />;
    case 'recipe-detail':
      return <RecipeDetailScreen recipeId={view.recipeId} />;
    default:
      return null;
  }
}

function App() {
  return (
    <AppViewProvider>
      <CustomCartProvider>
        <PlanProvider>
          <div className="min-h-svh bg-cream">
            <TopNav />
            <AppRouter />
          </div>
        </PlanProvider>
      </CustomCartProvider>
    </AppViewProvider>
  );
}

export default App;
