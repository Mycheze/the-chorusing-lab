import { NextRequest, NextResponse } from "next/server";
import { serverDb } from "@/lib/server-database";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Authenticate via session cookie
    const session = getSession(request);
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = session.userId;

    const body = await request.json();
    const { rating } = body;

    if (!rating || typeof rating !== "number" || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return NextResponse.json(
        { error: "Rating must be an integer between 1 and 5" },
        { status: 400 }
      );
    }

    await serverDb.rateClipDifficulty(id, userId, rating);

    // Get updated rating stats
    const ratingStats = await serverDb.getClipDifficultyRating(id, userId);

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

    // Authenticate via session cookie
    const session = getSession(request);
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = session.userId;

    await serverDb.removeDifficultyRating(id, userId);

    // Get updated rating stats
    const ratingStats = await serverDb.getClipDifficultyRating(id, userId);

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
