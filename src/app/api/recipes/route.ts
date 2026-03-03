import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('API /recipes called');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase not configured');
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { recipe, userId } = body;

    console.log('Received recipe:', recipe?.title, 'for user:', userId);

    if (!recipe || !userId) {
      return NextResponse.json({ error: 'Missing recipe or userId' }, { status: 400 });
    }

    // Create server-side Supabase client with service role key (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Ensure user profile exists (upsert to handle missing profiles)
    console.log('Ensuring profile exists for user:', userId);
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        { id: userId, updated_at: new Date().toISOString() },
        { onConflict: 'id', ignoreDuplicates: true }
      );

    if (profileError) {
      console.error('Profile upsert error:', profileError.message);
      // Continue anyway - the profile might already exist
    }

    console.log('Inserting into database...');

    const { data, error } = await supabase
      .from('recipes')
      .insert([{
        user_id: userId,
        title: recipe.title || 'Untitled',
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
      }])
      .select()
      .single();

    if (error) {
      console.error('Database error:', error.message, error.code);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('Recipe saved:', data?.id);
    return NextResponse.json({ data });

  } catch (error: any) {
    console.error('Exception:', error.message);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}
