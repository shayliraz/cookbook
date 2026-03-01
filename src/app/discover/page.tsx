'use client';

import { useState, useMemo, useCallback } from 'react';
import { useCookingStore } from '@/lib/store';
import { RecipeCard } from '@/components/RecipeCard';
import { Button, Card, Input, Badge, Modal } from '@/components/ui';
import { analyzeUserPreferences } from '@/lib/preferences';
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
  Globe,
  RefreshCw,
  ExternalLink,
  Loader2,
  AlertCircle,
  BookmarkPlus,
} from 'lucide-react';
import Link from 'next/link';
import { RecipeWithLogs, ExternalRecipe, UserPreferences } from '@/types';

type SuggestionMode = 'quick' | 'favorites' | 'forgotten' | 'random' | 'custom' | 'ingredients' | 'discover';

interface IngredientMatch {
  recipe: RecipeWithLogs;
  matchedIngredients: string[];
  matchPercentage: number;
  missingIngredients: string[];
}

export default function DiscoverPage() {
  const [mode, setMode] = useState<SuggestionMode | null>(null);
  const [suggestions, setSuggestions] = useState<RecipeWithLogs[]>([]);

  // Custom filter state - multiple options
  const [maxTime, setMaxTime] = useState('');
  const [minRating, setMinRating] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [notCookedDays, setNotCookedDays] = useState('');

  // Ingredient search state
  const [ingredientInput, setIngredientInput] = useState('');
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [ingredientMatches, setIngredientMatches] = useState<IngredientMatch[]>([]);

  // External discovery state
  const [externalRecipes, setExternalRecipes] = useState<ExternalRecipe[]>([]);
  const [isLoadingExternal, setIsLoadingExternal] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);
  const [externalOffset, setExternalOffset] = useState(0);
  const [selectedExternal, setSelectedExternal] = useState<ExternalRecipe | null>(null);
  const [isScraping, setIsScraping] = useState(false);
  const [externalSource, setExternalSource] = useState<string | null>(null);

  const getAllRecipesWithLogs = useCookingStore((state) => state.getAllRecipesWithLogs);
  const addRecipe = useCookingStore((state) => state.addRecipe);
  const recipes = getAllRecipesWithLogs();

  // Analyze user preferences from saved recipes
  const userPreferences = useMemo(() => analyzeUserPreferences(recipes), [recipes]);

  // Get all unique ingredients from recipes for autocomplete
  const allIngredients = useMemo(() => {
    const ingredients = new Set<string>();
    recipes.forEach((recipe) => {
      recipe.ingredients.forEach((ing) => {
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

  // Get all cuisines from recipes for filter dropdown
  const allCuisines = useMemo(() => {
    const cuisines = new Set<string>();
    recipes.forEach((r) => {
      if (r.cuisine) cuisines.add(r.cuisine);
    });
    return Array.from(cuisines).sort();
  }, [recipes]);

  // Get all tags from recipes for filter dropdown
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    recipes.forEach((r) => {
      r.tags.forEach((t) => tags.add(t));
    });
    return Array.from(tags).sort();
  }, [recipes]);

  const getRandomRecipe = () => {
    if (recipes.length === 0) return;
    const random = recipes[Math.floor(Math.random() * recipes.length)];
    setSuggestions([random]);
    setMode('random');
  };

  // Fetch external recipes
  const fetchExternalRecipes = useCallback(async (newOffset = 0) => {
    setIsLoadingExternal(true);
    setExternalError(null);

    try {
      const response = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: selectedIngredients.length > 0 ? selectedIngredients : [],
          preferences: userPreferences,
          count: 3,
          offset: newOffset,
        }),
      });

      const data = await response.json();

      if (data.error && data.recipes?.length === 0) {
        setExternalError(data.error);
        setExternalRecipes([]);
      } else {
        setExternalRecipes(data.recipes || []);
        setExternalSource(data.source);
        setExternalOffset(newOffset);
      }
    } catch (error) {
      setExternalError('Failed to fetch recipe suggestions. Please try again.');
      console.error('External fetch error:', error);
    } finally {
      setIsLoadingExternal(false);
    }
  }, [selectedIngredients, userPreferences]);

  // Handle scraping and saving external recipe
  const handleSaveExternalRecipe = async (recipe: ExternalRecipe) => {
    setIsScraping(true);
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: recipe.source_url }),
      });

      const data = await response.json();

      if (data.error) {
        alert(`Failed to scrape recipe: ${data.error}`);
        return;
      }

      // Add the scraped recipe to store
      addRecipe({
        title: data.title || recipe.title,
        description: data.description,
        source_url: recipe.source_url,
        image_url: data.image_url || recipe.image_url,
        ingredients: data.ingredients || [],
        instructions: data.instructions || [],
        prep_time: data.prep_time,
        cook_time: data.cook_time,
        servings: data.servings,
        cuisine: data.cuisine || recipe.cuisines?.[0] || null,
        tags: data.tags || recipe.dish_types || [],
        notes: null,
        recipe_group: null,
      });

      alert(`"${data.title || recipe.title}" has been added to your collection!`);
      setSelectedExternal(null);

      // Remove the saved recipe from suggestions
      setExternalRecipes(prev => prev.filter(r => r.id !== recipe.id));
    } catch (error) {
      alert('Failed to save recipe. Please try again.');
      console.error('Save error:', error);
    } finally {
      setIsScraping(false);
    }
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
        setSelectedIngredients([]);
        setIngredientMatches([]);
        setSuggestions([]);
        break;
      case 'discover':
        setExternalRecipes([]);
        setExternalOffset(0);
        fetchExternalRecipes(0);
        break;
      case 'custom':
        setSuggestions([]);
        break;
    }
  };

  const applyCustomFilter = () => {
    let filtered = [...recipes];

    // Filter by max cooking time
    if (maxTime) {
      const time = parseInt(maxTime);
      filtered = filtered.filter((r) => {
        const totalTime = (r.prep_time || 0) + (r.cook_time || 0);
        return totalTime === 0 || totalTime <= time;
      });
    }

    // Filter by minimum rating
    if (minRating) {
      const rating = parseFloat(minRating);
      filtered = filtered.filter((r) => (r.average_rating || 0) >= rating);
    }

    // Filter by cuisine
    if (selectedCuisine) {
      filtered = filtered.filter((r) =>
        r.cuisine?.toLowerCase().includes(selectedCuisine.toLowerCase())
      );
    }

    // Filter by category/tag
    if (selectedCategory) {
      filtered = filtered.filter((r) =>
        r.tags.some((t) => t.toLowerCase().includes(selectedCategory.toLowerCase()))
      );
    }

    // Filter by not cooked in X days
    if (notCookedDays) {
      const days = parseInt(notCookedDays);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      filtered = filtered.filter((r) => {
        if (!r.last_cooked) return true;
        return new Date(r.last_cooked) < cutoffDate;
      });
    }

    // Sort by rating (highest first)
    filtered.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));

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

      selectedIngredients.forEach((selected) => {
        const found = recipeIngredients.some((recipeIng) =>
          recipeIng.includes(selected) || selected.includes(recipeIng.split(/[,()]/)[0].trim())
        );
        if (found) {
          matchedIngredients.push(selected);
        }
      });

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
        missingIngredients: missingIngredients.slice(0, 5),
      };
    });

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
      id: 'discover' as SuggestionMode,
      icon: Globe,
      title: 'Discover New Recipes',
      description: 'Find trending recipes online',
      color: 'from-indigo-500 to-purple-500',
      count: null,
      highlight: true,
    },
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
      description: 'Random pick from collection',
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
        {!mode ? (
          <>
            {/* Mode Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {modeOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleModeSelect(option.id)}
                  disabled={option.count === 0}
                  className={`text-left group disabled:opacity-50 disabled:cursor-not-allowed ${
                    option.highlight ? 'sm:col-span-2' : ''
                  }`}
                >
                  <Card hover className={`h-full p-5 ${option.highlight ? 'ring-2 ring-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50' : ''}`}>
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${option.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <option.icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-800 mb-1">{option.title}</h3>
                        <p className="text-sm text-gray-500">{option.description}</p>
                        {option.count !== null && (
                          <p className="text-xs text-orange-600 mt-2 font-medium">
                            {option.count} recipe{option.count !== 1 ? 's' : ''}
                          </p>
                        )}
                        {option.highlight && (
                          <p className="text-xs text-indigo-600 mt-2 font-medium">
                            Powered by Spoonacular
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                </button>
              ))}
            </div>

            {/* Your Preferences Summary */}
            {recipes.length > 0 && (
              <Card className="p-5 mb-8 bg-gradient-to-r from-orange-50 to-amber-50">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <ChefHat className="w-5 h-5 text-orange-500" />
                  Your Cooking Profile
                </h3>
                <div className="space-y-2 text-sm">
                  {userPreferences.top_cuisines.length > 0 && (
                    <p>
                      <span className="text-gray-500">Favorite cuisines:</span>{' '}
                      <span className="text-gray-800 font-medium">
                        {userPreferences.top_cuisines.slice(0, 3).join(', ')}
                      </span>
                    </p>
                  )}
                  <p>
                    <span className="text-gray-500">Average cook time:</span>{' '}
                    <span className="text-gray-800 font-medium">
                      ~{userPreferences.avg_cook_time} minutes
                    </span>
                  </p>
                  {userPreferences.common_ingredients.length > 0 && (
                    <p>
                      <span className="text-gray-500">Go-to ingredients:</span>{' '}
                      <span className="text-gray-800 font-medium">
                        {userPreferences.common_ingredients.slice(0, 5).join(', ')}
                      </span>
                    </p>
                  )}
                </div>
              </Card>
            )}

            {/* Custom Filter */}
            <Card className="p-5">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                Custom Filter
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Combine multiple filters to find the perfect recipe
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Input
                    label="Max cooking time (minutes)"
                    type="number"
                    value={maxTime}
                    onChange={(e) => setMaxTime(e.target.value)}
                    placeholder="e.g., 45"
                  />
                </div>
                <div>
                  <Input
                    label="Minimum rating"
                    type="number"
                    min="1"
                    max="5"
                    step="0.5"
                    value={minRating}
                    onChange={(e) => setMinRating(e.target.value)}
                    placeholder="e.g., 4"
                  />
                </div>
                <div>
                  <Input
                    label="Not cooked in X days"
                    type="number"
                    value={notCookedDays}
                    onChange={(e) => setNotCookedDays(e.target.value)}
                    placeholder="e.g., 30"
                  />
                </div>
                {allCuisines.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cuisine
                    </label>
                    <select
                      value={selectedCuisine}
                      onChange={(e) => setSelectedCuisine(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="">All cuisines</option>
                      {allCuisines.map((cuisine) => (
                        <option key={cuisine} value={cuisine}>
                          {cuisine}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {allTags.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category / Tag
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="">All categories</option>
                      {allTags.map((tag) => (
                        <option key={tag} value={tag}>
                          {tag}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-4">
                <Button
                  onClick={() => {
                    setMode('custom');
                    applyCustomFilter();
                  }}
                >
                  Find Recipes
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setMaxTime('');
                    setMinRating('');
                    setSelectedCuisine('');
                    setSelectedCategory('');
                    setNotCookedDays('');
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            </Card>
          </>
        ) : mode === 'discover' ? (
          <>
            {/* Discover New Recipes Mode */}
            <div className="mb-6">
              <button
                onClick={() => {
                  setMode(null);
                  setExternalRecipes([]);
                  setSelectedIngredients([]);
                }}
                className="text-sm text-orange-600 hover:text-orange-700 flex items-center gap-1 mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to options
              </button>

              <Card className="p-5 mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-indigo-500" />
                  Discover New Recipes
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  Find trending recipes from around the web based on your cooking style
                  {externalSource && (
                    <span className="text-indigo-600"> (via {externalSource})</span>
                  )}
                </p>

                {/* Optional: Add ingredients to narrow search */}
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Optional: Add ingredients to find matching recipes
                  </p>
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
                        placeholder="e.g., chicken, tomatoes..."
                        icon={<Search className="w-4 h-4" />}
                      />
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
                    <Button onClick={() => addIngredient(ingredientInput)} variant="secondary">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {selectedIngredients.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
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
                      <Button
                        size="sm"
                        onClick={() => fetchExternalRecipes(0)}
                        disabled={isLoadingExternal}
                      >
                        {isLoadingExternal ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                        <span className="ml-1">Search</span>
                      </Button>
                    </div>
                  )}
                </div>
              </Card>

              {/* Loading State */}
              {isLoadingExternal && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  <span className="ml-3 text-gray-600">Finding delicious recipes...</span>
                </div>
              )}

              {/* Error State */}
              {externalError && !isLoadingExternal && (
                <Card className="p-6 text-center bg-red-50 border-red-100">
                  <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                  <p className="text-red-700 mb-4">{externalError}</p>
                  <Button onClick={() => fetchExternalRecipes(0)} variant="secondary">
                    Try Again
                  </Button>
                </Card>
              )}

              {/* External Recipe Cards */}
              {!isLoadingExternal && externalRecipes.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800">
                      Recipes You Might Like
                    </h3>
                    <Button
                      onClick={() => fetchExternalRecipes(externalOffset + 3)}
                      variant="secondary"
                      size="sm"
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Show Different
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {externalRecipes.map((recipe) => (
                      <Card key={recipe.id} hover className="overflow-hidden">
                        <div className="relative h-48 bg-gradient-to-br from-indigo-100 to-purple-100">
                          {recipe.image_url ? (
                            <img
                              src={recipe.image_url}
                              alt={recipe.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ChefHat className="w-16 h-16 text-indigo-300" />
                            </div>
                          )}
                          {/* Popularity indicators */}
                          <div className="absolute top-3 right-3 flex flex-col gap-1">
                            {recipe.spoonacular_score && (
                              <div className="bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full">
                                <span className="text-xs font-semibold text-indigo-600">
                                  Score: {Math.round(recipe.spoonacular_score)}
                                </span>
                              </div>
                            )}
                            {recipe.aggregate_likes && recipe.aggregate_likes > 0 && (
                              <div className="bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
                                <Heart className="w-3 h-3 text-pink-500 fill-pink-500" />
                                <span className="text-xs font-semibold text-pink-600">
                                  {recipe.aggregate_likes > 1000
                                    ? `${(recipe.aggregate_likes / 1000).toFixed(1)}k`
                                    : recipe.aggregate_likes}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="p-4">
                          <h4 className="font-bold text-gray-800 line-clamp-2 mb-2">
                            {recipe.title}
                          </h4>

                          <div className="flex flex-wrap gap-1 mb-3">
                            {recipe.ready_in_minutes && (
                              <Badge variant="info" size="sm">
                                <Clock className="w-3 h-3 mr-1" />
                                {recipe.ready_in_minutes} min
                              </Badge>
                            )}
                            {recipe.cuisines.slice(0, 1).map((cuisine) => (
                              <Badge key={cuisine} variant="success" size="sm">
                                {cuisine}
                              </Badge>
                            ))}
                          </div>

                          {/* Ingredient match info */}
                          {recipe.used_ingredients.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs text-gray-500 mb-1">You have:</p>
                              <div className="flex flex-wrap gap-1">
                                {recipe.used_ingredients.slice(0, 3).map((ing) => (
                                  <span
                                    key={ing}
                                    className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full"
                                  >
                                    {ing}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {recipe.missed_ingredients.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs text-gray-500 mb-1">You need:</p>
                              <div className="flex flex-wrap gap-1">
                                {recipe.missed_ingredients.slice(0, 3).map((ing) => (
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

                          <p className="text-xs text-gray-400 mb-3">
                            From: {recipe.source_name}
                          </p>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => setSelectedExternal(recipe)}
                            >
                              <BookmarkPlus className="w-4 h-4 mr-1" />
                              Save
                            </Button>
                            <a
                              href={recipe.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Refresh Button */}
                  <div className="mt-6 text-center">
                    <Button
                      onClick={() => fetchExternalRecipes(externalOffset + 3)}
                      variant="secondary"
                      size="lg"
                    >
                      <RefreshCw className="w-5 h-5 mr-2" />
                      Show More Recipes
                    </Button>
                  </div>
                </div>
              )}

              {/* No results */}
              {!isLoadingExternal && !externalError && externalRecipes.length === 0 && (
                <Card className="p-8 text-center">
                  <Globe className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-4">
                    Click search or wait for suggestions to load
                  </p>
                </Card>
              )}
            </div>

            {/* Save Recipe Modal */}
            <Modal
              isOpen={!!selectedExternal}
              onClose={() => setSelectedExternal(null)}
              title="Save Recipe to Collection"
            >
              {selectedExternal && (
                <div>
                  {selectedExternal.image_url && (
                    <img
                      src={selectedExternal.image_url}
                      alt={selectedExternal.title}
                      className="w-full h-48 object-cover rounded-xl mb-4"
                    />
                  )}
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    {selectedExternal.title}
                  </h3>
                  {selectedExternal.summary && (
                    <p className="text-sm text-gray-600 mb-4">
                      {selectedExternal.summary}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {selectedExternal.ready_in_minutes && (
                      <Badge variant="info">
                        <Clock className="w-3 h-3 mr-1" />
                        {selectedExternal.ready_in_minutes} min
                      </Badge>
                    )}
                    {selectedExternal.servings && (
                      <Badge variant="default">
                        {selectedExternal.servings} servings
                      </Badge>
                    )}
                    {selectedExternal.cuisines.map((c) => (
                      <Badge key={c} variant="success">{c}</Badge>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    This will scrape the full recipe from{' '}
                    <span className="font-medium">{selectedExternal.source_name}</span>{' '}
                    and add it to your collection.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleSaveExternalRecipe(selectedExternal)}
                      disabled={isScraping}
                      className="flex-1"
                    >
                      {isScraping ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <BookmarkPlus className="w-4 h-4 mr-2" />
                          Save to Collection
                        </>
                      )}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setSelectedExternal(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </Modal>
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
