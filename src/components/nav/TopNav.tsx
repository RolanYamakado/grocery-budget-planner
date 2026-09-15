import { useAppView } from '../../hooks/useAppView';
import { usePlanState } from '../../hooks/usePlanState';
import { useCustomCart } from '../../hooks/useCustomCart';
import { useAuth } from '../../hooks/useAuth';
import clsx from 'clsx';

const NAV_ITEMS = [
  { view: 'wizard' as const, label: 'New plan' },
  { view: 'saved-plans' as const, label: 'Saved meal plans' },
  { view: 'recipe-search' as const, label: 'Search recipes' },
];

export function TopNav() {
  const { view, goToWizard, goToSavedPlans, goToRecipeSearch } = useAppView();
  const { restart } = usePlanState();
  const cart = useCustomCart();
  const { user, signOut } = useAuth();

  function handleClick(target: (typeof NAV_ITEMS)[number]['view']) {
    if (target === 'wizard') {
      restart();
      cart.clear();
      goToWizard();
    } else if (target === 'saved-plans') {
      goToSavedPlans();
    } else {
      goToRecipeSearch();
    }
  }

  return (
    <nav className="print:hidden sticky top-0 z-40 border-b border-stone-200 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-center gap-1 px-4 py-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => handleClick(item.view)}
            className={clsx(
              'rounded-full px-3 py-1.5 text-xs font-semibold transition',
              view.name === item.view ? 'bg-terracotta text-white' : 'text-stone-500 hover:bg-terracotta/10',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mx-auto flex max-w-md items-center justify-center gap-2 px-4 pb-2 text-xs text-stone-400">
        <span className="truncate">{user?.email}</span>
        <button type="button" onClick={() => void signOut()} className="shrink-0 font-semibold hover:underline">
          Sign out
        </button>
      </div>
    </nav>
  );
}
