'use client';

import { RecipeWithLogs } from '@/types';
import { Badge, StarRating, useTextDirection } from './ui';
import { Clock, Users, Calendar, ChefHat, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';

interface RecipeListItemProps {
  recipe: RecipeWithLogs;
}

export function RecipeListItem({ recipe }: RecipeListItemProps) {
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);
  const { isRTL } = useTextDirection(recipe.title);

  return (
    <Link href={`/recipe/${recipe.id}`}>
      <div className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-orange-200 transition-all">
        {/* Image */}
        <div className="relative w-20 h-20 flex-shrink-0 bg-gradient-to-br from-orange-100 to-pink-100 rounded-xl overflow-hidden">
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
              <ChefHat className="w-8 h-8 text-orange-300" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3
            className="font-bold text-gray-800 truncate"
            dir={isRTL ? 'rtl' : 'ltr'}
            style={{
              direction: isRTL ? 'rtl' : 'ltr',
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {recipe.title}
          </h3>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500">
            {recipe.average_rating && (
              <div className="flex items-center gap-1">
                <StarRating rating={recipe.average_rating} size="sm" readonly />
                <span>({recipe.average_rating.toFixed(1)})</span>
              </div>
            )}
            {totalTime > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {totalTime}m
              </span>
            )}
            {recipe.times_cooked > 0 && (
              <span className="text-orange-600 font-medium">
                Cooked {recipe.times_cooked}x
              </span>
            )}
          </div>

          {/* Tags */}
          {recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {recipe.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-orange-50 text-orange-600 text-xs rounded-full"
                >
                  {tag}
                </span>
              ))}
              {recipe.tags.length > 3 && (
                <span className="text-xs text-gray-400">+{recipe.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>

        {/* Right side info */}
        <div className="flex-shrink-0 text-right">
          {recipe.last_cooked ? (
            <p className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(recipe.last_cooked), { addSuffix: true })}
            </p>
          ) : (
            <p className="text-xs text-gray-400 italic">Never cooked</p>
          )}
          <ChevronRight className="w-5 h-5 text-gray-300 mt-1 ml-auto" />
        </div>
      </div>
    </Link>
  );
}
