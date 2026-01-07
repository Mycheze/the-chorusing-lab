import { NextRequest, NextResponse } from "next/server";
import { serverDb } from "@/lib/server-database";
import { verifyAccessToken } from "@/lib/supabase";
import type { FilterPreferences } from "@/types/audio";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const accessToken = authHeader.substring(7);

    // Verify token using standard client (no custom storage)
    const { user, error: authError } = await verifyAccessToken(accessToken);

    if (authError) {
      console.error("❌ Token verification failed:", authError.message);
      return NextResponse.json(
        { error: "Invalid authentication" },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const preferences = await serverDb.getUserFilterPreferences(
      user.id,
      accessToken
    );

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error("Get preferences error:", error);
    return NextResponse.json(
      { error: "Failed to get preferences" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const accessToken = authHeader.substring(7);

    // Verify token using standard client (no custom storage)
    const { user, error: authError } = await verifyAccessToken(accessToken);

    if (authError) {
      console.error("❌ Token verification failed:", authError.message);
      return NextResponse.json(
        { error: "Invalid authentication" },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { preferences } = body;

    // Validate preferences structure
    if (preferences !== null && typeof preferences !== "object") {
      return NextResponse.json(
        { error: "Invalid preferences format" },
        { status: 400 }
      );
    }

    // Validate individual fields if provided
    if (preferences) {
      if (
        preferences.language !== undefined &&
        typeof preferences.language !== "string"
      ) {
        return NextResponse.json(
          { error: "Invalid language format" },
          { status: 400 }
        );
      }

      if (
        preferences.speakerGender !== undefined &&
        !["male", "female", "other"].includes(preferences.speakerGender)
      ) {
        return NextResponse.json(
          { error: "Invalid speakerGender value" },
          { status: 400 }
        );
      }

      if (
        preferences.speakerAgeRange !== undefined &&
        !["teen", "younger-adult", "adult", "senior"].includes(
          preferences.speakerAgeRange
        )
      ) {
        return NextResponse.json(
          { error: "Invalid speakerAgeRange value" },
          { status: 400 }
        );
      }

      if (
        preferences.speakerDialect !== undefined &&
        typeof preferences.speakerDialect !== "string"
      ) {
        return NextResponse.json(
          { error: "Invalid speakerDialect format" },
          { status: 400 }
        );
      }

      if (
        preferences.speedFilter !== undefined &&
        !["slow", "medium", "fast"].includes(preferences.speedFilter)
      ) {
        return NextResponse.json(
          { error: "Invalid speedFilter value" },
          { status: 400 }
        );
      }

      if (preferences.defaultSort !== undefined) {
        if (typeof preferences.defaultSort !== "object" || preferences.defaultSort === null) {
          return NextResponse.json(
            { error: "Invalid defaultSort format" },
            { status: 400 }
          );
        }
        const validSortFields = [
          "title",
          "duration",
          "language",
          "createdAt",
          "voteScore",
          "difficulty",
          "charactersPerSecond",
        ];
        if (
          !preferences.defaultSort.field ||
          !validSortFields.includes(preferences.defaultSort.field)
        ) {
          return NextResponse.json(
            { error: "Invalid defaultSort.field value" },
            { status: 400 }
          );
        }
        if (
          !preferences.defaultSort.direction ||
          !["asc", "desc"].includes(preferences.defaultSort.direction)
        ) {
          return NextResponse.json(
            { error: "Invalid defaultSort.direction value" },
            { status: 400 }
          );
        }
      }
    }

    await serverDb.saveUserFilterPreferences(
      user.id,
      preferences as FilterPreferences,
      accessToken
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save preferences error:", error);
    return NextResponse.json(
      { error: "Failed to save preferences" },
      { status: 500 }
    );
  }
}
