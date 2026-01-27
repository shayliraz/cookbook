import { NextRequest, NextResponse } from 'next/server';
import { ExternalRecipe } from '@/types';

const SPOONACULAR_API_KEY = process.env.SPOONACULAR_API_KEY;
const SPOONACULAR_BASE_URL = 'https://api.spoonacular.com';

interface SimilarRequest {
  recipeTitle: string;
  cuisine: string | null;
  ingredients: string[];
  tags: string[];
  mode: 'variation' | 'style'; // variation = twist on same dish, style = different dish similar style
}

export async function POST(request: NextRequest) {
  try {
    const body: SimilarRequest = await request.json();
    const { recipeTitle, cuisine, ingredients, tags, mode } = body;

    console.log('Similar request:', { recipeTitle, cuisine, mode });

    // Try Spoonacular first
    if (SPOONACULAR_API_KEY && SPOONACULAR_API_KEY !== 'your_api_key_here') {
      try {
        const recipes = await fetchSimilarFromSpoonacular(recipeTitle, cuisine, ingredients, tags, mode);
        if (recipes.length > 0) {
          return NextResponse.json({ recipes, source: 'spoonacular' });
        }
      } catch (error) {
        console.error('Spoonacular similar error:', error);
      }
    }

    // Fallback: TheMealDB
    try {
      const recipes = await fetchSimilarFromMealDB(recipeTitle, cuisine, ingredients, mode);
      if (recipes.length > 0) {
        return NextResponse.json({ recipes, source: 'mealdb' });
      }
    } catch (error) {
      console.error('MealDB similar error:', error);
    }

    return NextResponse.json({ recipes: [], source: 'none' });
  } catch (error) {
    console.error('Similar API error:', error);
    return NextResponse.json({ error: 'Failed to find similar recipes' }, { status: 500 });
  }
}

async function fetchSimilarFromSpoonacular(
  title: string,
  cuisine: string | null,
  ingredients: string[],
  tags: string[],
  mode: 'variation' | 'style'
): Promise<ExternalRecipe[]> {
  const params = new URLSearchParams({
    apiKey: SPOONACULAR_API_KEY!,
    number: '3',
    addRecipeInformation: 'true',
  });

  if (mode === 'variation') {
    // Search for the same dish name to find variations
    params.set('query', title);
    params.set('sort', 'popularity');
    params.set('sortDirection', 'desc');
  } else {
    // Style match: use cuisine + key ingredients
    const query = cuisine || tags[0] || '';
    if (query) params.set('query', query);
    if (cuisine) params.set('cuisine', cuisine);
    // Use top ingredients to find dishes with similar ingredients but different name
    if (ingredients.length > 0) {
      params.set('includeIngredients', ingredients.slice(0, 3).join(','));
    }
    params.set('sort', 'popularity');
    params.set('sortDirection', 'desc');
  }

  const url = `${SPOONACULAR_BASE_URL}/recipes/complexSearch?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Spoonacular error: ${response.status}`);

  const data = await response.json();
  const results = data.results || [];

  return results
    .filter((r: any) => {
      // For style mode, exclude recipes with the same title
      if (mode === 'style') {
        return !r.title.toLowerCase().includes(title.toLowerCase().split(' ')[0]);
      }
      return true;
    })
    .slice(0, 3)
    .map((r: any) => ({
      id: `spoonacular-${r.id}`,
      title: r.title,
      image_url: r.image || null,
      source_url: r.sourceUrl || `https://spoonacular.com/recipes/${r.title.toLowerCase().replace(/\s+/g, '-')}-${r.id}`,
      source_name: r.sourceName || 'Spoonacular',
      ready_in_minutes: r.readyInMinutes || null,
      servings: r.servings || null,
      cuisines: r.cuisines || [],
      dish_types: r.dishTypes || [],
      summary: r.summary ? cleanHtml(r.summary) : null,
      spoonacular_score: r.spoonacularScore || null,
      health_score: r.healthScore || null,
      used_ingredients: [],
      missed_ingredients: [],
      aggregate_likes: r.aggregateLikes || null,
      source_rating: null,
    }));
}

async function fetchSimilarFromMealDB(
  title: string,
  cuisine: string | null,
  ingredients: string[],
  mode: 'variation' | 'style'
): Promise<ExternalRecipe[]> {
  const recipes: ExternalRecipe[] = [];
  const seenIds = new Set<string>();

  if (mode === 'variation') {
    // Search by dish name keyword
    const keyword = title.split(' ').slice(0, 2).join(' ');
    try {
      const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(keyword)}`);
      if (res.ok) {
        const data = await res.json();
        for (const meal of (data.meals || []).slice(0, 3)) {
          if (!seenIds.has(meal.idMeal)) {
            seenIds.add(meal.idMeal);
            recipes.push(mapMealToExternal(meal));
          }
        }
      }
    } catch (e) {
      console.error('MealDB search error:', e);
    }
  } else {
    // Style match: search by area (cuisine) or main ingredient
    if (cuisine) {
      try {
        const res = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?a=${encodeURIComponent(cuisine)}`);
        if (res.ok) {
          const data = await res.json();
          const meals = (data.meals || []).slice(0, 6);
          // Pick 3 random ones
          const shuffled = meals.sort(() => Math.random() - 0.5).slice(0, 3);
          for (const meal of shuffled) {
            if (!seenIds.has(meal.idMeal)) {
              seenIds.add(meal.idMeal);
              // Get full details
              const detailRes = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${meal.idMeal}`);
              if (detailRes.ok) {
                const detailData = await detailRes.json();
                if (detailData.meals?.[0]) {
                  recipes.push(mapMealToExternal(detailData.meals[0]));
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('MealDB area filter error:', e);
      }
    }

    // If not enough, search by first ingredient
    if (recipes.length < 3 && ingredients.length > 0) {
      try {
        const res = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(ingredients[0])}`);
        if (res.ok) {
          const data = await res.json();
          const meals = (data.meals || []).filter((m: any) => !seenIds.has(m.idMeal));
          const shuffled = meals.sort(() => Math.random() - 0.5).slice(0, 3 - recipes.length);
          for (const meal of shuffled) {
            seenIds.add(meal.idMeal);
            const detailRes = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${meal.idMeal}`);
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              if (detailData.meals?.[0]) {
                recipes.push(mapMealToExternal(detailData.meals[0]));
              }
            }
          }
        }
      } catch (e) {
        console.error('MealDB ingredient filter error:', e);
      }
    }
  }

  // If still empty, get random
  if (recipes.length === 0) {
    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch('https://www.themealdb.com/api/json/v1/1/random.php');
        if (res.ok) {
          const data = await res.json();
          if (data.meals?.[0] && !seenIds.has(data.meals[0].idMeal)) {
            seenIds.add(data.meals[0].idMeal);
            recipes.push(mapMealToExternal(data.meals[0]));
          }
        }
      } catch (e) {
        console.error('MealDB random error:', e);
      }
    }
  }

  return recipes.slice(0, 3);
}

function mapMealToExternal(meal: any): ExternalRecipe {
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

function cleanHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .substring(0, 300) + '...';
}
