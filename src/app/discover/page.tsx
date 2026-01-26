'use client';

import { useState, useMemo } from 'react';
import { useCookingStore } from '@/lib/store';
import { RecipeCard } from '@/components/RecipeCard';
import { Button, Card, Input, Badge } from '@/components/ui';
import {
  ArrowLeft,
  Shuffle,
  Clock,
  Calendar,
  Sparkles,
  ChefHat,
  Flame,
  Heart,
  ShoppingBag,
  X,
  Plus,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { RecipeWithLogs } from '@/types';

type SuggestionMode = 'quick' | 'favorites' | 'forgotten' | 'random' | 'custom' | 'ingredients';

interface IngredientMatch {
  recipe: RecipeWithLogs;
  matchedIngredients: string[];
  matchPercentage: number;
  missingIngredients: string[];
}

export default function DiscoverPage() {
  const [mode, setMode] = useState<SuggestionMode | null>(null);
  const [maxTime, setMaxTime] = useState('');
  const [suggestions, setSuggestions] = useState<RecipeWithLogs[]>([]);

  // Ingredient search state
  const [ingredientInput, setIngredientInput] = useState('');
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [ingredientMatches, setIngredientMatches] = useState<IngredientMatch[]>([]);

  const getAllRecipesWithLogs = useCookingStore((state) => state.getAllRecipesWithLogs);
  const recipes = getAllRecipesWithLogs();

  // Get all unique ingredients from recipes for autocomplete
  const allIngredients = useMemo(() => {
    const ingredients = new Set<string>();
    recipes.forEach((recipe) => {
      recipe.ingredients.forEach((ing) => {
        // Extract main ingredient word (first word or common pattern)
        const cleaned = ing.toLowerCase()
          .replace(/\d+.*?(cup|tbsp|tsp|oz|g|kg|ml|l|lb|pound|tablespoon|teaspoon|כף|כפית|כוס|גרם)s?\s*/gi, '')
          .replace(/^[\d\s\/½⅓¼⅔¾.]+/, '')
          .trim()
          .split(/[,()]/)[0]
          .trim();

        if (cleaned.length > 2) {
          ingredients.add(cleaned);
        }
      });
    });
    return Array.from(ingredients).sort();
  }, [recipes]);

  // Filter suggestions for autocomplete
  const ingredientSuggestions = useMemo(() => {
    if (!ingredientInput.trim()) return [];
    const input = ingredientInput.toLowerCase();
    return allIngredients
      .filter((ing) =>
        ing.includes(input) && !selectedIngredients.includes(ing)
      )
      .slice(0, 8);
  }, [ingredientInput, allIngredients, selectedIngredients]);

  const quickMeals = useMemo(() => {
    return recipes
      .filter((r) => {
        const totalTime = (r.prep_time || 0) + (r.cook_time || 0);
        return totalTime > 0 && totalTime <= 30;
      })
      .sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
  }, [recipes]);

  const favorites = useMemo(() => {
    return recipes
      .filter((r) => (r.average_rating || 0) >= 4)
      .sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
  }, [recipes]);

  const forgotten = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return recipes
      .filter((r) => {
        if (!r.last_cooked) return true;
        return new Date(r.last_cooked) < thirtyDaysAgo;
      })
      .sort((a, b) => {
        if (!a.last_cooked) return -1;
        if (!b.last_cooked) return 1;
        return new Date(a.last_cooked).getTime() - new Date(b.last_cooked).getTime();
      });
  }, [recipes]);

  const getRandomRecipe = () => {
    if (recipes.length === 0) return;
    const random = recipes[Math.floor(Math.random() * recipes.length)];
    setSuggestions([random]);
    setMode('random');
  };

  const handleModeSelect = (selectedMode: SuggestionMode) => {
    setMode(selectedMode);
    switch (selectedMode) {
      case 'quick':
        setSuggestions(quickMeals);
        break;
      case 'favorites':
        setSuggestions(favorites);
        break;
      case 'forgotten':
        setSuggestions(forgotten);
        break;
      case 'random':
        getRandomRecipe();
        break;
      case 'ingredients':
        // Reset ingredient search
        setSelectedIngredients([]);
        setIngredientMatches([]);
        setSuggestions([]);
        break;
      case 'custom':
        setSuggestions([]);
        break;
    }
  };

  const applyCustomFilter = () => {
    let filtered = [...recipes];

    if (maxTime) {
      const time = parseInt(maxTime);
      filtered = filtered.filter((r) => {
        const totalTime = (r.prep_time || 0) + (r.cook_time || 0);
        return totalTime === 0 || totalTime <= time;
      });
    }

    setSuggestions(filtered);
  };

  // Ingredient matching functions
  const addIngredient = (ingredient: string) => {
    const cleaned = ingredient.toLowerCase().trim();
    if (cleaned && !selectedIngredients.includes(cleaned)) {
      setSelectedIngredients([...selectedIngredients, cleaned]);
      setIngredientInput('');
    }
  };

  const removeIngredient = (ingredient: string) => {
    setSelectedIngredients(selectedIngredients.filter((i) => i !== ingredient));
  };

  const findRecipesByIngredients = () => {
    if (selectedIngredients.length === 0) {
      setIngredientMatches([]);
      return;
    }

    const matches: IngredientMatch[] = recipes.map((recipe) => {
      const recipeIngredients = recipe.ingredients.map((ing) =>
        ing.toLowerCase()
          .replace(/\d+.*?(cup|tbsp|tsp|oz|g|kg|ml|l|lb|pound|tablespoon|teaspoon|כף|כפית|כוס|גרם)s?\s*/gi, '')
          .replace(/^[\d\s\/½⅓¼⅔¾.]+/, '')
          .trim()
      );

      const matchedIngredients: string[] = [];
      const missingIngredients: string[] = [];

      // Check which selected ingredients match recipe ingredients
      selectedIngredients.forEach((selected) => {
        const found = recipeIngredients.some((recipeIng) =>
          recipeIng.includes(selected) || selected.includes(recipeIng.split(/[,()]/)[0].trim())
        );
        if (found) {
          matchedIngredients.push(selected);
        }
      });

      // Find missing key ingredients (simple heuristic)
      recipeIngredients.forEach((recipeIng) => {
        const mainIngredient = recipeIng.split(/[,()]/)[0].trim();
        if (mainIngredient.length > 2) {
          const isMatched = selectedIngredients.some((selected) =>
            mainIngredient.includes(selected) || selected.includes(mainIngredient)
          );
          if (!isMatched) {
            missingIngredients.push(mainIngredient);
          }
        }
      });

      const matchPercentage = (matchedIngredients.length / selectedIngredients.length) * 100;

      return {
        recipe,
        matchedIngredients,
        matchPercentage,
        missingIngredients: missingIngredients.slice(0, 5), // Only show first 5 missing
      };
    });

    // Sort by match percentage, then by rating
    const sortedMatches = matches
      .filter((m) => m.matchedIngredients.length > 0)
      .sort((a, b) => {
        if (b.matchPercentage !== a.matchPercentage) {
          return b.matchPercentage - a.matchPercentage;
        }
        return (b.recipe.average_rating || 0) - (a.recipe.average_rating || 0);
      });

    setIngredientMatches(sortedMatches);
  };

  const modeOptions = [
    {
      id: 'ingredients' as SuggestionMode,
      icon: ShoppingBag,
      title: 'I Have These Ingredients',
      description: 'Find recipes you can make',
      color: 'from-green-500 to-emerald-500',
      count: recipes.length,
    },
    {
      id: 'quick' as SuggestionMode,
      icon: Clock,
      title: 'Quick Meals',
      description: '30 minutes or less',
      color: 'from-blue-500 to-cyan-500',
      count: quickMeals.length,
    },
    {
      id: 'favorites' as SuggestionMode,
      icon: Heart,
      title: 'Favorites',
      description: 'Your highest rated',
      color: 'from-pink-500 to-rose-500',
      count: favorites.length,
    },
    {
      id: 'forgotten' as SuggestionMode,
      icon: Calendar,
      title: 'Forgotten Gems',
      description: "Haven't made in 30+ days",
      color: 'from-purple-500 to-violet-500',
      count: forgotten.length,
    },
    {
      id: 'random' as SuggestionMode,
      icon: Shuffle,
      title: 'Surprise Me!',
      description: 'Random pick',
      color: 'from-orange-500 to-amber-500',
      count: recipes.length,
    },
  ];

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-500" />
                What to Cook?
              </h1>
              <p className="text-sm text-gray-500">Let us help you decide</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {recipes.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <ChefHat className="w-12 h-12 text-orange-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">No Recipes Yet!</h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Add some recipes first, then come back here for inspiration.
            </p>
            <Link href="/">
              <Button size="lg">Go Add Recipes</Button>
            </Link>
          </div>
        ) : !mode ? (
          <>
            {/* Mode Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {modeOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleModeSelect(option.id)}
                  disabled={option.count === 0}
                  className="text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Card hover className="h-full p-5">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${option.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <option.icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-800 mb-1">{option.title}</h3>
                        <p className="text-sm text-gray-500">{option.description}</p>
                        <p className="text-xs text-orange-600 mt-2 font-medium">
                          {option.count} recipe{option.count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </Card>
                </button>
              ))}
            </div>

            {/* Custom Filter */}
            <Card className="p-5">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                Custom Filter
              </h3>
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <Input
                    label="Max cooking time (minutes)"
                    type="number"
                    value={maxTime}
                    onChange={(e) => setMaxTime(e.target.value)}
                    placeholder="e.g., 45"
                  />
                </div>
              </div>
              <Button
                onClick={() => {
                  setMode('custom');
                  applyCustomFilter();
                }}
                className="mt-4"
              >
                Find Recipes
              </Button>
            </Card>
          </>
        ) : mode === 'ingredients' ? (
          <>
            {/* Ingredient Search Mode */}
            <div className="mb-6">
              <button
                onClick={() => {
                  setMode(null);
                  setSuggestions([]);
                  setSelectedIngredients([]);
                  setIngredientMatches([]);
                }}
                className="text-sm text-orange-600 hover:text-orange-700 flex items-center gap-1 mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to options
              </button>

              <Card className="p-5">
                <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-green-500" />
                  What ingredients do you have?
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  Add ingredients and we&apos;ll find recipes you can make
                </p>

                {/* Ingredient Input */}
                <div className="relative mb-4">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Input
                        value={ingredientInput}
                        onChange={(e) => setIngredientInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && ingredientInput.trim()) {
                            addIngredient(ingredientInput);
                          }
                        }}
                        placeholder="Type an ingredient (e.g., chicken, tomatoes...)"
                        icon={<Search className="w-4 h-4" />}
                      />

                      {/* Autocomplete suggestions */}
                      {ingredientSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 z-10 max-h-48 overflow-y-auto">
                          {ingredientSuggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              onClick={() => addIngredient(suggestion)}
                              className="w-full px-4 py-2 text-left hover:bg-orange-50 text-gray-700 first:rounded-t-xl last:rounded-b-xl"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button onClick={() => addIngredient(ingredientInput)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Selected Ingredients */}
                {selectedIngredients.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-500 mb-2">Your ingredients:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedIngredients.map((ingredient) => (
                        <span
                          key={ingredient}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm"
                        >
                          {ingredient}
                          <button
                            onClick={() => removeIngredient(ingredient)}
                            className="hover:text-green-900"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={findRecipesByIngredients}
                  disabled={selectedIngredients.length === 0}
                  className="w-full sm:w-auto"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Find Recipes ({selectedIngredients.length} ingredient{selectedIngredients.length !== 1 ? 's' : ''})
                </Button>
              </Card>
            </div>

            {/* Results */}
            {ingredientMatches.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  Found {ingredientMatches.length} recipe{ingredientMatches.length !== 1 ? 's' : ''} you can make
                </h3>
                <div className="space-y-4">
                  {ingredientMatches.map(({ recipe, matchedIngredients, matchPercentage, missingIngredients }) => (
                    <Card key={recipe.id} className="p-0 overflow-hidden">
                      <div className="flex flex-col sm:flex-row">
                        <div className="sm:w-48 h-32 sm:h-auto relative bg-gradient-to-br from-orange-100 to-pink-100">
                          {recipe.image_url ? (
                            <img
                              src={recipe.image_url}
                              alt={recipe.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ChefHat className="w-12 h-12 text-orange-300" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <Link href={`/recipe/${recipe.id}`}>
                                <h4 className="font-bold text-gray-800 hover:text-orange-600 transition-colors">
                                  {recipe.title}
                                </h4>
                              </Link>
                              {recipe.average_rating && (
                                <p className="text-sm text-gray-500">
                                  Rating: {recipe.average_rating.toFixed(1)} stars
                                </p>
                              )}
                            </div>
                            <Badge
                              variant={matchPercentage === 100 ? 'success' : matchPercentage >= 50 ? 'info' : 'warning'}
                            >
                              {Math.round(matchPercentage)}% match
                            </Badge>
                          </div>

                          <div className="mt-3">
                            <p className="text-xs text-gray-500 mb-1">Matched ingredients:</p>
                            <div className="flex flex-wrap gap-1">
                              {matchedIngredients.map((ing) => (
                                <span
                                  key={ing}
                                  className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full"
                                >
                                  {ing}
                                </span>
                              ))}
                            </div>
                          </div>

                          {missingIngredients.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-500 mb-1">You might need:</p>
                              <div className="flex flex-wrap gap-1">
                                {missingIngredients.map((ing) => (
                                  <span
                                    key={ing}
                                    className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                                  >
                                    {ing}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <Link href={`/recipe/${recipe.id}`}>
                            <Button variant="secondary" size="sm" className="mt-3">
                              View Recipe
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {selectedIngredients.length > 0 && ingredientMatches.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ChefHat className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No matches yet</h3>
                <p className="text-gray-500">
                  Click &quot;Find Recipes&quot; to search, or add more ingredients
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Other Results */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <button
                  onClick={() => {
                    setMode(null);
                    setSuggestions([]);
                  }}
                  className="text-sm text-orange-600 hover:text-orange-700 flex items-center gap-1 mb-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to options
                </button>
                <h2 className="text-xl font-bold text-gray-800">
                  {mode === 'quick' && 'Quick Meals'}
                  {mode === 'favorites' && 'Your Favorites'}
                  {mode === 'forgotten' && 'Forgotten Gems'}
                  {mode === 'random' && 'Your Random Pick!'}
                  {mode === 'custom' && 'Filtered Results'}
                </h2>
                <p className="text-sm text-gray-500">
                  {suggestions.length} recipe{suggestions.length !== 1 ? 's' : ''} found
                </p>
              </div>

              {mode === 'random' && (
                <Button onClick={getRandomRecipe} variant="secondary">
                  <Shuffle className="w-4 h-4 mr-1" />
                  Pick Another
                </Button>
              )}
            </div>

            {suggestions.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {suggestions.map((recipe) => (
                  <RecipeCard key={recipe.id} recipe={recipe} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ChefHat className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No matches</h3>
                <p className="text-gray-500 mb-4">Try adjusting your filters</p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setMode(null);
                    setSuggestions([]);
                  }}
                >
                  Try Different Options
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
