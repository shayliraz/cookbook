-- Supabase Schema for Cooking Journal App
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users profile table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recipes table
CREATE TABLE recipes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  source_url TEXT,
  ingredients TEXT[] DEFAULT '{}',
  instructions TEXT[] DEFAULT '{}',
  prep_time INTEGER,
  cook_time INTEGER,
  servings INTEGER,
  cuisine TEXT,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  recipe_group TEXT, -- Optional grouping name for organizing recipes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cooking logs (history of when recipes were cooked)
CREATE TABLE cooking_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  cooked_at TIMESTAMPTZ DEFAULT NOW(),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  modifications TEXT,
  people_served TEXT[] DEFAULT '{}',
  photo_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shared spaces (group cookbooks)
CREATE TABLE shared_spaces (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  invite_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shared space members
CREATE TABLE shared_space_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  space_id UUID REFERENCES shared_spaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(space_id, user_id)
);

-- Recipes shared to spaces
CREATE TABLE shared_space_recipes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  space_id UUID REFERENCES shared_spaces(id) ON DELETE CASCADE NOT NULL,
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  shared_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  shared_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(space_id, recipe_id)
);

-- Direct recipe shares (user to user)
CREATE TABLE recipe_shares (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  shared_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  shared_with UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  can_edit BOOLEAN DEFAULT FALSE,
  shared_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(recipe_id, shared_with)
);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooking_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_space_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_space_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_shares ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all profiles, update only their own
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Recipes: users can CRUD their own, read shared ones
CREATE POLICY "Users can view own recipes" ON recipes
  FOR SELECT USING (
    user_id = auth.uid() OR
    id IN (SELECT recipe_id FROM recipe_shares WHERE shared_with = auth.uid()) OR
    id IN (
      SELECT ssr.recipe_id FROM shared_space_recipes ssr
      JOIN shared_space_members ssm ON ssr.space_id = ssm.space_id
      WHERE ssm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own recipes" ON recipes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own recipes" ON recipes
  FOR UPDATE USING (
    user_id = auth.uid() OR
    id IN (SELECT recipe_id FROM recipe_shares WHERE shared_with = auth.uid() AND can_edit = true)
  );

CREATE POLICY "Users can delete own recipes" ON recipes
  FOR DELETE USING (user_id = auth.uid());

-- Cooking logs: users can CRUD their own
CREATE POLICY "Users can view own cooking logs" ON cooking_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own cooking logs" ON cooking_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own cooking logs" ON cooking_logs
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own cooking logs" ON cooking_logs
  FOR DELETE USING (user_id = auth.uid());

-- Shared spaces policies
CREATE POLICY "Members can view their spaces" ON shared_spaces
  FOR SELECT USING (
    owner_id = auth.uid() OR
    id IN (SELECT space_id FROM shared_space_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create spaces" ON shared_spaces
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update spaces" ON shared_spaces
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete spaces" ON shared_spaces
  FOR DELETE USING (owner_id = auth.uid());

-- Shared space members policies
CREATE POLICY "Members can view space members" ON shared_space_members
  FOR SELECT USING (
    space_id IN (SELECT space_id FROM shared_space_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can add members" ON shared_space_members
  FOR INSERT WITH CHECK (
    space_id IN (
      SELECT space_id FROM shared_space_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ) OR
    user_id = auth.uid()
  );

CREATE POLICY "Admins can remove members" ON shared_space_members
  FOR DELETE USING (
    space_id IN (
      SELECT space_id FROM shared_space_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ) OR
    user_id = auth.uid()
  );

-- Shared space recipes policies
CREATE POLICY "Members can view space recipes" ON shared_space_recipes
  FOR SELECT USING (
    space_id IN (SELECT space_id FROM shared_space_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Members can add recipes to spaces" ON shared_space_recipes
  FOR INSERT WITH CHECK (
    space_id IN (SELECT space_id FROM shared_space_members WHERE user_id = auth.uid()) AND
    shared_by = auth.uid()
  );

CREATE POLICY "Users can remove their shared recipes" ON shared_space_recipes
  FOR DELETE USING (shared_by = auth.uid());

-- Recipe shares policies
CREATE POLICY "Users can view their shares" ON recipe_shares
  FOR SELECT USING (shared_by = auth.uid() OR shared_with = auth.uid());

CREATE POLICY "Users can share own recipes" ON recipe_shares
  FOR INSERT WITH CHECK (
    shared_by = auth.uid() AND
    recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete their shares" ON recipe_shares
  FOR DELETE USING (shared_by = auth.uid() OR shared_with = auth.uid());

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to add owner as member when space is created
CREATE OR REPLACE FUNCTION handle_new_space()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO shared_space_members (space_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new space
DROP TRIGGER IF EXISTS on_space_created ON shared_spaces;
CREATE TRIGGER on_space_created
  AFTER INSERT ON shared_spaces
  FOR EACH ROW EXECUTE FUNCTION handle_new_space();

-- Indexes for performance
CREATE INDEX idx_recipes_user_id ON recipes(user_id);
CREATE INDEX idx_cooking_logs_recipe_id ON cooking_logs(recipe_id);
CREATE INDEX idx_cooking_logs_user_id ON cooking_logs(user_id);
CREATE INDEX idx_shared_space_members_user_id ON shared_space_members(user_id);
CREATE INDEX idx_shared_space_members_space_id ON shared_space_members(space_id);
CREATE INDEX idx_shared_space_recipes_space_id ON shared_space_recipes(space_id);
CREATE INDEX idx_recipe_shares_shared_with ON recipe_shares(shared_with);
