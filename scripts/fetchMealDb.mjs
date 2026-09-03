// One-off dev-time script: fetches recipes from TheMealDB's free public API and
// generates src/data/generatedRecipes.ts. Run with:
//   node --experimental-strip-types scripts/fetchMealDb.mjs
// Not run at app runtime — keeps the shipped app fully static/offline.
// Cost/practicality curation happens afterwards in scripts/curateRecipes.mjs, so
// this script intentionally fetches a generous superset (all savory categories +
// extra emphasis on requested cuisines) to leave headroom for that cull.
import { INGREDIENTS, INGREDIENTS_BY_ID } from '../src/data/ingredients.ts';
import { MEALDB_INGREDIENT_ALIASES } from './ingredientAliasMap.mjs';
import { setGlobalDispatcher, EnvHttpProxyAgent } from 'undici';

// Node's built-in fetch doesn't read HTTP_PROXY/HTTPS_PROXY by default — this
// sandbox routes all network through a local proxy, so route fetch() through it too.
setGlobalDispatcher(new EnvHttpProxyAgent());

const BASE = 'https://www.themealdb.com/api/json/v1/1';

// Dessert, Breakfast, Side and Starter intentionally excluded — this app is for
// planning lunch/dinner mains, not desserts, breakfasts, sides or starters.
const CATEGORIES = ['Beef', 'Chicken', 'Goat', 'Lamb', 'Miscellaneous', 'Pasta', 'Pork', 'Seafood', 'Vegan', 'Vegetarian'];
const EXCLUDED_CATEGORIES = new Set(['Dessert', 'Breakfast', 'Side', 'Starter']);
// User asked for more Japanese/Italian/Mexican/Spanish/Chinese specifically — an
// area-based fetch pulls those in regardless of which category they landed in.
const TARGET_AREAS = ['Japanese', 'Italian', 'Mexican', 'Spanish', 'Chinese'];

// TheMealDB has no per-recipe servings field. Its measures are written for a
// typical family recipe card, which is conventionally ~4 servings — dividing by
// this is what makes IngredientRef.quantity genuinely "per single serving" as
// the rest of the app assumes. Without this, a recipe's full-batch quantities
// were being costed as if they were a single portion (drastically overpriced).
const DEFAULT_RECIPE_SERVINGS = 4;

const DEFAULT_QTY_BY_CATEGORY = {
  protein: 150,
  veg: 100,
  fruit: 100,
  dairy: 50,
  carb: 75,
  bakery: 1,
  legume: 100,
  pantry: 5,
  other: 50,
};

