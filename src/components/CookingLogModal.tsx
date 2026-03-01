'use client';

import { useState } from 'react';
import { Modal, Button, Input, StarRating } from './ui';
import { useCookingStore } from '@/lib/store';
import { useSupabaseStore } from '@/lib/supabase-store';
import { useAuth } from '@/lib/auth-context';
import { Camera, Users, X, Loader2 } from 'lucide-react';

interface CookingLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipeId: string;
  recipeName: string;
}

export function CookingLogModal({ isOpen, onClose, recipeId, recipeName }: CookingLogModalProps) {
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [changesMade, setChangesMade] = useState('');
  const [whoWasThere, setWhoWasThere] = useState('');
  const [wouldMakeAgain, setWouldMakeAgain] = useState(true);
  const [cookedAt, setCookedAt] = useState(new Date().toISOString().split('T')[0]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Auth and stores
  const { user } = useAuth();
  const localAddCookingLog = useCookingStore((state) => state.addCookingLog);
  const { addCookingLog: supabaseAddCookingLog, initialized: supabaseInitialized } = useSupabaseStore();

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Convert files to base64 for local storage
    // In production, you'd upload to Supabase storage
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotos((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (rating === 0) {
      setError('Please add a rating!');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      if (user && supabaseInitialized) {
        // Save to Supabase when logged in
        const result = await supabaseAddCookingLog({
          recipe_id: recipeId,
          user_id: user.id,
          cooked_at: new Date(cookedAt).toISOString(),
          rating,
          notes: notes.trim() || null,
          modifications: changesMade.trim() || null,
          people_served: whoWasThere.split(',').map((w) => w.trim()).filter(Boolean),
          photo_urls: photos,
        });
        if (!result) {
          setError('Failed to save cooking log. Please try again.');
          setIsSaving(false);
          return;
        }
      } else {
        // Save to localStorage when not logged in
        localAddCookingLog({
          recipe_id: recipeId,
          cooked_at: new Date(cookedAt).toISOString(),
          rating,
          notes: notes.trim() || null,
          changes_made: changesMade.trim() || null,
          who_was_there: whoWasThere.split(',').map((w) => w.trim()).filter(Boolean),
          photo_urls: photos,
          would_make_again: wouldMakeAgain,
        });
      }
      handleClose();
    } catch (err) {
      console.error('Error saving cooking log:', err);
      setError('Failed to save cooking log. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setRating(0);
    setNotes('');
    setChangesMade('');
    setWhoWasThere('');
    setWouldMakeAgain(true);
    setCookedAt(new Date().toISOString().split('T')[0]);
    setPhotos([]);
    setIsSaving(false);
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Log Your Cooking" size="lg">
      <div className="space-y-6">
        {/* Recipe name */}
        <div className="p-4 bg-gradient-to-r from-orange-100 to-pink-100 rounded-2xl">
          <p className="text-sm text-gray-600">Recording for</p>
          <p className="text-lg font-bold text-gray-800">{recipeName}</p>
        </div>

        {/* Date */}
        <Input
          label="When did you cook this?"
          type="date"
          value={cookedAt}
          onChange={(e) => setCookedAt(e.target.value)}
        />

        {/* Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            How was it? ⭐
          </label>
          <div className="flex items-center gap-4">
            <StarRating rating={rating} onChange={setRating} size="lg" />
            <span className="text-gray-500">
              {rating === 0 && 'Rate this dish!'}
              {rating === 1 && 'Meh...'}
              {rating === 2 && 'Okay'}
              {rating === 3 && 'Good!'}
              {rating === 4 && 'Great!'}
              {rating === 5 && 'Amazing! 🎉'}
            </span>
          </div>
        </div>

        {/* Would make again */}
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={wouldMakeAgain}
              onChange={(e) => setWouldMakeAgain(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
          </label>
          <span className="text-gray-700">Would make again</span>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Notes & Thoughts
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How did it turn out? Any tips for next time?"
            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:bg-white transition-all duration-200 resize-none"
            rows={3}
          />
        </div>

        {/* Changes made */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Changes You Made 🔧
          </label>
          <textarea
            value={changesMade}
            onChange={(e) => setChangesMade(e.target.value)}
            placeholder="Did you modify the recipe? More garlic? Less salt?"
            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:bg-white transition-all duration-200 resize-none"
            rows={2}
          />
        </div>

        {/* Who was there */}
        <Input
          label="Who Was There? 👥"
          value={whoWasThere}
          onChange={(e) => setWhoWasThere(e.target.value)}
          placeholder="Family, friends... (comma separated)"
          icon={<Users className="w-4 h-4" />}
        />

        {/* Photo upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Photos 📸
          </label>

          {/* Photo grid */}
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {photos.map((photo, index) => (
                <div key={index} className="relative aspect-square rounded-xl overflow-hidden">
                  <img
                    src={photo}
                    alt={`Cooking photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removePhoto(index)}
                    className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-all">
            <Camera className="w-5 h-5 text-gray-400" />
            <span className="text-gray-500">Add photos of your creation</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Error message */}
        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
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
              'Save Log'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
