import { NextResponse } from "next/server";
import { createSessionToken, setSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const token = createSessionToken({
    userId: "00000000-0000-0000-0000-000000000000",
    refoldId: 999999,
    email: "dev@localhost",
    username: "Dev Admin",
  });

  const response = NextResponse.json({ success: true });
  setSessionCookie(response, token);
  return response;
}
