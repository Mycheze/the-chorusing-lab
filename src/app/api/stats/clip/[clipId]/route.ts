import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/supabase";
import { serverDb } from "@/lib/server-database";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { clipId: string } },
) {
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

    const clipId = params.clipId;
    if (!clipId) {
      return NextResponse.json({ error: "Missing clip ID" }, { status: 400 });
    }

    // Get clip stats
    const stats = await serverDb.getClipStats(clipId, user.id, accessToken);

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
