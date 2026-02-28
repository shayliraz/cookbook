import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Only create client if both URL and key are configured
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const isSupabaseConfigured = !!supabase;

// Database types
export interface DBProfile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DBRecipe {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  source_url: string | null;
  ingredients: string[];
  instructions: string[];
  prep_time: number | null;
  cook_time: number | null;
  servings: number | null;
  cuisine: string | null;
  tags: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DBCookingLog {
  id: string;
  recipe_id: string;
  user_id: string;
  cooked_at: string;
  rating: number | null;
  notes: string | null;
  modifications: string | null;
  people_served: string[];
  photo_urls: string[];
  created_at: string;
}

export interface DBSharedSpace {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  owner_id: string;
  invite_code: string;
  created_at: string;
  updated_at: string;
}

export interface DBSharedSpaceMember {
  id: string;
  space_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

export interface DBRecipeShare {
  id: string;
  recipe_id: string;
  shared_by: string;
  shared_with: string;
  can_edit: boolean;
  shared_at: string;
}
