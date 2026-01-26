import { RecipeWithLogs, UserPreferences } from '@/types';

/**
 * Analyzes user's saved recipes to determine cooking preferences
 */
export function analyzeUserPreferences(recipes: RecipeWithLogs[]): UserPreferences {
  if (recipes.length === 0) {
    return {
      top_cuisines: [],
      common_ingredients: [],
      avg_cook_time: 45, // default
      preferred_tags: [],
    };
  }

  // Count cuisines (weighted by rating)
  const cuisineCounts: Record<string, number> = {};
  recipes.forEach((recipe) => {
    if (recipe.cuisine) {
      const weight = recipe.average_rating || 3;
      cuisineCounts[recipe.cuisine] = (cuisineCounts[recipe.cuisine] || 0) + weight;
    }
  });

  // Count ingredient keywords
  const ingredientCounts: Record<string, number> = {};
  recipes.forEach((recipe) => {
    recipe.ingredients.forEach((ing) => {
      // Extract main ingredient (simplified)
      const mainIngredient = extractMainIngredient(ing);
      if (mainIngredient) {
        const weight = recipe.average_rating || 3;
        ingredientCounts[mainIngredient] = (ingredientCounts[mainIngredient] || 0) + weight;
      }
    });
  });

  // Count tags
  const tagCounts: Record<string, number> = {};
  recipes.forEach((recipe) => {
    recipe.tags.forEach((tag) => {
      const weight = recipe.average_rating || 3;
      tagCounts[tag.toLowerCase()] = (tagCounts[tag.toLowerCase()] || 0) + weight;
    });
  });

  // Calculate average cook time
  const recipesWithTime = recipes.filter(
    (r) => (r.prep_time || 0) + (r.cook_time || 0) > 0
  );
  const avgTime =
    recipesWithTime.length > 0
      ? recipesWithTime.reduce(
          (sum, r) => sum + (r.prep_time || 0) + (r.cook_time || 0),
          0
        ) / recipesWithTime.length
      : 45;

  // Sort and get top items
  const topCuisines = Object.entries(cuisineCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cuisine]) => cuisine);

  const topIngredients = Object.entries(ingredientCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ingredient]) => ingredient);

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  return {
    top_cuisines: topCuisines,
    common_ingredients: topIngredients,
    avg_cook_time: Math.round(avgTime),
    preferred_tags: topTags,
  };
}

/**
 * Extract the main ingredient keyword from an ingredient string
 */
function extractMainIngredient(ingredient: string): string | null {
  // Remove measurements and common words
  const cleaned = ingredient
    .toLowerCase()
    // Remove measurements
    .replace(/\d+[\d\/\s]*\s*(cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|oz|ounce|ounces|g|gram|grams|kg|ml|l|liter|liters|lb|lbs|pound|pounds|כף|כפות|כפית|כפיות|כוס|כוסות|גרם|ק"ג|מ"ל|ליטר)s?\b/gi, '')
    // Remove fractions
    .replace(/[½⅓¼⅔¾⅛⅜⅝⅞]/g, '')
    // Remove numbers at start
    .replace(/^[\d\s\/.-]+/, '')
    // Remove parenthetical content
    .replace(/\([^)]*\)/g, '')
    // Remove common descriptors
    .replace(/\b(fresh|dried|chopped|minced|sliced|diced|crushed|ground|whole|large|medium|small|optional|to taste|for garnish|finely|roughly|thinly|coarsely)\b/gi, '')
    .trim();

  // Get first meaningful word
  const words = cleaned.split(/[,\s]+/).filter(w => w.length > 2);
  return words[0] || null;
}

/**
 * Check if a recipe matches user preferences
 */
export function matchesPreferences(
  recipe: { cuisines?: string[]; dish_types?: string[] },
  preferences: UserPreferences
): number {
  let score = 0;

  // Check cuisine match
  if (recipe.cuisines && preferences.top_cuisines.length > 0) {
    const cuisineMatch = recipe.cuisines.some((c) =>
      preferences.top_cuisines.some(
        (pc) => c.toLowerCase().includes(pc.toLowerCase()) || pc.toLowerCase().includes(c.toLowerCase())
      )
    );
    if (cuisineMatch) score += 2;
  }

  // Check dish type / tag match
  if (recipe.dish_types && preferences.preferred_tags.length > 0) {
    const tagMatch = recipe.dish_types.some((dt) =>
      preferences.preferred_tags.some(
        (pt) => dt.toLowerCase().includes(pt.toLowerCase())
      )
    );
    if (tagMatch) score += 1;
  }

  return score;
}
