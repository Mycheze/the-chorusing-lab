'use client';

import { useState } from 'react';
import { CheckCircle, Trash2, ExternalLink, Library, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import type { AudioClip } from '@/types/audio';

interface ConfirmationStepProps {
  clips: AudioClip[];
  onDelete: (clipIds: string[]) => void;
}

export function ConfirmationStep({ clips, onDelete }: ConfirmationStepProps) {
  const { getAuthHeaders } = useAuth();
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleToggleSelect = (clipId: string) => {
    setSelectedClips(prev => {
      const next = new Set(prev);
      if (next.has(clipId)) {
        next.delete(clipId);
      } else {
        next.add(clipId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedClips.size === clips.length) {
      setSelectedClips(new Set());
    } else {
      setSelectedClips(new Set(clips.map(c => c.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedClips.size === 0) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch('/api/bulk-upload/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          clipIds: Array.from(selectedClips),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Delete failed');
      }

      const result = await response.json();
      
      // Remove successfully deleted clips from local state
      const deletedIds = new Set(result.successful || []);
      const remainingClips = clips.filter(c => !deletedIds.has(c.id));
      
      // Call onDelete with the deleted IDs
      onDelete(Array.from(selectedClips));
      
      // Clear selection
      setSelectedClips(new Set());
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Delete failed');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Upload Complete</h2>
        <p className="text-sm text-gray-600">
          {clips.length} clip{clips.length !== 1 ? 's' : ''} successfully uploaded. Review and manage them below.
        </p>
      </div>

      {deleteError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2 text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="text-sm">{deleteError}</span>
        </div>
      )}

      {/* Selection Controls */}
      {clips.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedClips.size === clips.length && clips.length > 0}
              onChange={handleSelectAll}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-gray-700">
              {selectedClips.size > 0
                ? `${selectedClips.size} selected`
                : 'Select all'}
            </span>
          </div>
          {selectedClips.size > 0 && (
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? 'Deleting...' : `Delete Selected (${selectedClips.size})`}
            </button>
          )}
        </div>
      )}

      {/* Clips List */}
      {clips.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 rounded-lg border border-gray-200">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No clips to display.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {clips.map((clip) => (
            <div
              key={clip.id}
              className="flex items-center gap-3 p-4 bg-white rounded-md border border-gray-200 hover:border-indigo-300 transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedClips.has(clip.id)}
                onChange={() => handleToggleSelect(clip.id)}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {clip.title}
                </p>
                <p className="text-xs text-gray-600">
                  {clip.metadata.language} • {clip.duration.toFixed(1)}s • {clip.metadata.tags?.join(', ') || 'No tags'}
                </p>
              </div>
              <a
                href={`/chorus/${clip.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-colors"
                title="View clip"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          {clips.length} clip{clips.length !== 1 ? 's' : ''} ready
        </div>
        <Link
          href="/library"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <Library className="w-4 h-4" />
          Go to Library
        </Link>
      </div>
    </div>
  );
}
