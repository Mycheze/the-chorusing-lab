import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const language = searchParams.get("language");

    if (!language) {
      return NextResponse.json(
        { error: "Language parameter is required" },
        { status: 400 }
      );
    }

    // Get distinct dialects for the specified language
    const { data, error } = await supabase
      .from("audio_clips")
      .select("speaker_dialect")
      .eq("language", language)
      .not("speaker_dialect", "is", null);

    if (error) {
      console.error("Failed to fetch dialects:", error);
      return NextResponse.json(
        { error: "Failed to fetch dialects" },
        { status: 500 }
      );
    }

    // Extract unique dialects and sort them
    const dialects = Array.from(
      new Set(
        (data || [])
          .map((row) => row.speaker_dialect)
          .filter((dialect): dialect is string => !!dialect)
      )
    ).sort();

    return NextResponse.json({ dialects });
  } catch (error) {
    console.error("Get dialects error:", error);
    return NextResponse.json(
      { error: "Failed to get dialects" },
      { status: 500 }
    );
  }
}
