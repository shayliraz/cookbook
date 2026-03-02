import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recipe, userId, accessToken } = body;

    if (!recipe || !userId) {
      return NextResponse.json({ error: 'Missing recipe or userId' }, { status: 400 });
    }

    // Create server-side Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // If we have an access token, set it for RLS
    if (accessToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: '' });
    }

    console.log('Server: Inserting recipe:', recipe.title);

    const { data, error } = await supabase
      .from('recipes')
      .insert([{
        user_id: userId,
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
      }])
      .select()
      .single();

    if (error) {
      console.error('Server: Error inserting recipe:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('Server: Recipe saved:', data?.id);
    return NextResponse.json({ data });

  } catch (error: any) {
    console.error('Server: Exception:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
