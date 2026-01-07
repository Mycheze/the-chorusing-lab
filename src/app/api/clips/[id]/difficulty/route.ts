import { NextRequest, NextResponse } from "next/server";
import { serverDb } from "@/lib/server-database";
import { verifyAccessToken } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const accessToken = authHeader.substring(7);
    const { user, error: authError } = await verifyAccessToken(accessToken);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid authentication" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { rating } = body;

    if (!rating || typeof rating !== "number" || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return NextResponse.json(
        { error: "Rating must be an integer between 1 and 5" },
        { status: 400 }
      );
    }

    await serverDb.rateClipDifficulty(id, user.id, rating, accessToken);

    // Get updated rating stats
    const ratingStats = await serverDb.getClipDifficultyRating(id, accessToken);

    return NextResponse.json({
      success: true,
      rating: ratingStats.average,
      count: ratingStats.count,
    });
  } catch (error) {
    console.error("Difficulty rating error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to rate clip difficulty" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const accessToken = authHeader.substring(7);
    const { user, error: authError } = await verifyAccessToken(accessToken);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid authentication" },
        { status: 401 }
      );
    }

    await serverDb.removeDifficultyRating(id, user.id, accessToken);

    // Get updated rating stats
    const ratingStats = await serverDb.getClipDifficultyRating(id, accessToken);

    return NextResponse.json({
      success: true,
      rating: ratingStats.average,
      count: ratingStats.count,
    });
  } catch (error) {
    console.error("Remove difficulty rating error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove difficulty rating" },
      { status: 500 }
    );
  }
}
