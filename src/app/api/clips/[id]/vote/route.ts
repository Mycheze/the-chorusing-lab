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
    const { voteType } = body;

    if (!voteType || (voteType !== "up" && voteType !== "down")) {
      return NextResponse.json(
        { error: "voteType must be 'up' or 'down'" },
        { status: 400 }
      );
    }

    await serverDb.voteClip(id, user.id, voteType, accessToken);

    // Get updated vote stats
    const voteStats = await serverDb.getClipVotes(id, accessToken);

    return NextResponse.json({
      success: true,
      upvoteCount: voteStats.upvoteCount,
      downvoteCount: voteStats.downvoteCount,
      voteScore: voteStats.voteScore,
    });
  } catch (error) {
    console.error("Vote error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to vote clip" },
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

    await serverDb.removeClipVote(id, user.id, accessToken);

    // Get updated vote stats
    const voteStats = await serverDb.getClipVotes(id, accessToken);

    return NextResponse.json({
      success: true,
      upvoteCount: voteStats.upvoteCount,
      downvoteCount: voteStats.downvoteCount,
      voteScore: voteStats.voteScore,
    });
  } catch (error) {
    console.error("Remove vote error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove vote" },
      { status: 500 }
    );
  }
}
