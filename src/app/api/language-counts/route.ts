import { NextResponse } from "next/server";
import { serverDb } from "@/lib/server-database";
import { canonicalizeLanguage } from "@/lib/language";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Fetch all clips without filters to get total language counts
    const clips = await serverDb.getAudioClips(
      {},
      { field: "createdAt", direction: "desc" },
    );

    const counts: Record<string, number> = {};
    for (const clip of clips) {
      const lang = canonicalizeLanguage(clip.metadata.language);
      if (lang) {
        counts[lang] = (counts[lang] || 0) + 1;
      }
    }

    return NextResponse.json({ counts });
  } catch (error) {
    console.error("Language counts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch language counts" },
      { status: 500 },
    );
  }
}
