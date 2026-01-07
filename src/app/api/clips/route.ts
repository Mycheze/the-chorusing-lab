import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { serverDb } from "@/lib/server-database";
import { getPublicUrl, createAuthenticatedClient } from "@/lib/supabase";
import type { AudioClip, AudioFilters, AudioSort } from "@/types/audio";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Get user from auth header if present
    let userId: string | null = null;
    let accessToken: string | null = null;
    const authHeader = request.headers.get("Authorization");

    if (authHeader && authHeader.startsWith("Bearer ")) {
      accessToken = authHeader.substring(7);
      const authenticatedClient = createAuthenticatedClient(accessToken);

      const {
        data: { user },
      } = await authenticatedClient.auth.getUser();
      if (user) {
        userId = user.id;
      }
    }

    // Parse filters
    const filters: AudioFilters = {};

    const language = searchParams.get("language");
    if (language) {
      filters.language = language;
    }

    const speakerGender = searchParams.get("speakerGender");
    if (speakerGender && ["male", "female", "other"].includes(speakerGender)) {
      filters.speakerGender = speakerGender as "male" | "female" | "other";
    }

    const speakerAgeRange = searchParams.get("speakerAgeRange");
    if (
      speakerAgeRange &&
      ["teen", "younger-adult", "adult", "senior"].includes(speakerAgeRange)
    ) {
      filters.speakerAgeRange = speakerAgeRange as any;
    }

    const speakerDialect = searchParams.get("speakerDialect");
    if (speakerDialect) {
      filters.speakerDialect = speakerDialect;
    }

    const uploadedBy = searchParams.get("uploadedBy");
    if (uploadedBy) {
      filters.uploadedBy = uploadedBy;
    }

    const tagsParam = searchParams.get("tags");
    if (tagsParam) {
      filters.tags = tagsParam
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }

    const speedFilter = searchParams.get("speedFilter");
    if (speedFilter && ["slow", "medium", "fast"].includes(speedFilter)) {
      filters.speedFilter = speedFilter as "slow" | "medium" | "fast";
    }

    // Special filters
    const showStarred = searchParams.get("starred") === "true";
    const showMyUploads = searchParams.get("myUploads") === "true";

    // Apply user-specific filters
    if (showMyUploads && userId) {
      filters.uploadedBy = userId;
    }

    // Parse sorting
    const sort: AudioSort = {
      field: "createdAt",
      direction: "desc",
    };

    const sortField = searchParams.get("sortField");
    if (
      sortField &&
      ["title", "duration", "language", "createdAt", "voteScore", "difficulty", "charactersPerSecond"].includes(sortField)
    ) {
      sort.field = sortField as any;
    }

    const sortDirection = searchParams.get("sortDirection");
    if (sortDirection && ["asc", "desc"].includes(sortDirection)) {
      sort.direction = sortDirection as "asc" | "desc";
    }

    // Parse limit
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam) : undefined;

    // For discovery fields, we need to sort in-memory, so use a default DB sort
    // Discovery fields: voteScore, difficulty, charactersPerSecond
    const isDiscoverySort = sort.field === "voteScore" || sort.field === "difficulty" || sort.field === "charactersPerSecond";
    const dbSort: AudioSort = isDiscoverySort 
      ? { field: "createdAt", direction: "desc" } 
      : sort;

    // Get clips from database with auth context
    // Note: speedFilter is handled in-memory after we get discovery stats
    const dbFilters = { ...filters };
    delete (dbFilters as any).speedFilter; // Remove speedFilter from DB query
    
    let clips: AudioClip[] = [];
    try {
      clips = await serverDb.getAudioClips(
        dbFilters,
        dbSort,
        limit,
        accessToken || undefined
      );
    } catch (error) {
      console.error("Failed to fetch clips from database:", error);
      // Return empty array instead of failing completely
      // This allows the UI to still render, just with no clips
      clips = [];
    }

    // Filter by starred clips if requested
    if (showStarred && userId && accessToken) {
      try {
        const starredClipIds = await serverDb.getUserStarredClips(
          userId,
          accessToken
        );
        clips = clips.filter((clip) => starredClipIds.includes(clip.id));
      } catch (error) {
        console.warn("Failed to get starred clips, continuing without filter:", error);
        // Continue without filtering - better than failing completely
      }
    }

    // Add discovery stats, file URLs, and star info to clips
    const clipsWithDiscovery = await Promise.all(
      clips.map(async (clip) => {
        // Get star info (existing functionality - wrap in try-catch for resilience)
        let starredBy: string[] = [];
        try {
          starredBy = await serverDb.getClipStars(
            clip.id,
            accessToken || undefined
          );
        } catch (error) {
          console.warn(`Failed to get stars for clip ${clip.id}:`, error);
        }

        // Get difficulty rating (new - gracefully handle if table doesn't exist)
        let difficultyRating: { average: number | null; count: number; userRating: number | null } = { average: null, count: 0, userRating: null };
        try {
          difficultyRating = await serverDb.getClipDifficultyRating(
            clip.id,
            accessToken || undefined
          );
        } catch (error) {
          console.warn(`Failed to get difficulty rating for clip ${clip.id}:`, error);
        }

        // Get votes (new - gracefully handle if table doesn't exist)
        let votes = { upvoteCount: 0, downvoteCount: 0, voteScore: 0, userVote: null as "up" | "down" | null };
        try {
          votes = await serverDb.getClipVotes(
            clip.id,
            accessToken || undefined
          );
        } catch (error) {
          console.warn(`Failed to get votes for clip ${clip.id}:`, error);
        }

        // Calculate characters per second (no DB call, safe)
        const charactersPerSecond = serverDb.calculateCharactersPerSecond(clip);

        // Get the storage path for the clip - we need to handle both old and new format
        let publicUrl: string;
        const clipWithPath = clip as any;

        if (clipWithPath.storagePath) {
          // New format: use storage path
          publicUrl = getPublicUrl(clipWithPath.storagePath);
        } else {
          // Fallback: construct path and use file serving API
          publicUrl = `/api/files/${clip.filename}`;
        }

        return {
          ...clip,
          url: publicUrl,
          starCount: starredBy.length,
          isStarredByUser: userId ? starredBy.includes(userId) : false,
          difficultyRating: difficultyRating.average,
          difficultyRatingCount: difficultyRating.count,
          userDifficultyRating: difficultyRating.userRating,
          upvoteCount: votes.upvoteCount,
          downvoteCount: votes.downvoteCount,
          voteScore: votes.voteScore,
          userVote: votes.userVote,
          charactersPerSecond: charactersPerSecond || undefined,
        };
      })
    );

    // Calculate speed percentiles for filtering
    let speedPercentiles: { slow: number; medium: number; fast: number } | null = null;
    if (filters.speedFilter) {
      speedPercentiles = serverDb.getSpeedPercentiles(clipsWithDiscovery);
    }

    // Apply speed filter if requested
    let filteredClips = clipsWithDiscovery;
    if (filters.speedFilter && speedPercentiles) {
      filteredClips = clipsWithDiscovery.filter((clip) => {
        if (!clip.charactersPerSecond) return false;
        const cps = clip.charactersPerSecond;

        if (filters.speedFilter === "slow") {
          return cps <= speedPercentiles!.slow;
        } else if (filters.speedFilter === "medium") {
          return cps > speedPercentiles!.slow && cps <= speedPercentiles!.medium;
        } else if (filters.speedFilter === "fast") {
          return cps > speedPercentiles!.medium;
        }
        return true;
      });
    }

    // Apply sorting for discovery fields (these need to be sorted in-memory)
    // Also handle regular DB sort fields if they weren't sorted by DB (shouldn't happen, but just in case)
    if (isDiscoverySort || sort.field === "voteScore" || sort.field === "difficulty" || sort.field === "charactersPerSecond") {
      filteredClips.sort((a, b) => {
        let aValue: number | null = null;
        let bValue: number | null = null;

        if (sort.field === "voteScore") {
          aValue = (a as any).voteScore ?? 0;
          bValue = (b as any).voteScore ?? 0;
        } else if (sort.field === "difficulty") {
          aValue = (a as any).difficultyRating ?? null;
          bValue = (b as any).difficultyRating ?? null;
        } else if (sort.field === "charactersPerSecond") {
          aValue = (a as any).charactersPerSecond ?? null;
          bValue = (b as any).charactersPerSecond ?? null;
        } else {
          // Fallback for other fields (shouldn't reach here, but handle gracefully)
          return 0;
        }

        // Handle null values (put them at the end)
        if (aValue === null && bValue === null) return 0;
        if (aValue === null) return 1;
        if (bValue === null) return -1;

        const comparison = aValue - bValue;
        return sort.direction === "asc" ? comparison : -comparison;
      });
    }

    // Add speed category to clips
    const clipsWithUrls = filteredClips.map((clip) => {
      let speedCategory: "slow" | "medium" | "fast" | undefined = undefined;
      if (clip.charactersPerSecond && speedPercentiles) {
        if (clip.charactersPerSecond <= speedPercentiles.slow) {
          speedCategory = "slow";
        } else if (clip.charactersPerSecond <= speedPercentiles.medium) {
          speedCategory = "medium";
        } else {
          speedCategory = "fast";
        }
      }

      return {
        ...clip,
        speedCategory,
      };
    });

    return NextResponse.json({
      clips: clipsWithUrls,
      total: clipsWithUrls.length,
    });
  } catch (error) {
    console.error("Clips listing error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch clips",
        code: "FETCH_ERROR",
      },
      { status: 500 }
    );
  }
}
