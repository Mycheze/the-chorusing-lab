import { NextRequest, NextResponse } from "next/server";
import { serverDb } from "@/lib/server-database";

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

    const dialects = await serverDb.getDistinctDialects(language);

    return NextResponse.json({ dialects });
  } catch (error) {
    console.error("Get dialects error:", error);
    return NextResponse.json(
      { error: "Failed to get dialects" },
      { status: 500 }
    );
  }
}
