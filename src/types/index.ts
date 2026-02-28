// Core types for the Cooking Journal app

export interface Recipe {
  id: string;
  title: string;
  description: string | null;
  source_url: string | null;
  image_url: string | null;
  ingredients: string[];
  instructions: string[];
  prep_time: number | null; // minutes
  cook_time: number | null; // minutes
  servings: number | null;
  cuisine: string | null;
  tags: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CookingLog {
  id: string;
  recipe_id: string;
  cooked_at: string;
  rating: number; // 1-5
  notes: string | null;
  changes_made: string | null;
  who_was_there: string[];
  photo_urls: string[];
  would_make_again: boolean;
  created_at: string;
}

export interface RecipeWithLogs extends Recipe {
  cooking_logs: CookingLog[];
  last_cooked: string | null;
  average_rating: number | null;
  times_cooked: number;
}

// For the "What to cook?" feature
export interface CookingFilter {
  maxTime?: number; // max total time in minutes
  cuisine?: string;
  tags?: string[];
  minRating?: number;
  notCookedInDays?: number;
  hasIngredients?: string[];
}

// Scraping response
export interface ScrapedRecipe {
  title: string;
  description: string | null;
  image_url: string | null;
  ingredients: string[];
  instructions: string[];
  prep_time: number | null;
  cook_time: number | null;
  total_time: number | null;
  servings: number | null;
  cuisine: string | null;
  category: string | null;
  tags: string[];
  author: string | null;
  source_name: string | null;
  nutrition: {
    calories?: string;
    protein?: string;
    carbs?: string;
    fat?: string;
  } | null;
  confidence: 'high' | 'medium' | 'low'; // How confident we are in the extraction
}

// Notification preferences
export interface NotificationSettings {
  enabled: boolean;
  reminderDays: number; // remind after X days of not cooking
  favoriteReminders: boolean; // remind about highly rated recipes
}

// Share data
export interface ShareableRecipe {
  recipe: Recipe;
  cookingLogs: CookingLog[];
  sharedBy: string;
  sharedAt: string;
}

// External recipe discovery
export interface ExternalRecipe {
  id: string;
  title: string;
  image_url: string | null;
  source_url: string;
  source_name: string;
  ready_in_minutes: number | null;
  servings: number | null;
  cuisines: string[];
  dish_types: string[];
  summary: string | null;
  spoonacular_score: number | null;
  health_score: number | null;
  used_ingredients: string[];
  missed_ingredients: string[];
  // Popularity metrics
  aggregate_likes: number | null;
  source_rating: number | null; // Rating from source site (if available)
}

// User cooking preferences (analyzed from saved recipes)
export interface UserPreferences {
  top_cuisines: string[];
  common_ingredients: string[];
  avg_cook_time: number;
  preferred_tags: string[];
}
