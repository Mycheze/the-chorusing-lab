import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseService } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// UUID v4 format validation
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const {
      session_id,
      clip_id,
      time_seconds,
      loop_count,
      restart_count,
      language,
      started_at,
      ended_at,
    } = body;

    // Validate required fields
    if (!clip_id || typeof time_seconds !== "number" || time_seconds < 0) {
      return NextResponse.json(
        { error: "Missing or invalid required fields: clip_id, time_seconds" },
        { status: 400 },
      );
    }

    if (!language) {
      return NextResponse.json(
        { error: "Missing required field: language" },
        { status: 400 },
      );
    }

    // Validate session_id format if provided
    if (session_id && !UUID_REGEX.test(session_id)) {
      return NextResponse.json(
        { error: "Invalid session_id format" },
        { status: 400 },
      );
    }

    const sessionData: Record<string, unknown> = {
      user_id: session.userId,
      clip_id,
      total_time_seconds: Math.max(0, time_seconds),
      loop_count: Math.max(0, loop_count || 0),
      restart_count: Math.max(0, restart_count || 0),
      language,
    };

    if (session_id) {
      sessionData.id = session_id;
    }

    if (started_at) {
      sessionData.started_at = started_at;
    }

    if (ended_at) {
      sessionData.ended_at = ended_at;
    }

    // Upsert if session_id provided (updates existing session), otherwise insert new
    const query = session_id
      ? supabaseService
          .from("clip_sessions")
          .upsert(sessionData, { onConflict: "id" })
          .select()
          .single()
      : supabaseService
          .from("clip_sessions")
          .insert(sessionData)
          .select()
          .single();

    const { data, error } = await query;

    if (error) {
      console.error("Failed to track session:", error);
      return NextResponse.json(
        { error: "Failed to track session" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, session: data });
  } catch (error) {
    console.error("Session tracking error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
