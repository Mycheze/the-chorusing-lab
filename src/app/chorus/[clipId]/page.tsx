"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, AlertCircle, Play } from "lucide-react";
import Link from "next/link";
import { ChorusingPlayer } from "@/components/chorus/ChorusingPlayer";
import { TranscriptionPractice } from "@/components/chorus/TranscriptionPractice";
import { RelatedClips } from "@/components/chorus/RelatedClips";
import { DifficultyRating } from "@/components/chorus/DifficultyRating";
import { ClipVoting } from "@/components/chorus/ClipVoting";
import { useAuth } from "@/lib/auth";
import type { AudioClip } from "@/types/audio";

interface ClipWithUrl extends AudioClip {
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

export default function ChorusPage() {
  const { user, getAuthHeaders } = useAuth();
  const params = useParams();
  const clipId = params?.clipId as string;

  const [clip, setClip] = useState<ClipWithUrl | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch clip data - REVERTED TO ORIGINAL WORKING VERSION
  useEffect(() => {
    const fetchClip = async () => {
      if (!clipId) return;

      setLoading(true);
      setError(null);

      try {
        const headers: HeadersInit = {};
        if (user) {
          const authHeaders = getAuthHeaders();
          Object.assign(headers, authHeaders);
        }

        const response = await fetch("/api/clips", { headers });

        if (!response.ok) {
          throw new Error("Failed to fetch clips");
        }

        const data = await response.json();
        const foundClip = data.clips.find((c: ClipWithUrl) => c.id === clipId);

        if (!foundClip) {
          throw new Error("Clip not found");
        }

        setClip(foundClip);
      } catch (error) {
        console.error("Failed to fetch clip:", error);
        setError(
          error instanceof Error ? error.message : "Failed to load clip"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchClip();
  }, [clipId, user, getAuthHeaders]);

  // Create a truly stable clip for the player
  // This ONLY changes when the clip ID or URL changes, NOT when metadata updates
  const playerClip = useMemo(() => {
    if (!clip) return null;

    // Create a frozen copy that won't change
    return Object.freeze({
      id: clip.id,
      title: clip.title,
      duration: clip.duration,
      filename: clip.filename,
      originalFilename: clip.originalFilename,
      fileSize: clip.fileSize,
      metadata: Object.freeze({
        language: clip.metadata.language,
        speakerGender: clip.metadata.speakerGender,
        speakerAgeRange: clip.metadata.speakerAgeRange,
        speakerDialect: clip.metadata.speakerDialect,
        transcript: clip.metadata.transcript,
        sourceUrl: clip.metadata.sourceUrl,
        tags: [...clip.metadata.tags],
      }),
      uploadedBy: clip.uploadedBy,
      createdAt: clip.createdAt,
      updatedAt: clip.updatedAt,
      url: clip.url,
      starCount: clip.starCount,
      isStarredByUser: clip.isStarredByUser,
    });
  }, [clip]); // Depend on clip object

  // Handle transcription updates WITHOUT affecting the player
  const handleTranscriptionUpdate = useCallback(
    (newTranscript: string) => {
      if (!user || !clip) return;

      // Update the clip state for UI display
      setClip((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          metadata: {
            ...prev.metadata,
            transcript: newTranscript,
          },
        };
      });
    },
    [user, clip]
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <span className="text-lg text-gray-700">Loading clip...</span>
          </div>
        </div>
      </main>
    );
  }

  if (error || !clip || !playerClip) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex items-center justify-center min-h-screen">
          <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 text-center max-w-md">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Clip Not Found
            </h1>
            <p className="text-gray-600 mb-6">
              {error || "The requested audio clip could not be found."}
            </p>
            <Link
              href="/library"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Library
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="p-4 bg-white/80 backdrop-blur-sm border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/library"
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Library
            </Link>
            <div className="flex items-center gap-3">
              <Play className="w-8 h-8 text-indigo-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Chorusing Practice
                </h1>
                <p className="text-sm text-gray-600">{clip.title}</p>
              </div>
            </div>
          </div>

          {user ? (
            <div className="text-sm text-gray-600">
              Welcome,{" "}
              <span className="font-medium text-gray-900">{user.username}</span>
            </div>
          ) : (
            <div className="text-sm text-gray-600">🌐 Browsing publicly</div>
          )}
        </div>
      </header>

      <div className="p-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Chorusing Area - Left Side (70%) */}
            <div className="lg:col-span-3 space-y-6">
              {/* Clip Info Card */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <div className="flex items-start justify-between gap-6 mb-4">
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-900">
                      {clip.title}
                    </h2>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                      <span>{clip.duration.toFixed(1)}s</span>
                      <span>{clip.metadata.language}</span>
                      {clip.metadata.speakerGender && (
                        <span className="capitalize">
                          {clip.metadata.speakerGender}
                        </span>
                      )}
                      {clip.metadata.speakerDialect && (
                        <span>{clip.metadata.speakerDialect}</span>
                      )}
                      {clip.charactersPerSecond && (
                        <span className="text-xs">
                          {clip.charactersPerSecond.toFixed(1)} chars/s
                          {clip.speedCategory && (
                            <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                              {clip.speedCategory}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    {clip.starCount > 0 && (
                      <div className="flex items-center gap-1 text-yellow-600 mt-2">
                        <span className="text-sm font-medium">
                          {clip.starCount}
                        </span>
                        <span className="text-xs">stars</span>
                      </div>
                    )}
                    {clip.metadata.tags.length > 0 && (
                      <div className="flex gap-2 flex-wrap mt-3">
                        {clip.metadata.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Discovery Features - Right side */}
                  <div className="flex flex-col gap-4 min-w-[280px]">
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        Difficulty Rating
                      </div>
                      <DifficultyRating
                        clipId={clip.id}
                        averageRating={clip.difficultyRating ?? null}
                        ratingCount={clip.difficultyRatingCount ?? 0}
                        userRating={clip.userDifficultyRating ?? null}
                        onRatingUpdate={(rating, average, count) => {
                          setClip((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  difficultyRating: average,
                                  difficultyRatingCount: count,
                                  userDifficultyRating: rating,
                                }
                              : null
                          );
                        }}
                      />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        Helpful?
                      </div>
                      <ClipVoting
                        clipId={clip.id}
                        upvoteCount={clip.upvoteCount ?? 0}
                        downvoteCount={clip.downvoteCount ?? 0}
                        voteScore={clip.voteScore ?? 0}
                        userVote={clip.userVote ?? null}
                        onVoteUpdate={(upvotes, downvotes, score, userVote) => {
                          setClip((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  upvoteCount: upvotes,
                                  downvoteCount: downvotes,
                                  voteScore: score,
                                  userVote,
                                }
                              : null
                          );
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Chorusing Player - Use the stable playerClip */}
              <ChorusingPlayer
                key={playerClip.id} // Key by ID to force remount only on clip change
                clip={playerClip}
              />

              {/* Transcription Practice - Use the mutable clip for updates */}
              <TranscriptionPractice
                clip={clip}
                onTranscriptionUpdate={handleTranscriptionUpdate}
              />
            </div>

            {/* Related Clips Sidebar - Right Side (30%) */}
            <div className="lg:col-span-1">
              <RelatedClips currentClip={clip} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
