'use client';

import { useState } from 'react';
import { X, AlertCircle, Edit } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import type { AudioClip, AudioMetadata } from '@/types/audio';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

interface EditClipModalProps {
  clip: AudioClip;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedClip: AudioClip) => void;
}

interface EditFormData {
  title: string;
  language: string;
  speakerGender: 'male' | 'female' | 'other' | '';
  speakerAgeRange: 'teen' | 'younger-adult' | 'adult' | 'senior' | '';
  speakerDialect: string;
  transcript: string;
  sourceUrl: string;
  tags: string;
}

export function EditClipModal({ clip, isOpen, onClose, onSuccess }: EditClipModalProps) {
  const { user, getAuthHeaders } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<EditFormData>({
    title: clip.title,
    language: clip.metadata.language,
    speakerGender: clip.metadata.speakerGender || '',
    speakerAgeRange: clip.metadata.speakerAgeRange || '',
    speakerDialect: clip.metadata.speakerDialect || '',
    transcript: clip.metadata.transcript || '',
    sourceUrl: clip.metadata.sourceUrl || '',
    tags: clip.metadata.tags.join(', '),
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLanguageChange = (language: string) => {
    setFormData(prev => ({ ...prev, language }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    // Validate required fields
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    if (!formData.language.trim()) {
      setError('Language is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Prepare metadata
      const metadata: AudioMetadata = {
        language: formData.language,
        speakerGender: formData.speakerGender as any || undefined,
        speakerAgeRange: formData.speakerAgeRange as any || undefined,
        speakerDialect: formData.speakerDialect.trim() || undefined,
        transcript: formData.transcript.trim() || undefined,
        sourceUrl: formData.sourceUrl.trim() || undefined,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
      };

      const response = await fetch(`/api/clips/${clip.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          metadata,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Update failed');
      }

      const data = await response.json();
      onSuccess(data.clip);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Edit className="w-5 h-5" />
            Edit Audio Clip
          </h1>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* File Info (Read-only) */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">File Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>Original: {clip.originalFilename}</div>
              <div>Size: {(clip.fileSize / 1024).toFixed(1)} KB</div>
              <div>Duration: {clip.duration.toFixed(1)}s</div>
              <div>Uploaded: {new Date(clip.createdAt).toLocaleDateString()}</div>
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter clip title"
            />
          </div>

          {/* Language */}
          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">
              Language *
            </label>
            <LanguageSelector
              value={formData.language}
              onChange={handleLanguageChange}
              required
              className="w-full"
            />
          </div>

          {/* Speaker Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="speakerGender" className="block text-sm font-medium text-gray-700 mb-1">
                Speaker Gender
              </label>
              <select
                id="speakerGender"
                name="speakerGender"
                value={formData.speakerGender}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="speakerAgeRange" className="block text-sm font-medium text-gray-700 mb-1">
                Speaker Age Range
              </label>
              <select
                id="speakerAgeRange"
                name="speakerAgeRange"
                value={formData.speakerAgeRange}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Select age range</option>
                <option value="teen">Teen</option>
                <option value="younger-adult">Younger Adult</option>
                <option value="adult">Adult</option>
                <option value="senior">Senior</option>
              </select>
            </div>
          </div>

          {/* Speaker Dialect */}
          <div>
            <label htmlFor="speakerDialect" className="block text-sm font-medium text-gray-700 mb-1">
              Speaker Dialect
            </label>
            <input
              type="text"
              id="speakerDialect"
              name="speakerDialect"
              value={formData.speakerDialect}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g., American, British, Mexican, Moravian"
            />
          </div>

          {/* Transcript */}
          <div>
            <label htmlFor="transcript" className="block text-sm font-medium text-gray-700 mb-1">
              Transcript
            </label>
            <textarea
              id="transcript"
              name="transcript"
              value={formData.transcript}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="What is said in this audio clip?"
            />
          </div>

          {/* Source URL */}
          <div>
            <label htmlFor="sourceUrl" className="block text-sm font-medium text-gray-700 mb-1">
              Source URL
            </label>
            <input
              type="url"
              id="sourceUrl"
              name="sourceUrl"
              value={formData.sourceUrl}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="https://... (where this audio came from)"
            />
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <input
              type="text"
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="beginner, pronunciation, greetings, formal"
            />
            <p className="text-xs text-gray-500 mt-1">Separate tags with commas</p>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !user}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}