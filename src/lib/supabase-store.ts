import { create } from 'zustand';
import { supabase, isSupabaseConfigured, DBRecipe, DBCookingLog, DBSharedSpace, DBSharedSpaceMember, DBRecipeShare } from './supabase';
import { RecipeWithLogs } from '@/types';

interface SupabaseStore {
  // State
  recipes: DBRecipe[];
  cookingLogs: DBCookingLog[];
  sharedSpaces: DBSharedSpace[];
  sharedSpaceMembers: DBSharedSpaceMember[];
  sharedRecipes: DBRecipeShare[];
  loading: boolean;
  initialized: boolean;

  // Initialize - fetch all data for user
  initialize: (userId: string) => Promise<void>;
  reset: () => void;

  // Recipe actions
  fetchRecipes: (userId: string) => Promise<void>;
  addRecipe: (recipe: Omit<DBRecipe, 'id' | 'created_at' | 'updated_at'>) => Promise<DBRecipe | null>;
  updateRecipe: (id: string, updates: Partial<DBRecipe>) => Promise<boolean>;
  deleteRecipe: (id: string) => Promise<boolean>;

  // Cooking log actions
  fetchCookingLogs: (userId: string) => Promise<void>;
  addCookingLog: (log: Omit<DBCookingLog, 'id' | 'created_at'>) => Promise<DBCookingLog | null>;
  updateCookingLog: (id: string, updates: Partial<DBCookingLog>) => Promise<boolean>;
  deleteCookingLog: (id: string) => Promise<boolean>;

  // Shared spaces actions
  fetchSharedSpaces: (userId: string) => Promise<void>;
  createSharedSpace: (name: string, description?: string, userId?: string) => Promise<DBSharedSpace | null>;
  joinSpaceByCode: (inviteCode: string, userId: string) => Promise<boolean>;
  leaveSpace: (spaceId: string, userId: string) => Promise<boolean>;
  shareRecipeToSpace: (recipeId: string, spaceId: string, userId: string) => Promise<boolean>;

  // Direct sharing actions
  shareRecipeWithUser: (recipeId: string, userEmail: string, canEdit: boolean, sharedBy: string) => Promise<boolean>;
  getSharedWithMe: (userId: string) => Promise<DBRecipe[]>;

  // Helpers
  getRecipeWithLogs: (id: string) => RecipeWithLogs | null;
  getAllRecipesWithLogs: () => RecipeWithLogs[];
  getSpaceRecipes: (spaceId: string) => DBRecipe[];
}

