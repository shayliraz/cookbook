'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCookingStore } from '@/lib/store';
import { Button, Badge, StarRating, Card, useTextDirection } from '@/components/ui';
import { CookingLogModal } from '@/components/CookingLogModal';
import {
  ArrowLeft,
  Clock,
  Users,
  ExternalLink,
  ChefHat,
  Calendar,
  Trash2,
  Share2,
  Plus,
  Camera,
} from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';
import { containsRTL } from '@/lib/rtl';

export default function RecipePage() {
  const params = useParams();
  const router = useRouter();
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ingredients' | 'instructions'>('ingredients');

  const getRecipeWithLogs = useCookingStore((state) => state.getRecipeWithLogs);
  const deleteRecipe = useCookingStore((state) => state.deleteRecipe);

  const recipe = getRecipeWithLogs(params.id as string);

  if (!recipe) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ChefHat className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Recipe not found</h2>
          <Link href="/">
            <Button variant="secondary">Go back home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);

  // Check if content is RTL (Hebrew/Arabic)
  const titleIsRTL = containsRTL(recipe.title);
  const hasRTLContent = titleIsRTL ||
    recipe.ingredients.some(i => containsRTL(i)) ||
    recipe.instructions.some(i => containsRTL(i));

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this recipe? This cannot be undone.')) {
      deleteRecipe(recipe.id);
      router.push('/');
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: recipe.title,
      text: `Check out this recipe: ${recipe.title}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or error
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Hero Image */}
      <div className="relative h-64 sm:h-80 bg-gradient-to-br from-orange-100 to-pink-100">
        {recipe.image_url ? (
          <Image
            src={recipe.image_url}
            alt={recipe.title}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ChefHat className="w-24 h-24 text-orange-300" />
          </div>
        )}

        {/* Back button */}
        <div className="absolute top-4 left-4 right-4 flex justify-between">
          <Link href="/">
            <button className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
          </Link>

          <div className="flex gap-2">
            <button
              onClick={handleShare}
              className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors"
            >
              <Share2 className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 -mt-8 relative">
        <Card className="mb-6">
          <div className="p-6">
            {/* Title and Rating */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h1
                  className="text-2xl font-bold text-gray-800 mb-2"
                  dir={titleIsRTL ? 'rtl' : 'ltr'}
                  style={{
                    direction: titleIsRTL ? 'rtl' : 'ltr',
                    textAlign: titleIsRTL ? 'right' : 'left',
                  }}
                >
                  {recipe.title}
                </h1>
                {recipe.average_rating && (
                  <div className="flex items-center gap-2">
                    <StarRating rating={recipe.average_rating} size="md" readonly />
                    <span className="text-gray-500">
                      ({recipe.average_rating.toFixed(1)} from {recipe.times_cooked} cook{recipe.times_cooked !== 1 ? 's' : ''})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {recipe.description && (
              <p
                className="text-gray-600 mb-4"
                dir={containsRTL(recipe.description) ? 'rtl' : 'ltr'}
                style={{
                  direction: containsRTL(recipe.description) ? 'rtl' : 'ltr',
                  textAlign: containsRTL(recipe.description) ? 'right' : 'left',
                }}
              >
                {recipe.description}
              </p>
            )}

            {/* Meta badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {totalTime > 0 && (
                <Badge variant="info">
                  <Clock className="w-3 h-3 mr-1" />
                  {totalTime} min total
                </Badge>
              )}
              {recipe.prep_time && (
                <Badge variant="default">
                  {recipe.prep_time} min prep
                </Badge>
              )}
              {recipe.cook_time && (
                <Badge variant="default">
                  {recipe.cook_time} min cook
                </Badge>
              )}
              {recipe.servings && (
                <Badge variant="default">
                  <Users className="w-3 h-3 mr-1" />
                  {recipe.servings} servings
                </Badge>
              )}
              {recipe.cuisine && (
                <Badge variant="success">
                  {recipe.cuisine}
                </Badge>
              )}
            </div>

            {/* Tags */}
            {recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {recipe.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-orange-50 text-orange-600 text-sm rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Source link */}
            {recipe.source_url && (
              <a
                href={recipe.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700"
              >
                <ExternalLink className="w-4 h-4" />
                View original recipe
              </a>
            )}
          </div>
        </Card>

        {/* Recipe Tabs */}
        <Card className="mb-6">
          <div className="border-b border-gray-100">
            <div className="flex">
              <button
                onClick={() => setActiveTab('ingredients')}
                className={`flex-1 py-4 text-center font-semibold transition-colors ${
                  activeTab === 'ingredients'
                    ? 'text-orange-600 border-b-2 border-orange-500'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Ingredients ({recipe.ingredients.length})
              </button>
              <button
                onClick={() => setActiveTab('instructions')}
                className={`flex-1 py-4 text-center font-semibold transition-colors ${
                  activeTab === 'instructions'
                    ? 'text-orange-600 border-b-2 border-orange-500'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Instructions ({recipe.instructions.length})
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'ingredients' ? (
              <ul className="space-y-3">
                {recipe.ingredients.map((ingredient, index) => {
                  const ingredientIsRTL = containsRTL(ingredient);
                  return (
                    <li
                      key={index}
                      className="flex items-start gap-3 ingredient-item"
                      dir={ingredientIsRTL ? 'rtl' : 'ltr'}
                      style={{
                        direction: ingredientIsRTL ? 'rtl' : 'ltr',
                        textAlign: ingredientIsRTL ? 'right' : 'left',
                        flexDirection: ingredientIsRTL ? 'row-reverse' : 'row',
                      }}
                    >
                      <span className="flex-shrink-0 w-2 h-2 mt-2 bg-orange-400 rounded-full" />
                      <span className="text-gray-700 flex-1">{ingredient}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ol className="space-y-4">
                {recipe.instructions.map((instruction, index) => {
                  const instructionIsRTL = containsRTL(instruction);
                  return (
                    <li
                      key={index}
                      className="flex gap-4 instruction-item"
                      dir={instructionIsRTL ? 'rtl' : 'ltr'}
                      style={{
                        direction: instructionIsRTL ? 'rtl' : 'ltr',
                        textAlign: instructionIsRTL ? 'right' : 'left',
                        flexDirection: instructionIsRTL ? 'row-reverse' : 'row',
                      }}
                    >
                      <span className="flex-shrink-0 w-8 h-8 bg-orange-100 text-orange-600 font-bold rounded-full flex items-center justify-center">
                        {index + 1}
                      </span>
                      <p className="text-gray-700 pt-1 flex-1">{instruction}</p>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </Card>

        {/* Cooking History */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Cooking History</h2>
            <Button onClick={() => setIsLogModalOpen(true)} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Log Cook
            </Button>
          </div>

          {recipe.cooking_logs.length > 0 ? (
            <div className="space-y-4">
              {recipe.cooking_logs.map((log) => (
                <Card key={log.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(log.cooked_at), 'MMMM d, yyyy')}
                      </p>
                      <StarRating rating={log.rating} size="sm" readonly />
                    </div>
                    <Badge variant={log.would_make_again ? 'success' : 'warning'}>
                      {log.would_make_again ? '👍 Would make again' : '🤔 Maybe not'}
                    </Badge>
                  </div>

                  {log.notes && (
                    <p className="text-gray-700 mb-2">{log.notes}</p>
                  )}

                  {log.changes_made && (
                    <div className="p-3 bg-orange-50 rounded-xl mb-2">
                      <p className="text-sm font-semibold text-orange-700 mb-1">Changes made:</p>
                      <p className="text-sm text-orange-600">{log.changes_made}</p>
                    </div>
                  )}

                  {log.who_was_there.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                      <Users className="w-4 h-4" />
                      Cooked with: {log.who_was_there.join(', ')}
                    </div>
                  )}

                  {log.photo_urls.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {log.photo_urls.map((photo, idx) => (
                        <div key={idx} className="aspect-square rounded-xl overflow-hidden">
                          <img
                            src={photo}
                            alt={`Cook ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Camera className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No cooking logs yet. Make this dish and record your experience!</p>
              <Button variant="secondary" onClick={() => setIsLogModalOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Log Your First Cook
              </Button>
            </Card>
          )}
        </div>

        {/* Actions */}
        <Card className="p-4">
          <div className="flex gap-3">
            <Button variant="danger" onClick={handleDelete} className="flex-1">
              <Trash2 className="w-4 h-4 mr-1" />
              Delete Recipe
            </Button>
          </div>
        </Card>
      </div>

      {/* Cooking Log Modal */}
      <CookingLogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        recipeId={recipe.id}
        recipeName={recipe.title}
      />
    </div>
  );
}
