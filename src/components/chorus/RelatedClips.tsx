"use client";

import { useState, useEffect } from "react";
import { Clock, User, Star, Zap, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import type { AudioClip } from "@/types/audio";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

interface RelatedClipsProps {
  currentClip: AudioClip & {
    url: string;
    starCount: number;
    isStarredByUser: boolean;
  };
}

interface ClipWithStarInfo extends AudioClip {
  url: string;
  starCount: number;
  isStarredByUser: boolean;
}

export function RelatedClips({ currentClip }: RelatedClipsProps) {
  const { user, getAuthHeaders } = useAuth();
  const [relatedClips, setRelatedClips] = useState<ClipWithStarInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRelatedClips = async () => {
      if (!currentClip) return;

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();

        // Filter by same language as current clip
        params.append("language", currentClip.metadata.language);

        // Sort by creation date (newest first)
        params.append("sortField", "createdAt");
        params.append("sortDirection", "desc");

        // Limit to 10 clips
        params.append("limit", "10");

        const headers: HeadersInit = {
          ...getAuthHeaders(),
        };

        const response = await fetch(`/api/clips?${params.toString()}`, {
          headers,
        });

        if (!response.ok) {
          throw new Error("Failed to fetch related clips");
        }

        const data = await response.json();

        // Filter out the current clip and take up to 8 clips
        const filtered = data.clips
          .filter((clip: ClipWithStarInfo) => clip.id !== currentClip.id)
          .slice(0, 8);

        setRelatedClips(filtered);
      } catch (error) {
        console.error("Failed to fetch related clips:", error);
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load related clips"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRelatedClips();
  }, [currentClip, user, getAuthHeaders]);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 h-fit">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          More {currentClip.metadata.language} Clips
        </h3>
        <span className="text-sm text-gray-500">
          {relatedClips.length} found
        </span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="ml-2 text-gray-600 text-sm">Loading clips...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-md">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {!loading && !error && relatedClips.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <div className="text-3xl mb-2">🎵</div>
          <p className="text-sm">
            No other {currentClip.metadata.language} clips found
          </p>
        </div>
      )}

      {!loading && !error && relatedClips.length > 0 && (
        <div className="space-y-3">
          {relatedClips.map((clip) => (
            <div
              key={clip.id}
              className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
            >
              {/* Clip Header */}
              <div className="mb-2">
                <h4 className="font-medium text-gray-900 text-sm leading-tight mb-1 break-words">
                  {clip.title}
                </h4>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(clip.duration)}
                  </span>
                  {clip.metadata.speakerGender && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {clip.metadata.speakerGender}
                    </span>
                  )}
                  {clip.starCount > 0 && (
                    <span className="flex items-center gap-1 text-yellow-600">
                      <Star className="w-3 h-3 fill-current" />
                      {clip.starCount}
                    </span>
                  )}
                </div>
              </div>

              {/* Tags (if any) */}
              {clip.metadata.tags.length > 0 && (
                <div className="mb-2">
                  <div className="flex gap-1 flex-wrap">
                    {clip.metadata.tags.slice(0, 2).map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                    {clip.metadata.tags.length > 2 && (
                      <span className="text-xs text-gray-400">
                        +{clip.metadata.tags.length - 2}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Speaker Info */}
              {(clip.metadata.speakerAgeRange ||
                clip.metadata.speakerDialect) && (
                <div className="mb-2 text-xs text-gray-600">
                  {clip.metadata.speakerAgeRange && (
                    <span>{clip.metadata.speakerAgeRange}</span>
                  )}
                  {clip.metadata.speakerAgeRange &&
                    clip.metadata.speakerDialect && (
                      <span className="mx-1">•</span>
                    )}
                  {clip.metadata.speakerDialect && (
                    <span>{clip.metadata.speakerDialect}</span>
                  )}
                </div>
              )}

              {/* Transcript Preview */}
              {clip.metadata.transcript && (
                <div className="mb-3">
                  <p className="text-xs text-gray-600 italic line-clamp-2">
                    &quot;
                    {clip.metadata.transcript.length > 60
                      ? clip.metadata.transcript.substring(0, 60) + "..."
                      : clip.metadata.transcript}
                    &quot;
                  </p>
                </div>
              )}

              {/* Action Button */}
              <div className="flex justify-end">
                <Link
                  href={`/chorus/${clip.id}`}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 text-xs font-medium transition-colors"
                >
                  <Zap className="w-3 h-3" />
                  Chorus This!
                </Link>
              </div>

              {/* Upload Date */}
              <div className="mt-2 pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-400">
                  {formatDate(clip.createdAt)}
                </span>
              </div>
            </div>
          ))}

          {/* View All Link */}
          <div className="pt-3 border-t border-gray-200">
            <Link
              href={`/library?language=${currentClip.metadata.language}`}
              className="block text-center text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              View all {currentClip.metadata.language} clips →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