export const useSupabaseStore = create<SupabaseStore>((set, get) => ({
  recipes: [],
  cookingLogs: [],
  sharedSpaces: [],
  sharedSpaceMembers: [],
  sharedRecipes: [],
  loading: false,
  initialized: false,

  initialize: async (userId: string) => {
    if (!supabase) {
      console.error('Supabase not configured');
      set({ initialized: true, loading: false }); // Mark as initialized to prevent infinite loading
      return;
    }
    set({ loading: true });
    try {
      await Promise.all([
        get().fetchRecipes(userId),
        get().fetchCookingLogs(userId),
        get().fetchSharedSpaces(userId),
      ]);
    } catch (error) {
      console.error('Error initializing Supabase store:', error);
    } finally {
      set({ loading: false, initialized: true });
    }
  },

  reset: () => {
    set({
      recipes: [],
      cookingLogs: [],
      sharedSpaces: [],
      sharedSpaceMembers: [],
      sharedRecipes: [],
      loading: false,
      initialized: false,
    });
  },

  fetchRecipes: async (userId: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching recipes:', error);
        return;
      }
      set({ recipes: data || [] });
    } catch (error) {
      console.error('Error fetching recipes:', error);
    }
  },

  addRecipe: async (recipe) => {
    try {
      console.log('1. Starting addRecipe for:', recipe.title);

      // Use server-side API route
      console.log('2. Making fetch request to /api/recipes');

      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipe: {
            title: recipe.title,
            description: recipe.description || null,
            source_url: recipe.source_url || null,
            image_url: recipe.image_url || null,
            ingredients: recipe.ingredients || [],
            instructions: recipe.instructions || [],
            prep_time: recipe.prep_time || null,
            cook_time: recipe.cook_time || null,
            servings: recipe.servings || null,
            cuisine: recipe.cuisine || null,
            tags: recipe.tags || [],
            notes: recipe.notes || null,
            recipe_group: recipe.recipe_group || null,
          },
          userId: recipe.user_id,
          userEmail: (recipe as any).user_email || null,
        }),
      });

      console.log('3. Got response:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('4. Error response:', errorData.error);
        return null;
      }

      const { data } = await response.json();

      if (data) {
        console.log('5. Recipe saved:', data.id);
        set((state) => ({ recipes: [data, ...state.recipes] }));
        return data;
      }

      return null;
    } catch (error) {
      console.error('Exception in addRecipe:', error);
      return null;
    }
  },

  updateRecipe: async (id, updates) => {
    if (!supabase) return false;
    const { error } = await supabase
      .from('recipes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      set((state) => ({
        recipes: state.recipes.map((r) =>
          r.id === id ? { ...r, ...updates, updated_at: new Date().toISOString() } : r
        ),
      }));
      return true;
    }
    console.error('Error updating recipe:', error);
    return false;
  },

  deleteRecipe: async (id) => {
    if (!supabase) return false;
    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', id);

    if (!error) {
      set((state) => ({
        recipes: state.recipes.filter((r) => r.id !== id),
        cookingLogs: state.cookingLogs.filter((l) => l.recipe_id !== id),
      }));
      return true;
    }
    console.error('Error deleting recipe:', error);
    return false;
  },

  fetchCookingLogs: async (userId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('cooking_logs')
      .select('*')
      .eq('user_id', userId)
      .order('cooked_at', { ascending: false });

    if (!error && data) {
      set({ cookingLogs: data });
    }
  },

  addCookingLog: async (log) => {
    if (!supabase) {
      console.error('Supabase not configured');
      return null;
    }
    try {
      const { data, error } = await supabase
        .from('cooking_logs')
        .insert([log])
        .select()
        .single();

      if (error) {
        console.error('Error adding cooking log:', error);
        return null;
      }

      if (data) {
        set((state) => ({ cookingLogs: [data, ...state.cookingLogs] }));
        return data;
      }
      return null;
    } catch (error) {
      console.error('Error adding cooking log:', error);
      return null;
    }
  },

  updateCookingLog: async (id, updates) => {
    if (!supabase) return false;
    const { error } = await supabase
      .from('cooking_logs')
      .update(updates)
      .eq('id', id);

    if (!error) {
      set((state) => ({
        cookingLogs: state.cookingLogs.map((l) =>
          l.id === id ? { ...l, ...updates } : l
        ),
      }));
      return true;
    }
    return false;
  },

  deleteCookingLog: async (id) => {
    if (!supabase) return false;
    const { error } = await supabase
      .from('cooking_logs')
      .delete()
      .eq('id', id);

    if (!error) {
      set((state) => ({
        cookingLogs: state.cookingLogs.filter((l) => l.id !== id),
      }));
      return true;
    }
    return false;
  },

  fetchSharedSpaces: async (userId: string) => {
    if (!supabase) return;
    // Fetch spaces where user is a member
    const { data: memberships, error: memberError } = await supabase
      .from('shared_space_members')
      .select('*, shared_spaces(*)')
      .eq('user_id', userId);

    if (!memberError && memberships) {
      const spaces = memberships.map((m: any) => m.shared_spaces).filter(Boolean);
      set({
        sharedSpaces: spaces,
        sharedSpaceMembers: memberships.map(({ shared_spaces, ...m }: any) => m),
      });
    }
  },

  createSharedSpace: async (name, description, userId) => {
    if (!userId) return null;

    try {
      console.log('Creating space via API:', name);

      const response = await fetch('/api/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createSpace',
          name,
          description,
          userId,
        }),
      });

      console.log('Space API response:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error creating space:', errorData.error);
        return null;
      }

      const { data } = await response.json();

      if (data) {
        console.log('Space created:', data.id);
        set((state) => ({ sharedSpaces: [...state.sharedSpaces, data] }));
        return data;
      }
      return null;
    } catch (error) {
      console.error('Exception creating space:', error);
      return null;
    }
  },

  joinSpaceByCode: async (inviteCode, userId) => {
    if (!supabase) return false;
    // First find the space
    const { data: space, error: findError } = await supabase
      .from('shared_spaces')
      .select('*')
      .eq('invite_code', inviteCode)
      .single();

    if (findError || !space) {
      console.error('Space not found:', findError);
      return false;
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('shared_space_members')
      .select('id')
      .eq('space_id', space.id)
      .eq('user_id', userId)
      .single();

    if (existingMember) {
      // Already a member, just add to local state if not there
      const state = get();
      if (!state.sharedSpaces.find(s => s.id === space.id)) {
        set((state) => ({
          sharedSpaces: [...state.sharedSpaces, space],
        }));
      }
      return true;
    }

    // Join the space (use upsert to handle edge cases)
    const { error } = await supabase
      .from('shared_space_members')
      .upsert([{ space_id: space.id, user_id: userId, role: 'member' }], {
        onConflict: 'space_id,user_id',
      });

    if (!error) {
      set((state) => ({
        sharedSpaces: state.sharedSpaces.find(s => s.id === space.id)
          ? state.sharedSpaces
          : [...state.sharedSpaces, space],
        sharedSpaceMembers: [...state.sharedSpaceMembers, {
          id: '', // Will be set by DB
          space_id: space.id,
          user_id: userId,
          role: 'member' as const,
          joined_at: new Date().toISOString(),
        }],
      }));
      return true;
    }
    console.error('Error joining space:', error);
    return false;
  },

  leaveSpace: async (spaceId, userId) => {
    if (!supabase) return false;
    const { error } = await supabase
      .from('shared_space_members')
      .delete()
      .eq('space_id', spaceId)
      .eq('user_id', userId);

    if (!error) {
      set((state) => ({
        sharedSpaces: state.sharedSpaces.filter((s) => s.id !== spaceId),
        sharedSpaceMembers: state.sharedSpaceMembers.filter(
          (m) => !(m.space_id === spaceId && m.user_id === userId)
        ),
      }));
      return true;
    }
    return false;
  },

  shareRecipeToSpace: async (recipeId, spaceId, userId) => {
    try {
      console.log('Sharing recipe to space via API');

      const response = await fetch('/api/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'shareRecipeToSpace',
          recipeId,
          spaceId,
          userId,
        }),
      });

      console.log('Share API response:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error sharing recipe:', errorData.error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception sharing recipe:', error);
      return false;
    }
  },

  shareRecipeWithUser: async (recipeId, userEmail, canEdit, sharedBy) => {
    if (!supabase) return false;
    // Find user by email
    const { data: targetUser, error: findError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', userEmail)
      .single();

    if (findError || !targetUser) {
      console.error('User not found:', findError);
      return false;
    }

    const { error } = await supabase
      .from('recipe_shares')
      .insert([{
        recipe_id: recipeId,
        shared_by: sharedBy,
        shared_with: targetUser.id,
        can_edit: canEdit,
      }]);

    return !error;
  },

  getSharedWithMe: async (userId) => {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('recipe_shares')
      .select('*, recipes(*)')
      .eq('shared_with', userId);

    if (!error && data) {
      return data.map((share: any) => share.recipes).filter(Boolean);
    }
    return [];
  },

  getRecipeWithLogs: (id) => {
    const state = get();
    const recipe = state.recipes.find((r) => r.id === id);
    if (!recipe) return null;

    const logs = state.cookingLogs
      .filter((l) => l.recipe_id === id)
      .sort((a, b) => new Date(b.cooked_at).getTime() - new Date(a.cooked_at).getTime());

    const ratings = logs.map((l) => l.rating).filter((r): r is number => r !== null && r > 0);
    const averageRating = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : null;

    return {
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      image_url: recipe.image_url,
      source_url: recipe.source_url,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      prep_time: recipe.prep_time,
      cook_time: recipe.cook_time,
      servings: recipe.servings,
      cuisine: recipe.cuisine,
      tags: recipe.tags,
      notes: recipe.notes,
      recipe_group: recipe.recipe_group || null,
      created_at: recipe.created_at,
      updated_at: recipe.updated_at,
      cooking_logs: logs.map(l => ({
        id: l.id,
        recipe_id: l.recipe_id,
        cooked_at: l.cooked_at,
        rating: l.rating || 0,
        notes: l.notes,
        changes_made: l.modifications,
        who_was_there: l.people_served,
        photo_urls: l.photo_urls,
        would_make_again: true,
        created_at: l.created_at,
      })),
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

      const ratings = logs.map((l) => l.rating).filter((r): r is number => r !== null && r > 0);
      const averageRating = ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : null;

      return {
        id: recipe.id,
        title: recipe.title,
        description: recipe.description,
        image_url: recipe.image_url,
        source_url: recipe.source_url,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        servings: recipe.servings,
        cuisine: recipe.cuisine,
        tags: recipe.tags,
        notes: recipe.notes,
        recipe_group: recipe.recipe_group || null,
        created_at: recipe.created_at,
        updated_at: recipe.updated_at,
        cooking_logs: logs.map(l => ({
          id: l.id,
          recipe_id: l.recipe_id,
          cooked_at: l.cooked_at,
          rating: l.rating || 0,
          notes: l.notes,
          changes_made: l.modifications,
          who_was_there: l.people_served,
          photo_urls: l.photo_urls,
          would_make_again: true,
          created_at: l.created_at,
        })),
        last_cooked: logs.length > 0 ? logs[0].cooked_at : null,
        average_rating: averageRating,
        times_cooked: logs.length,
      };
    });
  },

  getSpaceRecipes: (spaceId) => {
    // This would need to fetch from shared_space_recipes
    // For now return empty, will implement with UI
    return [];
  },
}));
