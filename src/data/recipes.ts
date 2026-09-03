import { GENERATED_RECIPES } from './generatedRecipes';
import type { Recipe } from '../types';

export const RECIPES: Recipe[] = GENERATED_RECIPES;

export const RECIPES_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
