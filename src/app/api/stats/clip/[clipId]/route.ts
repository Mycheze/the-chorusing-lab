import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { serverDb } from "@/lib/server-database";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { clipId: string } },
) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const clipId = params.clipId;
    if (!clipId) {
      return NextResponse.json({ error: "Missing clip ID" }, { status: 400 });
    }

    // Get clip stats
    const stats = await serverDb.getClipStats(clipId, session.userId);

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Clip stats API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
