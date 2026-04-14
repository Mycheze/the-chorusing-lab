/**
 * Session management for SSO authentication.
 *
 * Uses HMAC-SHA256 JWTs signed with SESSION_SECRET via Node.js crypto.
 * No external JWT library -- keeps the dependency footprint small and avoids
 * bundling issues in the Next.js edge/server split.
 */

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "chorusing_session";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface SessionPayload {
  userId: string; // UUID from profiles.id
  refoldId: number; // integer from profiles.refold_id
  email: string;
  username: string;
}

// ---------------------------------------------------------------------------
// Internal JWT helpers (HS256, Node.js crypto only)
// ---------------------------------------------------------------------------

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(input: string): Buffer {
  let str = input.replace(/-/g, "+").replace(/_/g, "/");
  // Pad with '=' to make length a multiple of 4
  while (str.length % 4 !== 0) {
    str += "=";
  }
  return Buffer.from(str, "base64");
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing required environment variable: SESSION_SECRET");
  }
  return secret;
}

function sign(headerPayload: string, secret: string): string {
  return base64UrlEncode(
    crypto.createHmac("sha256", secret).update(headerPayload).digest()
  );
}

/**
 * Create a signed JWT containing the given session payload.
 */
export function createSessionToken(payload: SessionPayload): string {
  const secret = getSessionSecret();

  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);

  const claims = {
    ...payload,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(claims));
  const headerPayload = `${encodedHeader}.${encodedPayload}`;
  const signature = sign(headerPayload, secret);

  return `${headerPayload}.${signature}`;
}

/**
 * Verify a JWT and return the session payload, or null if invalid/expired.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const secret = getSessionSecret();

    // Timing-safe signature comparison
    const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`, secret);
    const sigBuf = Buffer.from(encodedSignature);
    const expectedBuf = Buffer.from(expectedSignature);
    if (
      sigBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expectedBuf)
    ) {
      return null;
    }

    const claims = JSON.parse(base64UrlDecode(encodedPayload).toString("utf-8"));

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp && claims.exp < now) {
      return null;
    }

    return {
      userId: claims.userId,
      refoldId: claims.refoldId,
      email: claims.email,
      username: claims.username,
    };
  } catch {
    return null;
  }
}

/**
 * Read and verify the session from the request cookies.
 * Returns the session payload or null.
 */
export function getSession(request: NextRequest): SessionPayload | null {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME);
  if (!cookie?.value) return null;
  return verifySessionToken(cookie.value);
}

/**
 * Set the session JWT as an HTTP-only cookie on the response.
 */
export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * Clear the session cookie on the response.
 */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
