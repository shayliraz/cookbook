import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { ExternalRecipe, UserPreferences } from '@/types';

const SPOONACULAR_API_KEY = process.env.SPOONACULAR_API_KEY;
const SPOONACULAR_BASE_URL = 'https://api.spoonacular.com';

interface SpoonacularRecipe {
  id: number;
  title: string;
  image: string;
  imageType?: string;
  sourceUrl?: string;
  sourceName?: string;
  readyInMinutes?: number;
  servings?: number;
  cuisines?: string[];
  dishTypes?: string[];
  summary?: string;
  spoonacularScore?: number;
  healthScore?: number;
  usedIngredients?: Array<{ name: string }>;
  missedIngredients?: Array<{ name: string }>;
  usedIngredientCount?: number;
  missedIngredientCount?: number;
  aggregateLikes?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      ingredients = [],
      preferences = {} as UserPreferences,
      count = 3,
      offset = 0,
    } = body;

    console.log('Discovery request:', { ingredients, preferences, count, offset });
    console.log('API Key present:', !!SPOONACULAR_API_KEY);

    // Try Spoonacular API first
    if (SPOONACULAR_API_KEY && SPOONACULAR_API_KEY !== 'your_api_key_here') {
      try {
        console.log('Attempting Spoonacular API...');
        const recipes = await fetchFromSpoonacular(ingredients, preferences, count, offset);
        console.log('Spoonacular returned:', recipes.length, 'recipes');
        if (recipes.length > 0) {
          return NextResponse.json({ recipes, source: 'spoonacular' });
        }
      } catch (error) {
        console.error('Spoonacular API error:', error);
        // Fall through to scraping fallback
      }
    } else {
      console.log('No valid Spoonacular API key, using fallback...');
    }

    // Fallback: Use TheMealDB (free API) and scraping
    console.log('Using fallback methods...');
    const recipes = await fetchFallbackRecipes(ingredients, preferences, count, offset);
    console.log('Fallback returned:', recipes.length, 'recipes');

    if (recipes.length === 0) {
      return NextResponse.json(
        {
          error: 'No recipes found. Please add a Spoonacular API key in .env.local for better results.',
          recipes: [],
          source: 'none'
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ recipes, source: 'fallback' });
  } catch (error) {
    console.error('Discovery API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipe suggestions' },
      { status: 500 }
    );
  }
}

// ============================================
// Spoonacular API Functions
// ============================================

async function fetchFromSpoonacular(
  ingredients: string[],
  preferences: UserPreferences,
  count: number,
  offset: number
): Promise<ExternalRecipe[]> {
  // If ingredients provided, use findByIngredients endpoint (prioritized)
  if (ingredients.length > 0) {
    return await searchByIngredients(ingredients, count, offset);
  }

  // Otherwise, use complexSearch with preferences
  return await searchByPreferences(preferences, count, offset);
}

async function searchByIngredients(
  ingredients: string[],
  count: number,
  offset: number
): Promise<ExternalRecipe[]> {
  const ingredientList = ingredients.join(',');
  const url = `${SPOONACULAR_BASE_URL}/recipes/findByIngredients?apiKey=${SPOONACULAR_API_KEY}&ingredients=${encodeURIComponent(ingredientList)}&number=${count}&offset=${offset}&ranking=2&ignorePantry=true`;

  console.log('Fetching by ingredients:', ingredientList);
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Spoonacular error:', response.status, errorText);
    throw new Error(`Spoonacular API error: ${response.status}`);
  }

  const data: SpoonacularRecipe[] = await response.json();

  // Get additional details for each recipe
  if (data.length > 0) {
    const recipeIds = data.map(r => r.id).join(',');
    const detailsUrl = `${SPOONACULAR_BASE_URL}/recipes/informationBulk?apiKey=${SPOONACULAR_API_KEY}&ids=${recipeIds}`;

    const detailsResponse = await fetch(detailsUrl);
    const detailsData: SpoonacularRecipe[] = detailsResponse.ok ? await detailsResponse.json() : [];

    return data.map((recipe) => {
      const details = detailsData.find(d => d.id === recipe.id) || {};
      return mapSpoonacularToExternal(recipe, details);
    });
  }

  return [];
}

