"use client";

import { useState, useEffect } from "react";
import { Clock, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import type { AudioClip } from "@/types/audio";

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
  const { user } = useAuth();
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
        params.append("language", currentClip.metadata.language);
        params.append("sortField", "createdAt");
        params.append("sortDirection", "desc");
        params.append("limit", "10");

        const response = await fetch(`/api/clips?${params.toString()}`);

        if (!response.ok) {
          throw new Error("Failed to fetch related clips");
        }

        const data = await response.json();

        const filtered = data.clips
          .filter((clip: ClipWithStarInfo) => clip.id !== currentClip.id)
          .slice(0, 6);

        setRelatedClips(filtered);
      } catch (error) {
        console.error("Failed to fetch related clips:", error);
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load related clips",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRelatedClips();
  }, [currentClip, user]);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 h-fit">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          More {currentClip.metadata.language} Clips
        </h3>
        <span className="text-xs text-gray-500">
          {relatedClips.length} found
        </span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-2 rounded-md">
          <AlertCircle className="w-3 h-3" />
          <span className="text-xs">{error}</span>
        </div>
      )}

      {!loading && !error && relatedClips.length === 0 && (
        <p className="text-center py-6 text-sm text-gray-500">
          No other {currentClip.metadata.language} clips found
        </p>
      )}

      {!loading && !error && relatedClips.length > 0 && (
        <div className="space-y-1">
          {relatedClips.map((clip) => (
            <Link
              key={clip.id}
              href={`/chorus/${clip.id}`}
              className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm text-gray-900 truncate group-hover:text-indigo-600"
                  title={clip.title}
                >
                  {clip.metadata.transcript
                    ? clip.metadata.transcript.length > 40
                      ? clip.metadata.transcript.substring(0, 40) + "..."
                      : clip.metadata.transcript
                    : clip.title}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />
                    {formatDuration(clip.duration)}
                  </span>
                  {clip.metadata.speakerDialect && (
                    <span>{clip.metadata.speakerDialect}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}

          <div className="pt-2 mt-1 border-t border-gray-200">
            <Link
              href={`/library?language=${currentClip.metadata.language}`}
              className="block text-center text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              View all {currentClip.metadata.language} clips →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
