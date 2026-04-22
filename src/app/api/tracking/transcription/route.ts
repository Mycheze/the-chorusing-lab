import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/supabase";
import { createAuthenticatedClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const {
      clip_id,
      accuracy,
      characters_correct,
      characters_total,
      is_submission = false,
    } = body;

    // Validate required fields
    if (!clip_id) {
      return NextResponse.json(
        { error: "Missing required field: clip_id" },
        { status: 400 },
      );
    }

    // Validate accuracy if provided
    if (accuracy !== null && accuracy !== undefined) {
      if (typeof accuracy !== "number" || accuracy < 0 || accuracy > 100) {
        return NextResponse.json(
          { error: "Invalid accuracy: must be between 0 and 100" },
          { status: 400 },
        );
      }
    }

    const authenticatedClient = createAuthenticatedClient(accessToken);

    const attemptData: any = {
      user_id: user.id,
      clip_id,
      is_submission: Boolean(is_submission),
    };

    if (accuracy !== null && accuracy !== undefined) {
      attemptData.accuracy = accuracy;
    }

    if (characters_correct !== null && characters_correct !== undefined) {
      attemptData.characters_correct = Math.max(0, characters_correct);
    }

    if (characters_total !== null && characters_total !== undefined) {
      attemptData.characters_total = Math.max(0, characters_total);
    }

    const { data, error } = await authenticatedClient
      .from("transcription_attempts")
      .insert(attemptData)
      .select()
      .single();

    if (error) {
      console.error("Failed to track transcription attempt:", error);
      return NextResponse.json(
        { error: "Failed to track transcription attempt" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, attempt: data });
  } catch (error) {
    console.error("Transcription tracking error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