async function searchByPreferences(
  preferences: UserPreferences,
  count: number,
  offset: number
): Promise<ExternalRecipe[]> {
  const params = new URLSearchParams({
    apiKey: SPOONACULAR_API_KEY!,
    number: count.toString(),
    offset: offset.toString(),
    addRecipeInformation: 'true',
    sort: 'popularity',
    sortDirection: 'desc',
  });

  // Add cuisine filter if we have preferences
  if (preferences.top_cuisines?.length > 0) {
    params.set('cuisine', preferences.top_cuisines.slice(0, 3).join(','));
  }

  // Add max time filter
  if (preferences.avg_cook_time) {
    params.set('maxReadyTime', Math.round(preferences.avg_cook_time * 1.5).toString());
  }

  const url = `${SPOONACULAR_BASE_URL}/recipes/complexSearch?${params.toString()}`;
  console.log('Fetching by preferences...');

  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Spoonacular error:', response.status, errorText);
    throw new Error(`Spoonacular API error: ${response.status}`);
  }

  const data = await response.json();
  return (data.results || []).map((recipe: SpoonacularRecipe) => mapSpoonacularToExternal(recipe, recipe));
}

function mapSpoonacularToExternal(basic: SpoonacularRecipe, details: Partial<SpoonacularRecipe>): ExternalRecipe {
  return {
    id: `spoonacular-${basic.id}`,
    title: basic.title,
    image_url: basic.image || null,
    source_url: details.sourceUrl || `https://spoonacular.com/recipes/${basic.title.toLowerCase().replace(/\s+/g, '-')}-${basic.id}`,
    source_name: details.sourceName || 'Spoonacular',
    ready_in_minutes: details.readyInMinutes || null,
    servings: details.servings || null,
    cuisines: details.cuisines || [],
    dish_types: details.dishTypes || [],
    summary: details.summary ? cleanHtml(details.summary) : null,
    spoonacular_score: details.spoonacularScore || null,
    health_score: details.healthScore || null,
    used_ingredients: basic.usedIngredients?.map(i => i.name) || [],
    missed_ingredients: basic.missedIngredients?.map(i => i.name) || [],
    aggregate_likes: details.aggregateLikes || null,
    source_rating: null, // Spoonacular doesn't provide source ratings
  };
}

function cleanHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .substring(0, 300) + '...';
}

// ============================================
// Fallback Functions (Free APIs + Scraping)
// ============================================

async function fetchFallbackRecipes(
  ingredients: string[],
  preferences: UserPreferences,
  count: number,
  offset: number = 0
): Promise<ExternalRecipe[]> {
  const recipes: ExternalRecipe[] = [];

  // 1. Try TheMealDB (completely free, no API key needed)
  try {
    const mealDbRecipes = await fetchFromMealDB(ingredients, preferences, count, offset);
    recipes.push(...mealDbRecipes);
    console.log('MealDB returned:', mealDbRecipes.length, 'recipes at offset', offset);
  } catch (error) {
    console.error('MealDB error:', error);
  }

  // 2. If we need more, try scraping
  if (recipes.length < count) {
    try {
      const scrapedRecipes = await scrapePopularRecipes(ingredients, preferences, count - recipes.length);
      recipes.push(...scrapedRecipes);
      console.log('Scraping returned:', scrapedRecipes.length, 'recipes');
    } catch (error) {
      console.error('Scraping error:', error);
    }
  }

  return recipes.slice(0, count);
}

async function fetchFromMealDB(
  ingredients: string[],
  preferences: UserPreferences,
  count: number,
  offset: number = 0
): Promise<ExternalRecipe[]> {
  const allRecipes: ExternalRecipe[] = [];
  const seenIds = new Set<string>();

  // If ingredients provided, search by each ingredient and combine results
  if (ingredients.length > 0) {
    for (const ingredient of ingredients) {
      const url = `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(ingredient)}`;

      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          const meals = data.meals || [];

          for (const meal of meals) {
            // Skip if we've already seen this recipe
            if (seenIds.has(meal.idMeal)) continue;
            seenIds.add(meal.idMeal);

            // Get full details
            const detailUrl = `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${meal.idMeal}`;
            const detailResponse = await fetch(detailUrl);
            if (detailResponse.ok) {
              const detailData = await detailResponse.json();
              const fullMeal = detailData.meals?.[0];
              if (fullMeal) {
                // Check how many of our ingredients this recipe matches
                const mealIngredients = getMealIngredients(fullMeal).join(' ').toLowerCase();
                const matchCount = ingredients.filter(ing =>
                  mealIngredients.includes(ing.toLowerCase())
                ).length;

                const recipe = mapMealDBToExternal(fullMeal);
                // Store match count for sorting
                (recipe as any)._matchCount = matchCount;
                allRecipes.push(recipe);
              }
            }
          }
        }
      } catch (error) {
        console.error('MealDB ingredient search error:', error);
      }
    }

    // Sort by number of matching ingredients (most matches first)
    allRecipes.sort((a, b) => ((b as any)._matchCount || 0) - ((a as any)._matchCount || 0));
  }

  // If no ingredients or no results, get random recipes
  if (allRecipes.length === 0) {
    // Get multiple random recipes
    for (let i = 0; i < count + offset + 5; i++) {
      try {
        const response = await fetch('https://www.themealdb.com/api/json/v1/1/random.php');
        if (response.ok) {
          const data = await response.json();
          const meal = data.meals?.[0];
          if (meal && !seenIds.has(meal.idMeal)) {
            seenIds.add(meal.idMeal);
            allRecipes.push(mapMealDBToExternal(meal));
          }
        }
      } catch (error) {
        console.error('MealDB random error:', error);
      }
    }
  }

  // Apply offset and limit
  return allRecipes.slice(offset, offset + count);
}

