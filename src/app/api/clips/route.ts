import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { serverDb } from "@/lib/server-database";
import { getPublicUrl, createAuthenticatedClient } from "@/lib/supabase";
import type { AudioFilters, AudioSort } from "@/types/audio";
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
      ["title", "duration", "language", "createdAt"].includes(sortField)
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

    // Get clips from database with auth context
    let clips = await serverDb.getAudioClips(
      filters,
      sort,
      limit,
      accessToken || undefined
    );

    // Filter by starred clips if requested
    if (showStarred && userId && accessToken) {
      const starredClipIds = await serverDb.getUserStarredClips(
        userId,
        accessToken
      );
      clips = clips.filter((clip) => starredClipIds.includes(clip.id));
    }

    // Add file URLs and star info to clips
    const clipsWithUrls = await Promise.all(
      clips.map(async (clip) => {
        const starredBy = await serverDb.getClipStars(
          clip.id,
          accessToken || undefined
        );

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
        };
      })
    );

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