const ANIMAL_PROTEIN_IDS = new Set(
  INGREDIENTS.filter((i) => i.category === 'protein' && !['tofu-firm', 'halloumi'].includes(i.id)).map((i) => i.id),
);
const FISH_IDS = new Set(['salmon-fillet', 'white-fish-fillet', 'prawns-raw', 'tuna-tinned']);
const HERO_CATEGORIES = new Set(['protein', 'carb', 'legume']);
// Not real grocery items — free/negligible, silently dropped rather than flagged "price unavailable".
const SKIP_INGREDIENT_NAMES = new Set(['water', 'ice', 'ice cubes', 'boiling water', 'cold water', 'warm water']);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(raw) {
  return (raw || '')
    .toLowerCase()
    .trim()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function mapIngredient(rawName) {
  const norm = normalize(rawName);
  if (!norm) return null;
  if (MEALDB_INGREDIENT_ALIASES[norm]) return { ingredientId: MEALDB_INGREDIENT_ALIASES[norm] };
  const substringHit = INGREDIENTS.find((i) => {
    const iName = normalize(i.name);
    return norm.includes(iName) || iName.includes(norm);
  });
  if (substringHit) return { ingredientId: substringHit.id };
  return null;
}

/** Returns { value, wasParsed } — wasParsed=true means the FULL-RECIPE quantity was
 * successfully read from strMeasure and still needs dividing by assumed servings. */
function parseQuantity(rawMeasure, ingredient) {
  const measure = (rawMeasure || '').trim().toLowerCase();
  const weightMatch = /^([\d.]+)\s*(kg|g)\b/.exec(measure);
  if (weightMatch && ingredient.unit === 'g') {
    const value = parseFloat(weightMatch[1]);
    return { value: weightMatch[2] === 'kg' ? value * 1000 : value, wasParsed: true };
  }
  const volumeMatch = /^([\d.]+)\s*(l|ml)\b/.exec(measure);
  if (volumeMatch && ingredient.unit === 'ml') {
    const value = parseFloat(volumeMatch[1]);
    return { value: volumeMatch[2] === 'l' ? value * 1000 : value, wasParsed: true };
  }
  const bareNumberMatch = /^([\d.]+)\s*$/.exec(measure);
  if (bareNumberMatch && ingredient.unit === 'unit') {
    return { value: Math.min(6, Math.max(0.5, parseFloat(bareNumberMatch[1]))), wasParsed: true };
  }
  // Fallback defaults are already per-single-serving estimates — must NOT be divided again.
  return { value: ingredient.unit === 'unit' ? 1 : DEFAULT_QTY_BY_CATEGORY[ingredient.category] ?? 50, wasParsed: false };
}

function parseInstructions(raw) {
  const norm = (raw || '').replace(/\r\n/g, '\n').trim();
  let steps = norm
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (steps.length <= 1) {
    const numbered = norm
      .split(/(?=\d+\.\s)/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (numbered.length > 1) steps = numbered;
  }
  if (steps.length <= 1) {
    steps = norm
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return steps.length > 0 ? steps : [norm];
}

function deriveDietTags(meal, mappedRefs) {
  const tags = new Set();
  const hasAnimalProtein = mappedRefs.some((r) => ANIMAL_PROTEIN_IDS.has(r.ingredientId));
  const hasFish = meal.strCategory?.toLowerCase() === 'seafood' || mappedRefs.some((r) => FISH_IDS.has(r.ingredientId));
  const category = (meal.strCategory || '').toLowerCase();

  if (category === 'vegan') tags.add('vegan');
  else if (category === 'vegetarian' || (!hasAnimalProtein && !hasFish)) tags.add('vegetarian');
  if (hasFish && !hasAnimalProtein) tags.add('pescatarian');

  const sumByCategory = (cat) =>
    mappedRefs.reduce((sum, r) => (INGREDIENTS_BY_ID[r.ingredientId]?.category === cat ? sum + r.quantity : sum), 0);

  // Thresholds below are per-SINGLE-SERVING now (post /4 division), scaled down
  // from what they'd need to be for a whole 4-serving recipe.
  if (sumByCategory('protein') >= 40) tags.add('protein-heavy');
  if (sumByCategory('carb') < 20) tags.add('low-carb');
  if (sumByCategory('legume') + sumByCategory('veg') >= 40) tags.add('high-fibre');
  if (tags.size === 0) tags.add('balanced');
  return [...tags];
}

function deriveMainIngredients(mappedRefs) {
  const heroes = mappedRefs
    .filter((r) => HERO_CATEGORIES.has(INGREDIENTS_BY_ID[r.ingredientId]?.category))
    .map((r) => r.ingredientId);
  const unique = [...new Set(heroes)].slice(0, 3);
  return unique.length > 0 ? unique : mappedRefs.slice(0, 1).map((r) => r.ingredientId);
}

async function fetchJson(url, retries = 4) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status === 429 && attempt < retries) {
      const backoffMs = 1000 * 2 ** attempt;
      await sleep(backoffMs);
      continue;
    }
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
}

async function collectMealIds() {
  const collected = [];
  for (const category of CATEGORIES) {
    const data = await fetchJson(`${BASE}/filter.php?c=${encodeURIComponent(category)}`);
    const meals = data.meals || [];
    for (const m of meals) collected.push(m.idMeal);
    console.log(`category ${category}: ${meals.length} ids collected`);
    await sleep(150);
  }
  for (const area of TARGET_AREAS) {
    const data = await fetchJson(`${BASE}/filter.php?a=${encodeURIComponent(area)}`);
    const meals = data.meals || [];
    for (const m of meals) collected.push(m.idMeal);
    console.log(`area ${area}: ${meals.length} ids collected`);
    await sleep(150);
  }
  return [...new Set(collected)];
}

async function lookupMeal(id) {
  const data = await fetchJson(`${BASE}/lookup.php?i=${id}`);
  return data.meals?.[0] ?? null;
}

async function main() {
  const ids = await collectMealIds();
  console.log(`\nTotal unique meal ids to fetch: ${ids.length}\n`);

  const recipes = [];
  const skipped = [];
  const unmappedFrequency = new Map();
  const CONCURRENCY = 3;

  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    const meals = await Promise.all(
      batch.map((id) =>
        lookupMeal(id).catch((err) => {
          console.warn(`  failed to fetch ${id}: ${err.message}`);
          return null;
        }),
      ),
    );

    for (const meal of meals) {
      if (!meal) continue;
      if (EXCLUDED_CATEGORIES.has(meal.strCategory)) {
        skipped.push({ id: meal.idMeal, name: meal.strMeal, reason: `excluded category ${meal.strCategory}` });
        continue;
      }
      if (!meal.strInstructions || meal.strInstructions.trim().length < 10) {
        skipped.push({ id: meal.idMeal, name: meal.strMeal, reason: 'no instructions' });
        continue;
      }

      const mappedRefs = [];
      const unmapped = [];
      for (let n = 1; n <= 20; n++) {
        const rawName = meal[`strIngredient${n}`];
        const rawMeasure = meal[`strMeasure${n}`];
        if (!rawName || !rawName.trim()) continue;
        if (SKIP_INGREDIENT_NAMES.has(normalize(rawName))) continue;
        const mapped = mapIngredient(rawName);
        if (!mapped) {
          unmapped.push({ rawName: rawName.trim(), rawMeasure: (rawMeasure || '').trim() });
          const key = normalize(rawName);
          unmappedFrequency.set(key, (unmappedFrequency.get(key) ?? 0) + 1);
          continue;
        }
        const ingredient = INGREDIENTS_BY_ID[mapped.ingredientId];
        const { value, wasParsed } = parseQuantity(rawMeasure, ingredient);
        const quantity = wasParsed ? value / DEFAULT_RECIPE_SERVINGS : value;
        const existing = mappedRefs.find((r) => r.ingredientId === ingredient.id);
        if (existing) {
          existing.quantity += quantity;
        } else {
          mappedRefs.push({ ingredientId: ingredient.id, quantity, unit: ingredient.unit });
        }
      }

      if (mappedRefs.length === 0) {
        skipped.push({ id: meal.idMeal, name: meal.strMeal, reason: 'zero mappable ingredients' });
        continue;
      }

      const cuisine = (meal.strArea || meal.strCountry || 'international').toLowerCase();
      const article = /^[aeiou]/.test(cuisine) ? 'An' : 'A';
      const recipe = {
        id: `mealdb-${meal.idMeal}-${slugify(meal.strMeal).slice(0, 40)}`,
        name: meal.strMeal,
        description: `${article} ${cuisine} ${(meal.strCategory || 'dish').toLowerCase()} recipe.`,
        imageUrl: meal.strMealThumb,
        dietTags: deriveDietTags(meal, mappedRefs),
        cuisine,
        mainIngredients: deriveMainIngredients(mappedRefs),
        ingredients: mappedRefs,
        prepMinutes: 30,
        steps: parseInstructions(meal.strInstructions),
        ...(unmapped.length > 0 ? { unmappedIngredients: unmapped } : {}),
        sourceUrl: `https://www.themealdb.com/meal/${meal.idMeal}`,
        attribution: 'Recipe data & photo courtesy of TheMealDB',
      };
      recipes.push(recipe);
    }
    console.log(`Processed ${Math.min(i + CONCURRENCY, ids.length)}/${ids.length} (kept ${recipes.length})`);
    await sleep(350);
  }

  console.log(`\nKept ${recipes.length} recipes, skipped ${skipped.length}.`);
  const topUnmapped = [...unmappedFrequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  console.log('\nTop unmapped ingredient names (consider adding aliases/ingredients for these):');
  for (const [name, count] of topUnmapped) console.log(`  ${count}x  ${name}`);

  const cuisineCounts = {};
  for (const r of recipes) cuisineCounts[r.cuisine] = (cuisineCounts[r.cuisine] ?? 0) + 1;
  console.log('\nCuisine counts:', cuisineCounts);

  const banner = `// AUTO-GENERATED by scripts/fetchMealDb.mjs — do not hand-edit.
// Source: TheMealDB (https://www.themealdb.com). Recipe data & photos courtesy of TheMealDB.
// NOT YET CURATED — run scripts/curateRecipes.mjs next to cull by cost/practicality.
import type { Recipe } from '../types';

export const GENERATED_RECIPES: Recipe[] = ${JSON.stringify(recipes, null, 2)};
`;

  const fs = await import('node:fs/promises');
  await fs.writeFile(new URL('../src/data/generatedRecipes.ts', import.meta.url), banner);
  console.log('\nWrote src/data/generatedRecipes.ts');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