// Helper to extract all ingredients from a MealDB meal
function getMealIngredients(meal: any): string[] {
  const ingredients: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const ingredient = meal[`strIngredient${i}`];
    if (ingredient && ingredient.trim()) {
      ingredients.push(ingredient.trim());
    }
  }
  return ingredients;
}

interface MealDBMeal {
  idMeal: string;
  strMeal: string;
  strMealThumb: string;
  strSource?: string;
  strArea?: string;
  strCategory?: string;
  strInstructions?: string;
  strYoutube?: string;
}

function mapMealDBToExternal(meal: MealDBMeal): ExternalRecipe {
  return {
    id: `mealdb-${meal.idMeal}`,
    title: meal.strMeal,
    image_url: meal.strMealThumb,
    source_url: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`,
    source_name: 'TheMealDB',
    ready_in_minutes: null,
    servings: null,
    cuisines: meal.strArea ? [meal.strArea] : [],
    dish_types: meal.strCategory ? [meal.strCategory] : [],
    summary: meal.strInstructions ? meal.strInstructions.substring(0, 200) + '...' : null,
    spoonacular_score: null,
    health_score: null,
    used_ingredients: [],
    missed_ingredients: [],
    aggregate_likes: null,
    source_rating: null,
  };
}

// ============================================
// Scraping Functions (Last Resort)
// ============================================

async function scrapePopularRecipes(
  ingredients: string[],
  preferences: UserPreferences,
  count: number
): Promise<ExternalRecipe[]> {
  const recipes: ExternalRecipe[] = [];

  // Try AllRecipes
  try {
    const allRecipesResults = await scrapeAllRecipes(ingredients, preferences);
    recipes.push(...allRecipesResults);
  } catch (error) {
    console.error('AllRecipes scraping failed:', error);
  }

  return recipes.slice(0, count);
}

async function scrapeAllRecipes(ingredients: string[], preferences: UserPreferences): Promise<ExternalRecipe[]> {
  try {
    let searchQuery = 'chicken'; // default

    if (ingredients.length > 0) {
      searchQuery = ingredients.slice(0, 2).join(' ');
    } else if (preferences.top_cuisines?.length > 0) {
      searchQuery = preferences.top_cuisines[0];
    }

    const searchUrl = `https://www.allrecipes.com/search?q=${encodeURIComponent(searchQuery)}`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      console.log('AllRecipes returned:', response.status);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const recipes: ExternalRecipe[] = [];

    // Try different selectors for AllRecipes
    const cardSelectors = [
      'a[href*="/recipe/"]',
      '.mntl-card-list-card',
      '.card--searchResult',
      'article a',
    ];

    for (const selector of cardSelectors) {
      if (recipes.length >= 5) break;

      $(selector).each((_, el) => {
        if (recipes.length >= 5) return false;

        const $el = $(el);
        const href = $el.attr('href') || '';

        // Only process recipe URLs
        if (!href.includes('/recipe/')) return;

        const title = $el.find('.card__title-text, .card__title, h3').text().trim() ||
                     $el.attr('title') ||
                     $el.text().trim().split('\n')[0];

        const image = $el.find('img').attr('data-src') ||
                     $el.find('img').attr('src') ||
                     $el.closest('article').find('img').attr('src');

        if (title && title.length > 3 && title.length < 100 && !recipes.some(r => r.source_url === href)) {
          recipes.push({
            id: `allrecipes-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: title.replace(/\s+/g, ' ').trim(),
            image_url: image || null,
            source_url: href.startsWith('http') ? href : `https://www.allrecipes.com${href}`,
            source_name: 'AllRecipes',
            ready_in_minutes: null,
            servings: null,
            cuisines: [],
            dish_types: [],
            summary: null,
            spoonacular_score: null,
            health_score: null,
            used_ingredients: [],
            missed_ingredients: [],
            aggregate_likes: null,
            source_rating: null,
          });
        }
      });
    }

    return recipes;
  } catch (error) {
    console.error('AllRecipes scraping error:', error);
    return [];
  }
}
