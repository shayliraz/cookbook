import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Recipe, CookingLog, RecipeWithLogs, NotificationSettings } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface CookingStore {
  // Data
  recipes: Recipe[];
  cookingLogs: CookingLog[];
  notificationSettings: NotificationSettings;

  // Recipe actions
  addRecipe: (recipe: Omit<Recipe, 'id' | 'created_at' | 'updated_at'>) => Recipe;
  updateRecipe: (id: string, updates: Partial<Recipe>) => void;
  deleteRecipe: (id: string) => void;
  getRecipeWithLogs: (id: string) => RecipeWithLogs | null;
  getAllRecipesWithLogs: () => RecipeWithLogs[];

  // Cooking log actions
  addCookingLog: (log: Omit<CookingLog, 'id' | 'created_at'>) => CookingLog;
  updateCookingLog: (id: string, updates: Partial<CookingLog>) => void;
  deleteCookingLog: (id: string) => void;

  // Notification settings
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;

  // Utility
  getRecipesByFilter: (filter: {
    maxTime?: number;
    cuisine?: string;
    tags?: string[];
    minRating?: number;
    notCookedInDays?: number;
  }) => RecipeWithLogs[];
}

export const useCookingStore = create<CookingStore>()(
  persist(
    (set, get) => ({
      recipes: [],
      cookingLogs: [],
      notificationSettings: {
        enabled: true,
        reminderDays: 30,
        favoriteReminders: true,
      },

      addRecipe: (recipeData) => {
        const recipe: Recipe = {
          ...recipeData,
          id: uuidv4(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        set((state) => ({ recipes: [...state.recipes, recipe] }));
        return recipe;
      },

      updateRecipe: (id, updates) => {
        set((state) => ({
          recipes: state.recipes.map((r) =>
            r.id === id ? { ...r, ...updates, updated_at: new Date().toISOString() } : r
          ),
        }));
      },

      deleteRecipe: (id) => {
        set((state) => ({
          recipes: state.recipes.filter((r) => r.id !== id),
          cookingLogs: state.cookingLogs.filter((l) => l.recipe_id !== id),
        }));
      },

      getRecipeWithLogs: (id) => {
        const state = get();
        const recipe = state.recipes.find((r) => r.id === id);
        if (!recipe) return null;

        const logs = state.cookingLogs
          .filter((l) => l.recipe_id === id)
          .sort((a, b) => new Date(b.cooked_at).getTime() - new Date(a.cooked_at).getTime());

        const ratings = logs.map((l) => l.rating).filter((r) => r > 0);
        const averageRating = ratings.length > 0
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length
          : null;

        return {
          ...recipe,
          cooking_logs: logs,
          last_cooked: logs.length > 0 ? logs[0].cooked_at : null,
          average_rating: averageRating,
          times_cooked: logs.length,
        };
      },

      getAllRecipesWithLogs: () => {
        const state = get();
        return state.recipes.map((recipe) => {
          const logs = state.cookingLogs
            .filter((l) => l.recipe_id === recipe.id)
            .sort((a, b) => new Date(b.cooked_at).getTime() - new Date(a.cooked_at).getTime());

          const ratings = logs.map((l) => l.rating).filter((r) => r > 0);
          const averageRating = ratings.length > 0
            ? ratings.reduce((a, b) => a + b, 0) / ratings.length
            : null;

          return {
            ...recipe,
            cooking_logs: logs,
            last_cooked: logs.length > 0 ? logs[0].cooked_at : null,
            average_rating: averageRating,
            times_cooked: logs.length,
          };
        });
      },

      addCookingLog: (logData) => {
        const log: CookingLog = {
          ...logData,
          id: uuidv4(),
          created_at: new Date().toISOString(),
        };
        set((state) => ({ cookingLogs: [...state.cookingLogs, log] }));
        return log;
      },

      updateCookingLog: (id, updates) => {
        set((state) => ({
          cookingLogs: state.cookingLogs.map((l) =>
            l.id === id ? { ...l, ...updates } : l
          ),
        }));
      },

      deleteCookingLog: (id) => {
        set((state) => ({
          cookingLogs: state.cookingLogs.filter((l) => l.id !== id),
        }));
      },

      updateNotificationSettings: (settings) => {
        set((state) => ({
          notificationSettings: { ...state.notificationSettings, ...settings },
        }));
      },

      getRecipesByFilter: (filter) => {
        const allRecipes = get().getAllRecipesWithLogs();

        return allRecipes.filter((recipe) => {
          // Max total time filter
          if (filter.maxTime) {
            const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);
            if (totalTime > filter.maxTime) return false;
          }

          // Cuisine filter
          if (filter.cuisine && recipe.cuisine?.toLowerCase() !== filter.cuisine.toLowerCase()) {
            return false;
          }

          // Tags filter
          if (filter.tags && filter.tags.length > 0) {
            const recipeTags = recipe.tags.map((t) => t.toLowerCase());
            const hasAllTags = filter.tags.every((t) => recipeTags.includes(t.toLowerCase()));
            if (!hasAllTags) return false;
          }

          // Min rating filter
          if (filter.minRating && (recipe.average_rating || 0) < filter.minRating) {
            return false;
          }

          // Not cooked in X days filter
          if (filter.notCookedInDays) {
            if (recipe.last_cooked) {
              const daysSinceCooked = Math.floor(
                (Date.now() - new Date(recipe.last_cooked).getTime()) / (1000 * 60 * 60 * 24)
              );
              if (daysSinceCooked < filter.notCookedInDays) return false;
            }
          }

          return true;
        });
      },
    }),
    {
      name: 'cooking-journal-storage',
    }
  )
);
