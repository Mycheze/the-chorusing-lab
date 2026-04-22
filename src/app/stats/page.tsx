"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Clock,
  Music,
  Target,
  TrendingUp,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Calendar,
  Languages,
  Award,
  FileText,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import {
  formatTime,
  formatTimeDetailed,
  getLanguageName,
} from "@/lib/stats-utils";
import type { SupabaseAudioClip } from "@/types/supabase";

interface Stats {
  totalChorusingTimeSeconds: number;
  totalClipsPracticed: number;
  totalTranscriptionAttempts: number;
  totalClipsSubmitted: number;
  languageStats: Record<
    string,
    { timeSeconds: number; clipsPracticed: number }
  >;
  practiceStreak: number;
  contribution: {
    totalClipsSubmitted: number;
    totalTimeByOthers: number;
    popularClips: Array<{
      clip: SupabaseAudioClip;
      totalTimeByOthers: number;
      userCount: number;
    }>;
  };
}

interface TimelineItem {
  clip: SupabaseAudioClip;
  lastPracticedAt: string;
  totalTimeSeconds: number;
  sessionCount: number;
  totalLoops: number;
}

export default function StatsPage() {
  const { user, isLoading: authLoading, getAuthHeaders } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return; // Wait for auth to finish loading
    if (!user) {
      router.push("/");
      return;
    }

    const fetchStats = async () => {
      try {
        const response = await fetch("/api/stats", {
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch stats");
        }

        const data = await response.json();
        setStats(data.stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        setLoading(false);
      }
    };

    const fetchTimeline = async () => {
      try {
        const response = await fetch("/api/stats/timeline?limit=20", {
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch timeline");
        }

        const data = await response.json();
        setTimeline(data.timeline || []);
      } catch (err) {
        console.error("Failed to fetch timeline:", err);
      } finally {
        setTimelineLoading(false);
      }
    };

    fetchStats();
    fetchTimeline();
  }, [user, authLoading, router, getAuthHeaders]);

  if (authLoading || !user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <span className="text-lg text-gray-700">Loading...</span>
          </div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <span className="text-lg text-gray-700">Loading stats...</span>
          </div>
        </div>
      </main>
    );
  }

  if (error || !stats) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex items-center justify-center min-h-screen">
          <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 text-center max-w-md">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Error Loading Stats
            </h1>
            <p className="text-gray-600 mb-6">
              {error || "Failed to load stats"}
            </p>
            <Link
              href="/library"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Library
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const languageEntries = Object.entries(stats.languageStats || {}).sort(
    (a, b) => b[1].timeSeconds - a[1].timeSeconds,
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="p-4 bg-white/80 backdrop-blur-sm border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/library"
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Library</span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-3">
              <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" />
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">
                Your Stats
              </h1>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">
                    Total Practice Time
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatTime(stats.totalChorusingTimeSeconds)}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-indigo-600" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Clips Practiced</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.totalClipsPracticed}
                  </p>
                </div>
                <Music className="w-8 h-8 text-indigo-600" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Practice Streak</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.practiceStreak} day
                    {stats.practiceStreak !== 1 ? "s" : ""}
                  </p>
                </div>
                <Target className="w-8 h-8 text-indigo-600" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Transcriptions</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.totalTranscriptionAttempts}
                  </p>
                </div>
                <FileText className="w-8 h-8 text-indigo-600" />
              </div>
            </div>
          </div>

          {/* Time by Language */}
          {languageEntries.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <Languages className="w-5 h-5 text-indigo-600" />
                <h2 className="text-xl font-bold text-gray-900">
                  Time by Language
                </h2>
              </div>
              <div className="space-y-3">
                {languageEntries.map(([lang, data]) => (
                  <div key={lang} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">
                        {getLanguageName(lang)}
                      </span>
                      <span className="text-gray-600">
                        {formatTime(data.timeSeconds)} • {data.clipsPracticed}{" "}
                        clip
                        {data.clipsPracticed !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full"
                        style={{
                          width: `${
                            (data.timeSeconds /
                              stats.totalChorusingTimeSeconds) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Activity Timeline */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <h2 className="text-xl font-bold text-gray-900">
                Recent Activity
              </h2>
            </div>
            {timelineLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : timeline.length === 0 ? (
              <p className="text-gray-600 text-center py-8">
                No practice sessions yet. Start chorusing to see your activity
                here!
              </p>
            ) : (
              <div className="space-y-3">
                {timeline.map((item) => (
                  <Link
                    key={item.clip.id}
                    href={`/chorus/${item.clip.id}`}
                    className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {item.clip.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                          <span>{item.clip.metadata.language}</span>
                          <span>{formatTime(item.totalTimeSeconds)}</span>
                          <span>
                            {item.sessionCount} session
                            {item.sessionCount !== 1 ? "s" : ""}
                          </span>
                          {item.totalLoops > 0 && (
                            <span>
                              {item.totalLoops} loop
                              {item.totalLoops !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(item.lastPracticedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Contribution Stats */}
          {stats.contribution.totalClipsSubmitted > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <Upload className="w-5 h-5 text-indigo-600" />
                <h2 className="text-xl font-bold text-gray-900">
                  Your Contributions
                </h2>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-indigo-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">
                      Clips Submitted
                    </p>
                    <p className="text-2xl font-bold text-indigo-900">
                      {stats.contribution.totalClipsSubmitted}
                    </p>
                  </div>
                  <div className="p-4 bg-indigo-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">
                      Time Practiced by Others
                    </p>
                    <p className="text-2xl font-bold text-indigo-900">
                      {formatTime(stats.contribution.totalTimeByOthers)}
                    </p>
                  </div>
                </div>

                {stats.contribution.popularClips.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">
                      Most Popular Clips
                    </h3>
                    <div className="space-y-2">
                      {stats.contribution.popularClips
                        .slice(0, 5)
                        .map((item) => (
                          <div
                            key={item.clip.id}
                            className="p-3 border border-gray-200 rounded-lg"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900">
                                  {item.clip.title}
                                </h4>
                                <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                                  <span>
                                    {formatTime(item.totalTimeByOthers)}{" "}
                                    practiced
                                  </span>
                                  <span>
                                    {item.userCount} user
                                    {item.userCount !== 1 ? "s" : ""}
                                  </span>
                                </div>
                              </div>
                              <Link
                                href={`/chorus/${item.clip.id}`}
                                className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                              >
                                View
                              </Link>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
