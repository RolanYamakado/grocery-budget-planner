import { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import type {
  AffinityScores,
  DietTag,
  MealAssignment,
  PricingStrategy,
  Recipe,
  Region,
  ScreenName,
  StoreId,
  WeeklyPlan,
  WeeklyPlanRecipeSelection,
} from '../types';
import { RECIPES, RECIPES_BY_ID } from '../data/recipes';
import { INGREDIENTS_BY_ID } from '../data/ingredients';
import { MAX_MEALS_PER_WEEK } from '../data/constants';
import { buildDeck, updateAffinity, applyLazyDecay } from '../lib/recommender';
import {
  computeRawDemand,
  deriveSelectionsFromAssignments,
  getAvailableLeftovers,
  applyLeftovers,
  resolveShoppingListForStrategy,
  computeOverBudget,
} from '../lib/aggregation';
import {
  appendSwipeHistory,
  getAffinityDecayWeek,
  getAffinityScores,
  getPlanHistory,
  getSwipeHistory,
  popLastSwipeHistory,
  saveAffinityDecayWeek,
  saveAffinityScores,
  savePlanToHistory,
} from '../lib/storage';
import { getIsoWeekKey, getPlanDates, toIsoDateString } from '../lib/weekUtils';
import { generateId } from '../lib/idUtils';

export interface SetupPayload {
  weekStart: Date;
  budgetGBP: number;
  region: Region;
  stores: StoreId[];
  pricingStrategy: PricingStrategy;
  mealsTarget: number;
  servingsPerMeal: number;
  dietPreference: DietTag;
}

interface SwipeSnapshot {
  affinityScores: AffinityScores;
  selections: WeeklyPlanRecipeSelection[];
  runningTotal: number;
  deckIndex: number;
  dayAssignments: MealAssignment[];
  screen: ScreenName;
}

interface PlanState {
  screen: ScreenName;
  setup: SetupPayload | null;
  deck: Recipe[];
  deckIndex: number;
  selections: WeeklyPlanRecipeSelection[];
  runningTotal: number;
  dayAssignments: MealAssignment[];
  affinityScores: AffinityScores;
  finalPlan: WeeklyPlan | null;
  planSaved: boolean;
  lastSwipe: SwipeSnapshot | null;
}

type Action =
  | { type: 'START_PLAN'; payload: SetupPayload }
  | { type: 'START_CUSTOM_PLAN'; payload: SetupPayload; selections: WeeklyPlanRecipeSelection[] }
  | { type: 'SWIPE_REJECT'; recipeId: string }
  | { type: 'SWIPE_ACCEPT'; recipeId: string; mealCount: number }
  | { type: 'UNDO_SWIPE' }
  | { type: 'ADD_MEAL_ASSIGNMENT'; date: string; recipeId: string }
  | { type: 'REMOVE_MEAL_ASSIGNMENT'; assignmentId: string }
  | { type: 'REASSIGN_MEAL'; assignmentId: string; recipeId: string | null }
  | { type: 'MOVE_MEAL_ASSIGNMENT'; assignmentId: string; newDate: string }
  | { type: 'GO_TO_REVIEW' }
  | { type: 'CONFIRM_RESULTS' }
  | { type: 'MARK_SAVED' }
  | { type: 'RESTART' };

function loadInitialAffinity(): AffinityScores {
  const now = new Date();
  const currentWeekKey = getIsoWeekKey(now);
  const lastDecayWeek = getAffinityDecayWeek();
  const { scores, decayed } = applyLazyDecay(getAffinityScores(), lastDecayWeek, currentWeekKey);
  if (decayed) {
    saveAffinityScores(scores);
    saveAffinityDecayWeek(currentWeekKey);
  }
  return scores;
}

/**
 * Round-robins accepted meals onto the plan's 7 actual dates (date = planDates[i % 7]),
 * not "fill 7 slots then drop the rest" — with mealsTarget now able to exceed 7, a
 * truncating distribution would silently vanish meals instead of stacking them.
 * Every date gets at least a placeholder row so Review always shows all 7 days.
 */
function defaultMealAssignments(selections: WeeklyPlanRecipeSelection[], planDates: string[]): MealAssignment[] {
  const recipeQueue: string[] = [];
  for (const sel of selections) {
    for (let i = 0; i < sel.mealCount; i++) recipeQueue.push(sel.recipeId);
  }
  const assignments: MealAssignment[] = recipeQueue.map((recipeId, i) => ({
    id: generateId('meal'),
    date: planDates[i % planDates.length],
    recipeId,
  }));
  for (const date of planDates) {
    if (!assignments.some((a) => a.date === date)) {
      assignments.push({ id: generateId('meal'), date, recipeId: null });
    }
  }
  return assignments;
}

function snapshotForUndo(state: PlanState): SwipeSnapshot {
  return {
    affinityScores: state.affinityScores,
    selections: state.selections,
    runningTotal: state.runningTotal,
    deckIndex: state.deckIndex,
    dayAssignments: state.dayAssignments,
    screen: state.screen,
  };
}

function initState(): PlanState {
  return {
    screen: 'setup',
    setup: null,
    deck: [],
    deckIndex: 0,
    selections: [],
    runningTotal: 0,
    dayAssignments: [],
    affinityScores: loadInitialAffinity(),
    finalPlan: null,
    planSaved: false,
    lastSwipe: null,
  };
}

function reducer(state: PlanState, action: Action): PlanState {
  switch (action.type) {
    case 'START_PLAN': {
      const deck = buildDeck(
        RECIPES,
        action.payload.dietPreference,
        getSwipeHistory(),
        state.affinityScores,
        new Date(),
      );
      return {
        ...state,
        setup: action.payload,
        deck,
        deckIndex: 0,
        selections: [],
        runningTotal: 0,
        dayAssignments: [],
        finalPlan: null,
        planSaved: false,
        lastSwipe: null,
        screen: 'swipe',
      };
    }
    case 'START_CUSTOM_PLAN': {
      // Skips the swipe deck entirely — selections come pre-built from the
      // Search Recipes cart, so we jump straight to Review for day assignment.
      const planDates = getPlanDates(action.payload.weekStart);
      const runningTotal = action.selections.reduce((sum, s) => sum + s.mealCount, 0);
      return {
        ...state,
        setup: action.payload,
        deck: [],
        deckIndex: 0,
        selections: action.selections,
        runningTotal,
        dayAssignments: defaultMealAssignments(action.selections, planDates),
        finalPlan: null,
        planSaved: false,
        lastSwipe: null,
        screen: 'review',
      };
    }
    case 'SWIPE_REJECT': {
      const recipe = RECIPES_BY_ID[action.recipeId];
      if (!recipe) return state;
      const lastSwipe = snapshotForUndo(state);
      appendSwipeHistory({ recipeId: recipe.id, action: 'reject', timestamp: new Date().toISOString() });
      const affinityScores = updateAffinity(state.affinityScores, recipe, 'reject');
      saveAffinityScores(affinityScores);
      return { ...state, affinityScores, deckIndex: state.deckIndex + 1, lastSwipe };
    }
    case 'SWIPE_ACCEPT': {
      const recipe = RECIPES_BY_ID[action.recipeId];
      if (!recipe || !state.setup) return state;
      const lastSwipe = snapshotForUndo(state);
      appendSwipeHistory({ recipeId: recipe.id, action: 'accept', timestamp: new Date().toISOString() });
      const affinityScores = updateAffinity(state.affinityScores, recipe, 'accept');
      saveAffinityScores(affinityScores);
      const selections = [...state.selections, { recipeId: recipe.id, mealCount: action.mealCount }];
      const runningTotal = state.runningTotal + action.mealCount;
      const mealsTarget = state.setup?.mealsTarget ?? MAX_MEALS_PER_WEEK;
      const reachedTarget = runningTotal >= mealsTarget;
      const planDates = getPlanDates(state.setup.weekStart);
      return {
        ...state,
        affinityScores,
        selections,
        runningTotal,
        deckIndex: state.deckIndex + 1,
        dayAssignments: reachedTarget ? defaultMealAssignments(selections, planDates) : state.dayAssignments,
        screen: reachedTarget ? 'review' : state.screen,
        lastSwipe,
      };
    }
    case 'UNDO_SWIPE': {
      if (!state.lastSwipe) return state;
      popLastSwipeHistory();
      saveAffinityScores(state.lastSwipe.affinityScores);
      return {
        ...state,
        affinityScores: state.lastSwipe.affinityScores,
        selections: state.lastSwipe.selections,
        runningTotal: state.lastSwipe.runningTotal,
        deckIndex: state.lastSwipe.deckIndex,
        dayAssignments: state.lastSwipe.dayAssignments,
        screen: state.lastSwipe.screen,
        lastSwipe: null,
      };
    }
    case 'GO_TO_REVIEW': {
      if (state.selections.length === 0 || !state.setup) return state;
      const planDates = getPlanDates(state.setup.weekStart);
      return {
        ...state,
        dayAssignments: defaultMealAssignments(state.selections, planDates),
        screen: 'review',
      };
    }
    case 'ADD_MEAL_ASSIGNMENT': {
      const dayAssignments = [
        ...state.dayAssignments,
        { id: generateId('meal'), date: action.date, recipeId: action.recipeId },
      ];
      return { ...state, dayAssignments };
    }
    case 'REMOVE_MEAL_ASSIGNMENT': {
      const dayAssignments = state.dayAssignments.filter((a) => a.id !== action.assignmentId);
      return { ...state, dayAssignments };
    }
    case 'REASSIGN_MEAL': {
      const dayAssignments = state.dayAssignments.map((a) =>
        a.id === action.assignmentId ? { ...a, recipeId: action.recipeId } : a,
      );
      return { ...state, dayAssignments };
    }
    case 'MOVE_MEAL_ASSIGNMENT': {
      const dayAssignments = state.dayAssignments.map((a) =>
        a.id === action.assignmentId ? { ...a, date: action.newDate } : a,
      );
      return { ...state, dayAssignments };
    }
    case 'CONFIRM_RESULTS': {
      if (!state.setup) return state;
      const { budgetGBP, region, stores, pricingStrategy, mealsTarget, servingsPerMeal, dietPreference, weekStart } =
        state.setup;
      const weekStartDate = toIsoDateString(weekStart);
      const planDates = getPlanDates(weekStart);

      const finalSelections = deriveSelectionsFromAssignments(state.dayAssignments);
      const rawDemand = computeRawDemand(finalSelections, RECIPES_BY_ID, servingsPerMeal);
      const history = getPlanHistory();
      const leftovers = getAvailableLeftovers(history, weekStartDate);
      const { netDemand } = applyLeftovers(rawDemand, leftovers, INGREDIENTS_BY_ID);

      const { lines: shoppingList, total: totalCostGBP } = resolveShoppingListForStrategy(
        netDemand,
        pricingStrategy,
        stores,
        region,
        INGREDIENTS_BY_ID,
        budgetGBP,
      );

      const finalPlan: WeeklyPlan = {
        id: generateId('plan'),
        weekStartDate,
        planDates,
        createdAt: new Date().toISOString(),
        budgetGBP,
        region,
        stores,
        pricingStrategy,
        mealsTarget,
        servingsPerMeal,
        dietPreference,
        selections: finalSelections,
        dayAssignments: state.dayAssignments,
        ingredientDemandSnapshot: rawDemand,
        shoppingList,
        totalCostGBP,
        overBudgetGBP: computeOverBudget(totalCostGBP, budgetGBP),
      };

      // Not persisted here — the user explicitly chooses Save or Discard on the
      // Results screen (savePlan()/restart() below), so a plan they don't want
      // never pollutes future weeks' leftover-crossover lookups.
      return { ...state, finalPlan, planSaved: false, screen: 'results' };
    }
    case 'MARK_SAVED':
      return { ...state, planSaved: true };
    case 'RESTART':
      return initState();
    default:
      return state;
  }
}

interface PlanContextValue {
  state: PlanState;
  startPlan: (payload: SetupPayload) => void;
  startCustomPlan: (payload: SetupPayload, selections: WeeklyPlanRecipeSelection[]) => void;
  swipeReject: (recipeId: string) => void;
  swipeAccept: (recipeId: string, mealCount: number) => void;
  undoSwipe: () => void;
  addMealAssignment: (date: string, recipeId: string) => void;
  removeMealAssignment: (assignmentId: string) => void;
  reassignMeal: (assignmentId: string, recipeId: string | null) => void;
  moveMealAssignment: (assignmentId: string, newDate: string) => void;
  goToReview: () => void;
  confirmResults: () => void;
  savePlan: () => void;
  restart: () => void;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState);

  const startPlan = useCallback((payload: SetupPayload) => dispatch({ type: 'START_PLAN', payload }), []);
  const startCustomPlan = useCallback(
    (payload: SetupPayload, selections: WeeklyPlanRecipeSelection[]) =>
      dispatch({ type: 'START_CUSTOM_PLAN', payload, selections }),
    [],
  );
  const swipeReject = useCallback((recipeId: string) => dispatch({ type: 'SWIPE_REJECT', recipeId }), []);
  const swipeAccept = useCallback(
    (recipeId: string, mealCount: number) => dispatch({ type: 'SWIPE_ACCEPT', recipeId, mealCount }),
    [],
  );
  const undoSwipe = useCallback(() => dispatch({ type: 'UNDO_SWIPE' }), []);
  const addMealAssignment = useCallback(
    (date: string, recipeId: string) => dispatch({ type: 'ADD_MEAL_ASSIGNMENT', date, recipeId }),
    [],
  );
  const removeMealAssignment = useCallback(
    (assignmentId: string) => dispatch({ type: 'REMOVE_MEAL_ASSIGNMENT', assignmentId }),
    [],
  );
  const reassignMeal = useCallback(
    (assignmentId: string, recipeId: string | null) => dispatch({ type: 'REASSIGN_MEAL', assignmentId, recipeId }),
    [],
  );
  const moveMealAssignment = useCallback(
    (assignmentId: string, newDate: string) => dispatch({ type: 'MOVE_MEAL_ASSIGNMENT', assignmentId, newDate }),
    [],
  );
  const goToReview = useCallback(() => dispatch({ type: 'GO_TO_REVIEW' }), []);
  const confirmResults = useCallback(() => dispatch({ type: 'CONFIRM_RESULTS' }), []);
  // Side effect (localStorage write) lives here, outside the reducer, since reducers
  // must stay pure — React can invoke a reducer twice for the same action (e.g. Strict
  // Mode) without that being safe to assume for a real persistence write.
  const savePlan = useCallback(() => {
    if (state.finalPlan) {
      savePlanToHistory(state.finalPlan);
      dispatch({ type: 'MARK_SAVED' });
    }
  }, [state.finalPlan]);
  const restart = useCallback(() => dispatch({ type: 'RESTART' }), []);

  const value = useMemo(
    () => ({
      state,
      startPlan,
      startCustomPlan,
      swipeReject,
      swipeAccept,
      undoSwipe,
      addMealAssignment,
      removeMealAssignment,
      reassignMeal,
      moveMealAssignment,
      goToReview,
      confirmResults,
      savePlan,
      restart,
    }),
    [
      state,
      startPlan,
      startCustomPlan,
      swipeReject,
      swipeAccept,
      undoSwipe,
      addMealAssignment,
      removeMealAssignment,
      reassignMeal,
      moveMealAssignment,
      goToReview,
      confirmResults,
      savePlan,
      restart,
    ],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlanState(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlanState must be used within a PlanProvider');
  return ctx;
}
