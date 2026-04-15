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
    const { voteType } = body;

    if (!voteType || (voteType !== "up" && voteType !== "down")) {
      return NextResponse.json(
        { error: "voteType must be 'up' or 'down'" },
        { status: 400 }
      );
    }

    await serverDb.voteClip(id, userId, voteType);

    // Get updated vote stats
    const voteStats = await serverDb.getClipVotes(id, userId);

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

    // Authenticate via session cookie
    const session = getSession(request);
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = session.userId;

    await serverDb.removeClipVote(id, userId);

    // Get updated vote stats
    const voteStats = await serverDb.getClipVotes(id, userId);

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
