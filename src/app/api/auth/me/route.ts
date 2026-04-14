import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = getSession(request);

  if (!session) {
    return NextResponse.json({ user: null });
  }

  const admin = isAdmin(session.refoldId);

  return NextResponse.json({
    user: {
      id: session.userId,
      refoldId: session.refoldId,
      username: session.username,
      email: session.email,
      isAdmin: admin,
    },
  });
}
