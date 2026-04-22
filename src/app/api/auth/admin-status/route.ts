import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = getSession(request);

    if (!session) {
      return NextResponse.json({ isAdmin: false }, { status: 200 });
    }

    const adminStatus = isAdmin(session.refoldId);

    return NextResponse.json({
      isAdmin: adminStatus,
    });
  } catch (error) {
    console.error("Admin status check error:", error);
    return NextResponse.json({ isAdmin: false }, { status: 200 });
  }
}
