import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/supabase";
import { serverDb } from "@/lib/server-database";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Get auth token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const accessToken = authHeader.substring(7);
    const { user, error: authError } = await verifyAccessToken(accessToken);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid authentication" },
        { status: 401 },
      );
    }

    // Get pagination params
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Get timeline
    const timeline = await serverDb.getTimeline(
      user.id,
      limit,
      offset,
      accessToken,
    );

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
