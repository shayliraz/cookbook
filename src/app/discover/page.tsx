'use client';

import { useState, useMemo } from 'react';
import { useCookingStore } from '@/lib/store';
import { RecipeCard } from '@/components/RecipeCard';
import { Button, Card, Input } from '@/components/ui';
import {
  ArrowLeft,
  Shuffle,
  Clock,
  Star,
  Calendar,
  Sparkles,
  ChefHat,
  Flame,
  Heart,
} from 'lucide-react';
import Link from 'next/link';
import { RecipeWithLogs } from '@/types';

type SuggestionMode = 'quick' | 'favorites' | 'forgotten' | 'random' | 'custom';

export default function DiscoverPage() {
  const [mode, setMode] = useState<SuggestionMode | null>(null);
  const [maxTime, setMaxTime] = useState('');
  const [suggestions, setSuggestions] = useState<RecipeWithLogs[]>([]);

  const getAllRecipesWithLogs = useCookingStore((state) => state.getAllRecipesWithLogs);
  const recipes = getAllRecipesWithLogs();

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

  const modeOptions = [
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
        ) : (
          <>
            {/* Results */}
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
