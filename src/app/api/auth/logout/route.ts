import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://chorusing.app";
  const response = NextResponse.redirect(appUrl);
  clearSessionCookie(response);
  return response;
}
