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

    // Try Spoonacular API first
    if (SPOONACULAR_API_KEY) {
      try {
        const recipes = await fetchFromSpoonacular(ingredients, preferences, count, offset);
        if (recipes.length > 0) {
          return NextResponse.json({ recipes, source: 'spoonacular' });
        }
      } catch (error) {
        console.error('Spoonacular API error:', error);
        // Fall through to scraping fallback
      }
    }

    // Fallback: scrape from popular recipe sites
    console.log('Using fallback scraping...');
    const recipes = await scrapePopularRecipes(ingredients, preferences, count);

    if (recipes.length === 0) {
      return NextResponse.json(
        {
          error: 'No recipes found. Please try different criteria or check your API key.',
          recipes: [],
          source: 'none'
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ recipes, source: 'scraping' });
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

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Spoonacular API error: ${response.status}`);
  }

  const data: SpoonacularRecipe[] = await response.json();

  // Get additional details for each recipe
  const recipeIds = data.map(r => r.id).join(',');
  const detailsUrl = `${SPOONACULAR_BASE_URL}/recipes/informationBulk?apiKey=${SPOONACULAR_API_KEY}&ids=${recipeIds}`;

  const detailsResponse = await fetch(detailsUrl);
  const detailsData: SpoonacularRecipe[] = detailsResponse.ok ? await detailsResponse.json() : [];

  return data.map((recipe, index) => {
    const details = detailsData.find(d => d.id === recipe.id) || {};
    return mapSpoonacularToExternal(recipe, details);
  });
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

  const response = await fetch(url);
  if (!response.ok) {
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
// Fallback Scraping Functions
// ============================================

async function scrapePopularRecipes(
  ingredients: string[],
  preferences: UserPreferences,
  count: number
): Promise<ExternalRecipe[]> {
  const recipes: ExternalRecipe[] = [];

  // Try multiple sources
  const scrapers = [
    () => scrapeAllRecipes(ingredients, preferences),
    () => scrapeBBCGoodFood(ingredients, preferences),
    () => scrapeTheMealDB(),
  ];

  for (const scraper of scrapers) {
    if (recipes.length >= count) break;
    try {
      const results = await scraper();
      recipes.push(...results);
    } catch (error) {
      console.error('Scraper failed:', error);
    }
  }

  return recipes.slice(0, count);
}

async function scrapeAllRecipes(ingredients: string[], preferences: UserPreferences): Promise<ExternalRecipe[]> {
  try {
    let searchUrl = 'https://www.allrecipes.com/search?q=';

    if (ingredients.length > 0) {
      searchUrl += encodeURIComponent(ingredients.slice(0, 2).join(' '));
    } else if (preferences.top_cuisines?.length > 0) {
      searchUrl += encodeURIComponent(preferences.top_cuisines[0] + ' recipes');
    } else {
      searchUrl += 'popular';
    }

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);
    const recipes: ExternalRecipe[] = [];

    // AllRecipes search result cards
    $('a.mntl-card-list-card').slice(0, 5).each((_, el) => {
      const $card = $(el);
      const title = $card.find('.card__title-text').text().trim();
      const href = $card.attr('href');
      const image = $card.find('img').attr('data-src') || $card.find('img').attr('src');

      if (title && href) {
        recipes.push({
          id: `allrecipes-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title,
          image_url: image || null,
          source_url: href,
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
        });
      }
    });

    return recipes;
  } catch (error) {
    console.error('AllRecipes scraping failed:', error);
    return [];
  }
}

async function scrapeBBCGoodFood(ingredients: string[], preferences: UserPreferences): Promise<ExternalRecipe[]> {
  try {
    let searchUrl = 'https://www.bbcgoodfood.com/search?q=';

    if (ingredients.length > 0) {
      searchUrl += encodeURIComponent(ingredients.slice(0, 2).join(' '));
    } else if (preferences.top_cuisines?.length > 0) {
      searchUrl += encodeURIComponent(preferences.top_cuisines[0]);
    } else {
      searchUrl += 'quick+easy';
    }

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);
    const recipes: ExternalRecipe[] = [];

    // BBC Good Food search results
    $('article.card').slice(0, 5).each((_, el) => {
      const $card = $(el);
      const title = $card.find('h2.card__title a').text().trim() || $card.find('.card__title').text().trim();
      const href = $card.find('a').first().attr('href');
      const image = $card.find('img').attr('src');

      if (title && href) {
        const fullUrl = href.startsWith('http') ? href : `https://www.bbcgoodfood.com${href}`;
        recipes.push({
          id: `bbc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title,
          image_url: image || null,
          source_url: fullUrl,
          source_name: 'BBC Good Food',
          ready_in_minutes: null,
          servings: null,
          cuisines: [],
          dish_types: [],
          summary: null,
          spoonacular_score: null,
          health_score: null,
          used_ingredients: [],
          missed_ingredients: [],
        });
      }
    });

    return recipes;
  } catch (error) {
    console.error('BBC Good Food scraping failed:', error);
    return [];
  }
}

async function scrapeTheMealDB(): Promise<ExternalRecipe[]> {
  try {
    // TheMealDB has a free API - use random endpoint
    const response = await fetch('https://www.themealdb.com/api/json/v1/1/random.php');
    if (!response.ok) return [];

    const data = await response.json();
    const meal = data.meals?.[0];

    if (!meal) return [];

    return [{
      id: `mealdb-${meal.idMeal}`,
      title: meal.strMeal,
      image_url: meal.strMealThumb,
      source_url: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`,
      source_name: 'TheMealDB',
      ready_in_minutes: null,
      servings: null,
      cuisines: meal.strArea ? [meal.strArea] : [],
      dish_types: meal.strCategory ? [meal.strCategory] : [],
      summary: meal.strInstructions?.substring(0, 200) + '...',
      spoonacular_score: null,
      health_score: null,
      used_ingredients: [],
      missed_ingredients: [],
    }];
  } catch (error) {
    console.error('TheMealDB fetch failed:', error);
    return [];
  }
}
