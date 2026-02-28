'use client';

import { useState, useMemo, useEffect } from 'react';
import { useCookingStore } from '@/lib/store';
import { useSupabaseStore } from '@/lib/supabase-store';
import { useAuth } from '@/lib/auth-context';
import { RecipeCard } from '@/components/RecipeCard';
import { AddRecipeModal } from '@/components/AddRecipeModal';
import { AuthModal } from '@/components/auth/AuthModal';
import { Button, Input } from '@/components/ui';
import { Plus, Search, ChefHat, Sparkles, Filter, X, User, LogOut, Users, Loader2 } from 'lucide-react';
import Link from 'next/link';

type SortOption = 'recent' | 'rating' | 'last_cooked' | 'times_cooked';
type FilterOption = {
  cuisine?: string;
  minRating?: number;
  tags?: string[];
};

export default function Home() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [filters, setFilters] = useState<FilterOption>({});
  const [showFilters, setShowFilters] = useState(false);

  const { user, profile, loading: authLoading, signOut } = useAuth();

  // Use Supabase store when logged in, localStorage store when not
  const localStore = useCookingStore();
  const supabaseStore = useSupabaseStore();

  // Initialize Supabase store when user logs in
  useEffect(() => {
    if (user && !supabaseStore.initialized && !supabaseStore.loading) {
      supabaseStore.initialize(user.id);
    }
    if (!user && supabaseStore.initialized) {
      supabaseStore.reset();
    }
  }, [user, supabaseStore]);

  // Get recipes based on auth state
  const recipes = useMemo(() => {
    if (user && supabaseStore.initialized) {
      return supabaseStore.getAllRecipesWithLogs();
    }
    return localStore.getAllRecipesWithLogs();
  }, [user, supabaseStore.initialized, supabaseStore.recipes, supabaseStore.cookingLogs, localStore]);

  // Get unique cuisines and tags for filter options
  const allCuisines = useMemo(() => {
    const cuisines = recipes.map((r) => r.cuisine).filter(Boolean) as string[];
    return [...new Set(cuisines)];
  }, [recipes]);

  const allTags = useMemo(() => {
    const tags = recipes.flatMap((r) => r.tags);
    return [...new Set(tags)];
  }, [recipes]);

  // Filter and sort recipes
  const filteredRecipes = useMemo(() => {
    let result = [...recipes];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          r.description?.toLowerCase().includes(query) ||
          r.tags.some((t) => t.toLowerCase().includes(query)) ||
          r.ingredients.some((i) => i.toLowerCase().includes(query))
      );
    }

    // Cuisine filter
    if (filters.cuisine) {
      result = result.filter((r) => r.cuisine?.toLowerCase() === filters.cuisine?.toLowerCase());
    }

    // Rating filter
    if (filters.minRating) {
      result = result.filter((r) => (r.average_rating || 0) >= filters.minRating!);
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      result = result.filter((r) =>
        filters.tags!.every((tag) => r.tags.map((t) => t.toLowerCase()).includes(tag.toLowerCase()))
      );
    }

    // Sort
    switch (sortBy) {
      case 'rating':
        result.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
        break;
      case 'last_cooked':
        result.sort((a, b) => {
          if (!a.last_cooked) return 1;
          if (!b.last_cooked) return -1;
          return new Date(b.last_cooked).getTime() - new Date(a.last_cooked).getTime();
        });
        break;
      case 'times_cooked':
        result.sort((a, b) => b.times_cooked - a.times_cooked);
        break;
      case 'recent':
      default:
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    return result;
  }, [recipes, searchQuery, sortBy, filters]);

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
  };

  const hasActiveFilters = searchQuery || filters.cuisine || filters.minRating || filters.tags?.length;

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-pink-500 rounded-2xl flex items-center justify-center">
                <ChefHat className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold gradient-text">Cookbook</h1>
                <p className="text-xs text-gray-500">Your Cooking Journal</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/discover">
                <Button variant="ghost" size="sm">
                  <Sparkles className="w-4 h-4 mr-1" />
                  Discover
                </Button>
              </Link>
              {user && (
                <Link href="/spaces">
                  <Button variant="ghost" size="sm">
                    <Users className="w-4 h-4 mr-1" />
                    Spaces
                  </Button>
                </Link>
              )}
              <Button onClick={() => setIsAddModalOpen(true)} size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>

              {/* Auth UI */}
              {authLoading ? (
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              ) : user ? (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-semibold hover:bg-orange-200 transition-colors"
                  >
                    {profile?.display_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                  </button>
                  {showUserMenu && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="font-medium text-gray-800 truncate">{profile?.display_name || 'User'}</p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                      <button
                        onClick={() => {
                          signOut();
                          setShowUserMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setIsAuthModalOpen(true)}>
                  <User className="w-4 h-4 mr-1" />
                  Sign In
                </Button>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search recipes, ingredients..."
                icon={<Search className="w-4 h-4" />}
              />
            </div>
            <Button
              variant={showFilters ? 'primary' : 'secondary'}
              onClick={() => setShowFilters(!showFilters)}
              className="px-3"
            >
              <Filter className="w-4 h-4" />
            </Button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-2xl animate-slideDown">
              <div className="flex flex-wrap gap-4">
                {/* Sort */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Sort by</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400"
                  >
                    <option value="recent">Recently Added</option>
                    <option value="rating">Highest Rated</option>
                    <option value="last_cooked">Last Cooked</option>
                    <option value="times_cooked">Most Cooked</option>
                  </select>
                </div>

                {/* Cuisine */}
                {allCuisines.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Cuisine</label>
                    <select
                      value={filters.cuisine || ''}
                      onChange={(e) => setFilters({ ...filters, cuisine: e.target.value || undefined })}
                      className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400"
                    >
                      <option value="">All cuisines</option>
                      {allCuisines.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Min Rating */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Min Rating</label>
                  <select
                    value={filters.minRating || ''}
                    onChange={(e) => setFilters({ ...filters, minRating: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400"
                  >
                    <option value="">Any rating</option>
                    <option value="3">3+ stars</option>
                    <option value="4">4+ stars</option>
                    <option value="5">5 stars only</option>
                  </select>
                </div>
              </div>

              {/* Tags */}
              {allTags.length > 0 && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-500 mb-2">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => {
                          const currentTags = filters.tags || [];
                          if (currentTags.includes(tag)) {
                            setFilters({ ...filters, tags: currentTags.filter((t) => t !== tag) });
                          } else {
                            setFilters({ ...filters, tags: [...currentTags, tag] });
                          }
                        }}
                        className={`px-3 py-1 rounded-full text-sm transition-all ${
                          filters.tags?.includes(tag)
                            ? 'bg-orange-500 text-white'
                            : 'bg-white text-gray-600 hover:bg-orange-50'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-3 text-sm text-orange-600 hover:text-orange-700 flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Stats */}
        {recipes.length > 0 && (
          <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
            <div className="flex-shrink-0 px-4 py-3 bg-white rounded-2xl shadow-sm border border-gray-100">
              <p className="text-2xl font-bold text-orange-500">{recipes.length}</p>
              <p className="text-xs text-gray-500">Recipes</p>
            </div>
            <div className="flex-shrink-0 px-4 py-3 bg-white rounded-2xl shadow-sm border border-gray-100">
              <p className="text-2xl font-bold text-pink-500">
                {recipes.reduce((acc, r) => acc + r.times_cooked, 0)}
              </p>
              <p className="text-xs text-gray-500">Times Cooked</p>
            </div>
            <div className="flex-shrink-0 px-4 py-3 bg-white rounded-2xl shadow-sm border border-gray-100">
              <p className="text-2xl font-bold text-purple-500">
                {recipes.filter((r) => (r.average_rating || 0) >= 4).length}
              </p>
              <p className="text-xs text-gray-500">Favorites</p>
            </div>
          </div>
        )}

        {/* Recipe Grid */}
        {filteredRecipes.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        ) : recipes.length > 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No recipes found</h3>
            <p className="text-gray-500 mb-4">Try adjusting your search or filters</p>
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce-soft">
              <ChefHat className="w-12 h-12 text-orange-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to Your Cookbook!</h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Start building your personal recipe collection. Import recipes from the web or add your own favorites.
            </p>
            <Button onClick={() => setIsAddModalOpen(true)} size="lg">
              <Plus className="w-5 h-5 mr-2" />
              Add Your First Recipe
            </Button>
          </div>
        )}
      </main>

      {/* Add Recipe Modal */}
      <AddRecipeModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}
