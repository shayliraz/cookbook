-- Add recipe_group column to recipes table for manual grouping
-- Run this migration if you already have the recipes table

ALTER TABLE recipes
ADD COLUMN IF NOT EXISTS recipe_group TEXT DEFAULT NULL;

-- Optional: Create an index for faster group-based queries
CREATE INDEX IF NOT EXISTS idx_recipes_recipe_group ON recipes(recipe_group) WHERE recipe_group IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN recipes.recipe_group IS 'Optional grouping name for organizing recipes (e.g., "Weeknight Dinners", "Holiday Baking")';
