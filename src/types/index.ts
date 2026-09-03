export type StoreId =
  | 'sainsburys'
  | 'tesco'
  | 'lidl'
  | 'aldi'
  | 'waitrose'
  | 'mands'
  | 'morrisons'
  | 'asda'
  | 'coop';

export type StoreTier = 'budget' | 'mid' | 'premium';

export type Region = 'london' | 'rest-of-uk';

export type DietTag =
  | 'protein-heavy'
  | 'balanced'
  | 'vegetarian'
  | 'vegan'
  | 'low-carb'
  | 'pescatarian'
  | 'high-fibre';

export type CuisineTag = string;

export const KNOWN_CUISINES: CuisineTag[] = [
  'british',
  'italian',
  'indian',
  'mexican',
  'chinese',
  'thai',
  'mediterranean',
  'japanese',
  'middle-eastern',
  'american',
];

export type IngredientCategory =
  | 'protein'
  | 'veg'
  | 'fruit'
  | 'dairy'
  | 'carb'
  | 'bakery'
  | 'legume'
  | 'pantry'
  | 'other';

export type Unit = 'g' | 'ml' | 'unit';

export interface Store {
  id: StoreId;
  name: string;
  tier: StoreTier;
}

export interface IngredientPriceOverride {
  storeId: StoreId;
  priceGBP: number;
}

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  /** Condiments, spices, cooking oil — excluded from cost totals. */
  isPantryItem: boolean;
  unit: Unit;
  packageSize: number;
  packageUnit: Unit;
  packageLabel: string;
  /** Price at 'mid' store tier, rest-of-UK region. Store/region price is derived from this. */
  referencePriceGBP: number;
  /** Omit = available at all stores. */
  storeAvailability?: StoreId[];
  priceOverrides?: IngredientPriceOverride[];
}

export interface IngredientRef {
  ingredientId: string;
  /** Quantity needed per single meal serving of this recipe. */
  quantity: number;
  unit: Unit;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  dietTags: DietTag[];
  cuisine: CuisineTag;
  /** ingredientIds treated as "hero" ingredients for affinity scoring. */
  mainIngredients: string[];
  ingredients: IngredientRef[];
  prepMinutes: number;
  /** Step-by-step cooking instructions, display-only (never used in cost math). */
  steps: string[];
  /** Ingredients mentioned by the source recipe that couldn't be mapped to a priced Ingredient. */
  unmappedIngredients?: { rawName: string; rawMeasure: string }[];
  sourceUrl?: string;
  attribution?: string;
}

export interface WeeklyPlanRecipeSelection {
  recipeId: string;
  mealCount: number;
}

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** A single meal slot on an actual calendar date — multiple can share a date. */
export interface MealAssignment {
  id: string;
  date: string; // ISO yyyy-MM-dd, one of the plan's planDates
  recipeId: string | null;
}

export interface IngredientDemand {
  ingredientId: string;
  quantity: number;
  unit: Unit;
}

export interface ShoppingListLine {
  ingredientId: string;
  storeId: StoreId | null;
  packagesNeeded: number;
  packageSize: number;
  packageUnit: Unit;
  packageLabel: string;
  lineCostGBP: number;
  isPantryItem: boolean;
  isLeftoverReused: boolean;
  leftoverNote?: string;
  substitutionNote?: string;
}

export interface WeeklyPlan {
  id: string;
  weekStartDate: string; // ISO date — any weekday, the first of 7 consecutive days
  planDates: string[]; // the 7 ISO dates covered by this plan, in order
  createdAt: string; // ISO datetime
  budgetGBP: number;
  region: Region;
  stores: StoreId[];
  pricingStrategy: PricingStrategy;
  mealsTarget: number;
  /** How many people/portions each meal instance feeds — scales ingredient demand. */
  servingsPerMeal: number;
  dietPreference: DietTag;
  selections: WeeklyPlanRecipeSelection[];
  dayAssignments: MealAssignment[];
  /** RAW demand (pre-leftover-offset) — must stay raw so future weeks can compute true surplus. */
  ingredientDemandSnapshot: IngredientDemand[];
  shoppingList: ShoppingListLine[];
  totalCostGBP: number;
  overBudgetGBP: number;
}

export type PricingStrategy = 'cheapest' | 'balanced-upgrade';

/** Pre-v2 shape, used only by the storage migration in lib/storage.ts. */
export interface DayAssignmentV1 {
  day: DayKey;
  recipeId: string | null;
}

export interface SwipeHistoryEntry {
  recipeId: string;
  action: 'accept' | 'reject';
  timestamp: string; // ISO datetime
}

export type AffinityKey = string; // "diet:x" | "cuisine:x" | "ingredient:x"
export type AffinityScores = Record<AffinityKey, number>;

export type ScreenName = 'setup' | 'swipe' | 'review' | 'results';
