import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const NONCE_COOKIE_NAME = "chorusing_sso_nonce";
const NONCE_MAX_AGE_SECONDS = 10 * 60; // 10 minutes

export async function GET(request: NextRequest) {
  try {
    const ssoSecret = process.env.CHORUSING_SSO_SECRET;
    const refoldSsoUrl = process.env.REFOLD_SSO_URL;
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://chorusing.app";

    if (!ssoSecret || !refoldSsoUrl) {
      return NextResponse.json(
        { error: "SSO is not configured" },
        { status: 500 }
      );
    }

    // Generate cryptographically random nonce (32 hex chars)
    const nonce = crypto.randomBytes(16).toString("hex");

    // Build callback URL
    const callbackUrl = `${appUrl}/api/auth/callback`;

    // Build payload
    const rawPayload = `nonce=${nonce}&return_url=${encodeURIComponent(callbackUrl)}`;
    const base64Payload = Buffer.from(rawPayload).toString("base64");

    // Sign payload with HMAC-SHA256
    const sig = crypto
      .createHmac("sha256", ssoSecret)
      .update(base64Payload)
      .digest("hex");

    // Build redirect URL
    const ssoUrl = `${refoldSsoUrl}?payload=${encodeURIComponent(base64Payload)}&sig=${sig}`;

    // Redirect to Refold SSO, storing nonce in a short-lived HTTP-only cookie
    const response = NextResponse.redirect(ssoUrl);
    response.cookies.set(NONCE_COOKIE_NAME, nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: NONCE_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    console.error("SSO initiation error:", error);
    return NextResponse.json(
      { error: "Failed to initiate SSO" },
      { status: 500 }
    );
  }
}
