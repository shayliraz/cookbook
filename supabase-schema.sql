-- Supabase Schema for Cooking Journal App
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Recipes table
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  source_url TEXT,
  image_url TEXT,
  ingredients TEXT[] DEFAULT '{}',
  instructions TEXT[] DEFAULT '{}',
  prep_time INTEGER, -- minutes
  cook_time INTEGER, -- minutes
  servings INTEGER,
  cuisine TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cooking logs table
CREATE TABLE cooking_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  cooked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  changes_made TEXT,
  who_was_there TEXT[] DEFAULT '{}',
  photo_urls TEXT[] DEFAULT '{}',
  would_make_again BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification settings (for future use)
CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enabled BOOLEAN DEFAULT true,
  reminder_days INTEGER DEFAULT 30,
  favorite_reminders BOOLEAN DEFAULT true,
  push_subscription JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_recipes_cuisine ON recipes(cuisine);
CREATE INDEX idx_recipes_tags ON recipes USING GIN(tags);
CREATE INDEX idx_recipes_created_at ON recipes(created_at DESC);
CREATE INDEX idx_cooking_logs_recipe_id ON cooking_logs(recipe_id);
CREATE INDEX idx_cooking_logs_cooked_at ON cooking_logs(cooked_at DESC);
CREATE INDEX idx_cooking_logs_rating ON cooking_logs(rating);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for recipes updated_at
CREATE TRIGGER update_recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- View for recipes with stats
CREATE OR REPLACE VIEW recipes_with_stats AS
SELECT
  r.*,
  COUNT(cl.id) as times_cooked,
  AVG(cl.rating)::NUMERIC(2,1) as average_rating,
  MAX(cl.cooked_at) as last_cooked
FROM recipes r
LEFT JOIN cooking_logs cl ON r.id = cl.recipe_id
GROUP BY r.id;

-- Storage bucket for photos (run in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('recipe-photos', 'recipe-photos', true);

-- Storage policies (run after creating the bucket)
-- CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'recipe-photos');
-- CREATE POLICY "Anyone can upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'recipe-photos');
-- CREATE POLICY "Anyone can update" ON storage.objects FOR UPDATE USING (bucket_id = 'recipe-photos');
-- CREATE POLICY "Anyone can delete" ON storage.objects FOR DELETE USING (bucket_id = 'recipe-photos');
