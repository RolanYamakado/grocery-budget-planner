import { usePlanState, PlanProvider } from './hooks/usePlanState';
import { AppViewProvider, useAppView } from './hooks/useAppView';
import { CustomCartProvider } from './hooks/useCustomCart';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { AuthScreen } from './pages/AuthScreen';
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

function AuthGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-cream text-stone-500">Loading…</div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  // Keyed by user.id so switching accounts in the same tab fully remounts the
  // wizard/cart state — otherwise account B could inherit account A's
  // in-progress selections after storage.clearSync() only wipes storage.ts's
  // own cache, not this React state.
  return (
    <AppViewProvider key={user.id}>
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

function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

export default App;
