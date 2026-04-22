import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { serverDb } from "@/lib/server-database";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Get user stats
    const stats = await serverDb.getUserStats(session.userId);

    // Get contribution stats
    const contributionStats = await serverDb.getContributionStats(
      session.userId,
    );

    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        contribution: contributionStats,
      },
    });
  } catch (error) {
    console.error("Stats API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
