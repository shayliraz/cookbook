'use client';

import { RecipeWithLogs } from '@/types';
import { Card, Badge, StarRating } from './ui';
import { Clock, Users, Calendar, ChefHat } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';

interface RecipeCardProps {
  recipe: RecipeWithLogs;
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);

  return (
    <Link href={`/recipe/${recipe.id}`}>
      <Card hover className="h-full flex flex-col">
        {/* Image */}
        <div className="relative h-48 bg-gradient-to-br from-orange-100 to-pink-100">
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
              <ChefHat className="w-16 h-16 text-orange-300" />
            </div>
          )}

          {/* Times cooked badge */}
          {recipe.times_cooked > 0 && (
            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
              <span className="text-sm font-semibold text-orange-600">
                🍳 {recipe.times_cooked}x
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col">
          <h3 className="font-bold text-lg text-gray-800 line-clamp-2 mb-2">
            {recipe.title}
          </h3>

          {/* Rating */}
          {recipe.average_rating && (
            <div className="flex items-center gap-2 mb-3">
              <StarRating rating={recipe.average_rating} size="sm" readonly />
              <span className="text-sm text-gray-500">
                ({recipe.average_rating.toFixed(1)})
              </span>
            </div>
          )}

          {/* Meta info */}
          <div className="flex flex-wrap gap-2 mb-3">
            {totalTime > 0 && (
              <Badge variant="info" size="sm">
                <Clock className="w-3 h-3 mr-1" />
                {totalTime} min
              </Badge>
            )}
            {recipe.servings && (
              <Badge variant="default" size="sm">
                <Users className="w-3 h-3 mr-1" />
                {recipe.servings}
              </Badge>
            )}
          </div>

          {/* Tags */}
          {recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {recipe.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-orange-50 text-orange-600 text-xs rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Last cooked */}
          <div className="mt-auto pt-3 border-t border-gray-100">
            {recipe.last_cooked ? (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Last cooked {formatDistanceToNow(new Date(recipe.last_cooked), { addSuffix: true })}
              </p>
            ) : (
              <p className="text-xs text-gray-400 italic">Never cooked yet</p>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
