import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('API /spaces called');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase not configured');
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { action, name, description, userId, recipeId, spaceId } = body;

    console.log('Action:', action, 'User:', userId);

    // Create server-side Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    if (action === 'createSpace') {
      if (!name || !userId) {
        return NextResponse.json({ error: 'Missing name or userId' }, { status: 400 });
      }

      console.log('Creating space:', name);

      const { data, error } = await supabase
        .from('shared_spaces')
        .insert([{ name, description: description || null, owner_id: userId }])
        .select()
        .single();

      if (error) {
        console.error('Error creating space:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('Space created:', data?.id);
      return NextResponse.json({ data });
    }

    if (action === 'shareRecipeToSpace') {
      if (!recipeId || !spaceId || !userId) {
        return NextResponse.json({ error: 'Missing recipeId, spaceId, or userId' }, { status: 400 });
      }

      console.log('Sharing recipe', recipeId, 'to space', spaceId);

      const { error } = await supabase
        .from('shared_space_recipes')
        .insert([{ recipe_id: recipeId, space_id: spaceId, shared_by: userId }]);

      if (error) {
        console.error('Error sharing recipe:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('Recipe shared successfully');
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error: any) {
    console.error('Exception:', error.message);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}
