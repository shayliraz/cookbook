'use client';

import { useState } from 'react';
import { X, Mail, Users, Copy, Check, Loader2 } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { useSupabaseStore } from '@/lib/supabase-store';
import { useAuth } from '@/lib/auth-context';
import { DBSharedSpace } from '@/lib/supabase';

interface ShareRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipeId: string;
  recipeTitle: string;
}

export function ShareRecipeModal({ isOpen, onClose, recipeId, recipeTitle }: ShareRecipeModalProps) {
  const [mode, setMode] = useState<'email' | 'space'>('email');
  const [email, setEmail] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const { sharedSpaces, shareRecipeWithUser, shareRecipeToSpace } = useSupabaseStore();

  if (!isOpen) return null;

  const handleShareByEmail = async () => {
    if (!email || !user) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    const success = await shareRecipeWithUser(recipeId, email, canEdit, user.id);
    
    if (success) {
      setSuccess(`Recipe shared with ${email}`);
      setEmail('');
    } else {
      setError('Could not find user with that email');
    }
    setLoading(false);
  };

  const handleShareToSpace = async () => {
    if (!selectedSpace || !user) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    const success = await shareRecipeToSpace(recipeId, selectedSpace, user.id);
    
    if (success) {
      const space = sharedSpaces.find(s => s.id === selectedSpace);
      setSuccess(`Recipe added to "${space?.name}"`);
      setSelectedSpace(null);
    } else {
      setError('Failed to share recipe to space');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-gray-800 mb-2">Share Recipe</h2>
        <p className="text-sm text-gray-500 mb-4">"{recipeTitle}"</p>

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" />
            {success}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Mode tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('email')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
              mode === 'email'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Mail className="w-4 h-4" />
            By Email
          </button>
          <button
            onClick={() => setMode('space')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
              mode === 'space'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Users className="w-4 h-4" />
            To Space
          </button>
        </div>

        {mode === 'email' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recipient's Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="friend@example.com"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={canEdit}
                onChange={(e) => setCanEdit(e.target.checked)}
                className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500"
              />
              <span className="text-sm text-gray-600">Allow them to edit this recipe</span>
            </label>

            <Button
              onClick={handleShareByEmail}
              disabled={!email || loading}
              className="w-full"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Share Recipe'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {sharedSpaces.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No shared spaces yet</p>
                <p className="text-gray-400 text-xs mt-1">
                  Create or join a space to share recipes with groups
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select a Space
                  </label>
                  <div className="space-y-2">
                    {sharedSpaces.map((space) => (
                      <button
                        key={space.id}
                        onClick={() => setSelectedSpace(space.id)}
                        className={`w-full p-3 text-left rounded-lg border transition-colors ${
                          selectedSpace === space.id
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium text-gray-800">{space.name}</div>
                        {space.description && (
                          <div className="text-sm text-gray-500 mt-0.5">{space.description}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleShareToSpace}
                  disabled={!selectedSpace || loading}
                  className="w-full"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Add to Space'}
                </Button>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
