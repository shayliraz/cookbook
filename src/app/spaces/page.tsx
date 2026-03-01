'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, Plus, Copy, Check, LogOut, Settings, 
  ChefHat, Loader2, ArrowLeft
} from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useSupabaseStore } from '@/lib/supabase-store';
import { supabase, DBSharedSpace, DBRecipe } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';

export default function SpacesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const {
    sharedSpaces,
    createSharedSpace,
    joinSpaceByCode,
    leaveSpace,
    fetchSharedSpaces,
    initialized: supabaseInitialized,
    loading: supabaseLoading
  } = useSupabaseStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<DBSharedSpace | null>(null);
  const [spaceRecipes, setSpaceRecipes] = useState<DBRecipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [loadingSpaces, setLoadingSpaces] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const loadSpaces = async () => {
      if (user) {
        setLoadingSpaces(true);
        await fetchSharedSpaces(user.id);
        setLoadingSpaces(false);
      }
    };
    loadSpaces();
  }, [user, fetchSharedSpaces]);

  useEffect(() => {
    if (selectedSpace) {
      loadSpaceRecipes(selectedSpace.id);
    }
  }, [selectedSpace]);

  const loadSpaceRecipes = async (spaceId: string) => {
    if (!supabase) return;
    setLoadingRecipes(true);
    const { data, error } = await supabase
      .from('shared_space_recipes')
      .select('*, recipes(*)')
      .eq('space_id', spaceId);

    if (!error && data) {
      setSpaceRecipes(data.map((item: any) => item.recipes).filter(Boolean));
    }
    setLoadingRecipes(false);
  };

  if (authLoading || loadingSpaces) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-3">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-gray-500 text-sm">Loading spaces...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="p-2 hover:bg-gray-100 rounded-full">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <h1 className="text-xl font-bold text-gray-800">Shared Spaces</h1>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowJoinModal(true)}>
                Join Space
              </Button>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-1" /> Create
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {selectedSpace ? (
          <SpaceDetail 
            space={selectedSpace} 
            recipes={spaceRecipes}
            loading={loadingRecipes}
            onBack={() => setSelectedSpace(null)}
            onLeave={async () => {
              await leaveSpace(selectedSpace.id, user.id);
              setSelectedSpace(null);
            }}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {sharedSpaces.length === 0 ? (
              <Card className="col-span-full p-12 text-center">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-800 mb-2">No Shared Spaces Yet</h2>
                <p className="text-gray-500 mb-6">
                  Create a space to share recipes with family and friends
                </p>
                <div className="flex justify-center gap-3">
                  <Button variant="secondary" onClick={() => setShowJoinModal(true)}>
                    Join with Code
                  </Button>
                  <Button onClick={() => setShowCreateModal(true)}>
                    Create Space
                  </Button>
                </div>
              </Card>
            ) : (
              sharedSpaces.map((space) => (
                <Card 
                  key={space.id} 
                  hover 
                  className="p-4 cursor-pointer"
                  onClick={() => setSelectedSpace(space)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                      <Users className="w-6 h-6 text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-800">{space.name}</h3>
                      {space.description && (
                        <p className="text-sm text-gray-500 truncate">{space.description}</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateSpaceModal 
          onClose={() => setShowCreateModal(false)}
          onCreate={async (name, description) => {
            await createSharedSpace(name, description, user.id);
            setShowCreateModal(false);
          }}
        />
      )}

      {/* Join Modal */}
      {showJoinModal && (
        <JoinSpaceModal
          onClose={() => setShowJoinModal(false)}
          onJoin={async (code) => {
            const success = await joinSpaceByCode(code, user.id);
            if (success) {
              setShowJoinModal(false);
            }
            return success;
          }}
        />
      )}
    </div>
  );
}

function SpaceDetail({ 
  space, 
  recipes, 
  loading,
  onBack, 
  onLeave 
}: { 
  space: DBSharedSpace; 
  recipes: DBRecipe[];
  loading: boolean;
  onBack: () => void;
  onLeave: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyInviteCode = () => {
    navigator.clipboard.writeText(space.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-800">{space.name}</h2>
          {space.description && (
            <p className="text-gray-500">{space.description}</p>
          )}
        </div>
      </div>

      {/* Invite Code */}
      <Card className="p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Invite Code</p>
            <p className="font-mono text-lg font-semibold text-gray-800">{space.invite_code}</p>
          </div>
          <button
            onClick={copyInviteCode}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </Card>

      {/* Recipes */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Shared Recipes</h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
          </div>
        ) : recipes.length === 0 ? (
          <Card className="p-8 text-center">
            <ChefHat className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No recipes shared yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Share recipes from your collection to this space
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {recipes.map((recipe) => (
              <Link key={recipe.id} href={`/recipe/${recipe.id}`}>
                <Card hover className="flex overflow-hidden h-24">
                  {recipe.image_url && (
                    <div className="relative w-24 h-full flex-shrink-0">
                      <Image
                        src={recipe.image_url}
                        alt={recipe.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                  <div className="flex-1 p-3 min-w-0">
                    <h4 className="font-medium text-gray-800 truncate">{recipe.title}</h4>
                    <p className="text-sm text-gray-500 truncate">{recipe.cuisine}</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Leave Button */}
      <Button variant="secondary" onClick={onLeave} className="text-red-500">
        <LogOut className="w-4 h-4 mr-2" />
        Leave Space
      </Button>
    </div>
  );
}

function CreateSpaceModal({ 
  onClose, 
  onCreate 
}: { 
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    await onCreate(name, description);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Create Shared Space</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Space Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="e.g., Family Recipes"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="What's this space for?"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || loading}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Space'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function JoinSpaceModal({ 
  onClose, 
  onJoin 
}: { 
  onClose: () => void;
  onJoin: (code: string) => Promise<boolean>;
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    
    const success = await onJoin(code.trim());
    if (!success) {
      setError('Invalid invite code or already a member');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Join Shared Space</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Invite Code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
            placeholder="Enter code"
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleJoin} disabled={!code.trim() || loading}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Join Space'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
