'use client';

import { useState, useMemo } from 'react';
import { Modal, Button, Input } from './ui';
import { useCookingStore } from '@/lib/store';
import { useSupabaseStore } from '@/lib/supabase-store';
import { useAuth } from '@/lib/auth-context';
import { ScrapedRecipe } from '@/types';
import { Link, Loader2, Plus, X, Sparkles } from 'lucide-react';
import { GroupSelect } from './GroupSelect';

interface AddRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddRecipeModal({ isOpen, onClose }: AddRecipeModalProps) {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [scrapedData, setScrapedData] = useState<ScrapedRecipe | null>(null);
  const [manualMode, setManualMode] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<string[]>(['']);
  const [instructions, setInstructions] = useState<string[]>(['']);
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [servings, setServings] = useState('');
  const [tags, setTags] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [recipeGroup, setRecipeGroup] = useState('');

  // Auth and stores
  const { user } = useAuth();
  const localStore = useCookingStore();
  const localAddRecipe = localStore.addRecipe;
  const { addRecipe: supabaseAddRecipe, initialized: supabaseInitialized, recipes: supabaseRecipes } = useSupabaseStore();

  // Get existing groups from recipes
  const existingGroups = useMemo(() => {
    const recipes = user && supabaseInitialized ? supabaseRecipes : localStore.recipes;
    const groups = recipes
      .map((r: any) => r.recipe_group)
      .filter((g: any): g is string => g !== null && g !== undefined && g.trim() !== '');
    return [...new Set(groups)].sort();
  }, [user, supabaseInitialized, supabaseRecipes, localStore.recipes]);

  const handleScrape = async () => {
    if (!url) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error('Failed to scrape recipe');
      }

      const data: ScrapedRecipe = await response.json();
      setScrapedData(data);

      // Populate form
      setTitle(data.title);
      setDescription(data.description || '');
      setIngredients(data.ingredients.length > 0 ? data.ingredients : ['']);
      setInstructions(data.instructions.length > 0 ? data.instructions : ['']);
      setPrepTime(data.prep_time?.toString() || '');
      setCookTime(data.cook_time?.toString() || '');
      setServings(data.servings?.toString() || '');
    } catch (err) {
      setError('Could not scrape recipe. Try entering manually or check the URL.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Please enter a recipe title');
      return;
    }

    setIsSaving(true);
    setError('');

    const recipeData = {
      title: title.trim(),
      description: description.trim() || null,
      source_url: url || null,
      image_url: scrapedData?.image_url || null,
      ingredients: ingredients.filter((i) => i.trim()),
      instructions: instructions.filter((i) => i.trim()),
      prep_time: prepTime ? parseInt(prepTime) : null,
      cook_time: cookTime ? parseInt(cookTime) : null,
      servings: servings ? parseInt(servings) : null,
      cuisine: cuisine.trim() || null,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      notes: null,
      recipe_group: recipeGroup.trim() || null,
    };

    try {
      console.log('Saving recipe with data:', recipeData);
      if (user && supabaseInitialized) {
        // Save to Supabase when logged in
        console.log('Saving to Supabase for user:', user.id);
        const result = await supabaseAddRecipe({
          ...recipeData,
          user_id: user.id,
          user_email: user.email,
        } as any);
        console.log('Supabase result:', result);
        if (!result) {
          setError('Failed to save recipe. Please try again.');
          setIsSaving(false);
          return;
        }
      } else {
        // Save to localStorage when not logged in
        localAddRecipe(recipeData);
      }
      handleClose();
    } catch (err) {
      console.error('Error saving recipe:', err);
      setError('Failed to save recipe. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setUrl('');
    setScrapedData(null);
    setManualMode(false);
    setError('');
    setTitle('');
    setDescription('');
    setIngredients(['']);
    setInstructions(['']);
    setPrepTime('');
    setCookTime('');
    setServings('');
    setTags('');
    setCuisine('');
    setRecipeGroup('');
    setIsSaving(false);
    onClose();
  };

  const addIngredient = () => setIngredients([...ingredients, '']);
  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };
  const updateIngredient = (index: number, value: string) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = value;
    setIngredients(newIngredients);
  };

  const addInstruction = () => setInstructions([...instructions, '']);
  const removeInstruction = (index: number) => {
    setInstructions(instructions.filter((_, i) => i !== index));
  };
  const updateInstruction = (index: number, value: string) => {
    const newInstructions = [...instructions];
    newInstructions[index] = value;
    setInstructions(newInstructions);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add New Recipe" size="lg">
      <div className="space-y-6">
        {/* URL Input Section */}
        {!scrapedData && !manualMode && (
          <div className="space-y-4">
            <div className="p-6 bg-gradient-to-br from-orange-50 to-pink-50 rounded-2xl">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-500" />
                Import from URL
              </h3>
              <div className="flex gap-2">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste recipe URL here..."
                  icon={<Link className="w-4 h-4" />}
                  className="flex-1"
                />
                <Button onClick={handleScrape} isLoading={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Import'}
                </Button>
              </div>
              {error && (
                <p className="mt-2 text-sm text-red-500">{error}</p>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">or</span>
              </div>
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setManualMode(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Recipe Manually
            </Button>
          </div>
        )}

        {/* Recipe Form */}
        {(scrapedData || manualMode) && (
          <div className="space-y-5">
            {scrapedData && (
              <div className="p-3 bg-green-50 text-green-700 rounded-xl text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Recipe imported! Review and edit below.
              </div>
            )}

            <Input
              label="Recipe Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Grandma's Apple Pie"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of this dish..."
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:bg-white transition-all duration-200 resize-none"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Prep Time (min)"
                type="number"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
                placeholder="15"
              />
              <Input
                label="Cook Time (min)"
                type="number"
                value={cookTime}
                onChange={(e) => setCookTime(e.target.value)}
                placeholder="30"
              />
              <Input
                label="Servings"
                type="number"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                placeholder="4"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Cuisine"
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                placeholder="e.g., Italian, Mexican"
              />
              <Input
                label="Tags (comma separated)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="dinner, quick, vegetarian"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Recipe Group (optional)
              </label>
              <GroupSelect
                value={recipeGroup}
                onChange={setRecipeGroup}
                existingGroups={existingGroups}
                placeholder="Select or create a group"
              />
            </div>

            {/* Ingredients */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ingredients
              </label>
              <div className="space-y-2">
                {ingredients.map((ingredient, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={ingredient}
                      onChange={(e) => updateIngredient(index, e.target.value)}
                      placeholder={`Ingredient ${index + 1}`}
                      className="flex-1"
                    />
                    {ingredients.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeIngredient(index)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={addIngredient}>
                  <Plus className="w-4 h-4 mr-1" /> Add Ingredient
                </Button>
              </div>
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Instructions
              </label>
              <div className="space-y-2">
                {instructions.map((instruction, index) => (
                  <div key={index} className="flex gap-2">
                    <span className="flex-shrink-0 w-8 h-10 flex items-center justify-center bg-orange-100 text-orange-600 font-semibold rounded-xl text-sm">
                      {index + 1}
                    </span>
                    <textarea
                      value={instruction}
                      onChange={(e) => updateInstruction(index, e.target.value)}
                      placeholder={`Step ${index + 1}`}
                      className="flex-1 px-4 py-2 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:bg-white transition-all duration-200 resize-none"
                      rows={2}
                    />
                    {instructions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeInstruction(index)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={addInstruction}>
                  <Plus className="w-4 h-4 mr-1" /> Add Step
                </Button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <Button variant="secondary" onClick={handleClose} className="flex-1" disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} className="flex-1" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Recipe'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
