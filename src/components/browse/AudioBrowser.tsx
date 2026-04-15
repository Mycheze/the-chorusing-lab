"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { EditClipModal } from "./EditClipModal";
import { FilterPanel } from "./FilterPanel";
import { ClipCard } from "./ClipCard";
import { useClipFilters } from "@/hooks/useClipFilters";
import { useClipFetching } from "@/hooks/useClipFetching";
import { useAuth } from "@/lib/auth";
import type { AudioClip } from "@/types/audio";

interface AudioBrowserProps {
  onRefresh?: () => void;
}

export interface ClipWithStarInfo extends AudioClip {
  url: string;
  starCount: number;
  isStarredByUser: boolean;
  difficultyRating?: number | null;
  difficultyRatingCount?: number;
  userDifficultyRating?: number | null;
  upvoteCount?: number;
  downvoteCount?: number;
  voteScore?: number;
  userVote?: "up" | "down" | null;
  charactersPerSecond?: number;
  speedCategory?: "slow" | "medium" | "fast";
}

export function AudioBrowser({ onRefresh }: AudioBrowserProps) {
  const { user } = useAuth();

  const filterState = useClipFilters(user?.id);
  const {
    filters,
    sort,
    searchTerm,
    showFilters,
    showStarred,
    showMyUploads,
    availableDialects,
    loadingDialects,
    preferencesLoading,
    preferencesApplied,
    setShowFilters,
    handleFilterChange,
    handleLanguageFilterChange,
    handleSortChange,
    handleSearchChange,
    handleShowStarredChange,
    handleShowMyUploadsChange,
    clearFilters,
  } = filterState;

  const {
    clips,
    setClips,
    loading,
    isFiltering,
    error,
    fetchClips,
  } = useClipFetching(
    filters,
    sort,
    showStarred,
    showMyUploads,
    preferencesLoading,
    preferencesApplied,
    onRefresh,
  );

  const [expandedClip, setExpandedClip] = useState<string | null>(null);
  const [playingClip, setPlayingClip] = useState<string | null>(null);
  const [editingClip, setEditingClip] = useState<ClipWithStarInfo | null>(null);
  const [deletingClip, setDeletingClip] = useState<ClipWithStarInfo | null>(
    null
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const toggleExpanded = useCallback((clipId: string) => {
    setExpandedClip((prev) => (prev === clipId ? null : clipId));
  }, []);

  const handlePlay = useCallback((clipId: string) => {
    setPlayingClip(clipId);
    setExpandedClip(clipId);
  }, []);

  const handleStar = useCallback(async (clipId: string, isStarred: boolean) => {
    if (!user) return;

    try {
      const method = isStarred ? "DELETE" : "POST";
      const response = await fetch(`/api/clips/${clipId}/star`, {
        method,
      });

      if (response.ok) {
        setClips((prev) =>
          prev.map((clip) =>
            clip.id === clipId
              ? {
                  ...clip,
                  isStarredByUser: !isStarred,
                  starCount: isStarred
                    ? clip.starCount - 1
                    : clip.starCount + 1,
                }
              : clip
          )
        );
      }
    } catch (error) {
      console.error("Failed to star/unstar clip:", error);
    }
  }, [user, setClips]);

  const handleEdit = useCallback((clip: ClipWithStarInfo) => {
    setEditingClip(clip);
  }, []);

  const handleDeleteRequest = useCallback((clip: ClipWithStarInfo) => {
    setDeletingClip(clip);
    setDeleteConfirmOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!user || !deletingClip) return;

    try {
      const response = await fetch(`/api/clips/${deletingClip.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setClips((prev) => prev.filter((clip) => clip.id !== deletingClip.id));
        setDeleteConfirmOpen(false);
        setDeletingClip(null);

        if (expandedClip === deletingClip.id) {
          setExpandedClip(null);
        }
        if (playingClip === deletingClip.id) {
          setPlayingClip(null);
        }
      } else {
        const errorData = await response.json();
        console.error("Delete failed:", errorData.error);
      }
    } catch (error) {
      console.error("Failed to delete clip:", error);
    }
  }, [user, deletingClip, expandedClip, playingClip, setClips]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmOpen(false);
    setDeletingClip(null);
  }, []);

  const handleEditSuccess = useCallback((updatedClip: AudioClip) => {
    setClips((prev) =>
      prev.map((clip) =>
        clip.id === updatedClip.id ? { ...clip, ...updatedClip } : clip
      )
    );
    setEditingClip(null);
  }, [setClips]);

  // Filter clips by search term (client-side for simplicity)
  const filteredClips = clips.filter((clip) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      clip.title.toLowerCase().includes(term) ||
      clip.metadata.language.toLowerCase().includes(term) ||
      clip.metadata.tags.some((tag) => tag.toLowerCase().includes(term)) ||
      (clip.metadata.transcript &&
        clip.metadata.transcript.toLowerCase().includes(term))
    );
  });

  // Only show full-page spinner on initial load when we have no clips yet
  if (loading && clips.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin" />
        <span className="ml-2 text-gray-600">Loading clips...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Audio Library</h2>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div
            className={`w-4 h-4 border-2 border-gray-300 border-t-indigo-600 rounded-full transition-opacity duration-200 ${
              isFiltering ? 'opacity-100 animate-spin' : 'opacity-0'
            }`}
            aria-hidden="true"
          />
          <span>{filteredClips.length} clips found</span>
        </div>
      </div>

      <FilterPanel
        filters={filters}
        sort={sort}
        searchTerm={searchTerm}
        showFilters={showFilters}
        showStarred={showStarred}
        showMyUploads={showMyUploads}
        availableDialects={availableDialects}
        loadingDialects={loadingDialects}
        hasUser={!!user}
        onFilterChange={handleFilterChange}
        onLanguageFilterChange={handleLanguageFilterChange}
        onSortChange={handleSortChange}
        onSearchChange={handleSearchChange}
        onShowStarredChange={handleShowStarredChange}
        onShowMyUploadsChange={handleShowMyUploadsChange}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onClearFilters={clearFilters}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Error loading clips</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
            <button
              onClick={() => fetchClips(false)}
              className="ml-4 px-3 py-1 text-sm font-medium text-red-700 bg-red-100 border border-red-300 rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Clips List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredClips.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <div className="text-4xl mb-4">🎵</div>
            <p className="text-lg font-medium mb-2">No clips found</p>
            {filters.language ||
            filters.speakerGender ||
            filters.speakerAgeRange ||
            (filters.tags && filters.tags.length > 0) ||
            showStarred ||
            showMyUploads ||
            searchTerm ? (
              <div className="space-y-3">
                <p className="text-sm">
                  There are no clips matching your filters, but you can add some
                  with the Clip Creator!
                </p>
                <Link
                  href="/clip-creator"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 text-sm font-medium"
                >
                  Go to Clip Creator
                </Link>
              </div>
            ) : (
              <p className="text-sm">
                Try adjusting your search terms or filters
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredClips.map((clip) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                isExpanded={expandedClip === clip.id}
                isPlaying={playingClip === clip.id}
                user={user}
                onToggleExpanded={toggleExpanded}
                onPlay={handlePlay}
                onStar={handleStar}
                onEdit={handleEdit}
                onDelete={handleDeleteRequest}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingClip && (
        <EditClipModal
          clip={editingClip}
          isOpen={!!editingClip}
          onClose={() => setEditingClip(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && deletingClip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Delete Audio Clip
                  </h3>
                  <p className="text-sm text-gray-600">
                    This action cannot be undone
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 mb-2">
                  Are you sure you want to delete{" "}
                  <strong>&quot;{deletingClip.title}&quot;</strong>?
                </p>
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-800">
                    This will permanently delete the audio file and all its
                    metadata.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={handleDeleteCancel}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Clip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
