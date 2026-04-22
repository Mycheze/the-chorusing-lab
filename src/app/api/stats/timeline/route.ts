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

    // Get pagination params
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Get timeline
    const timeline = await serverDb.getTimeline(session.userId, limit, offset);

    return NextResponse.json({
      success: true,
      timeline,
    });
  } catch (error) {
    console.error("Timeline API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
