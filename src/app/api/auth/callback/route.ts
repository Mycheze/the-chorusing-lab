import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  createSessionToken,
  setSessionCookie,
  type SessionPayload,
} from "@/lib/session";

export const dynamic = "force-dynamic";

const NONCE_COOKIE_NAME = "chorusing_sso_nonce";

/** Minimal profile shape returned by Supabase queries. */
interface ProfileRecord {
  id: string;
  refold_id: number | null;
  username: string;
  email: string;
  created_at: string;
  updated_at: string;
}

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.NODE_ENV === "production" && !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required in production");
  }
  const key = serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }
  // Use an untyped client to avoid the pre-existing `never` type issues with
  // the generated Database type and the current Supabase client version.
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://chorusing.app";

  try {
    const ssoSecret = process.env.CHORUSING_SSO_SECRET;
    if (!ssoSecret) {
      return NextResponse.redirect(`${appUrl}/?error=sso_not_configured`);
    }

    // ---- Extract query parameters ----
    const { searchParams } = new URL(request.url);
    const payload = searchParams.get("payload");
    const sig = searchParams.get("sig");

    if (!payload || !sig) {
      return NextResponse.redirect(`${appUrl}/?error=missing_sso_params`);
    }

    // ---- Verify HMAC-SHA256 signature (timing-safe) ----
    const expectedSig = crypto
      .createHmac("sha256", ssoSecret)
      .update(payload)
      .digest("hex");

    const sigBuffer = Buffer.from(sig, "hex");
    const expectedBuffer = Buffer.from(expectedSig, "hex");

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      return NextResponse.redirect(`${appUrl}/?error=invalid_signature`);
    }

    // ---- Decode payload ----
    const decoded = Buffer.from(payload, "base64").toString("utf-8");
    const params = new URLSearchParams(decoded);

    const nonce = params.get("nonce");
    const externalId = params.get("external_id");
    const email = params.get("email");
    const name = params.get("name");

    if (!nonce || !externalId || !email) {
      return NextResponse.redirect(`${appUrl}/?error=incomplete_sso_data`);
    }

    // ---- Verify nonce matches cookie ----
    const storedNonce = request.cookies.get(NONCE_COOKIE_NAME)?.value;
    if (!storedNonce || storedNonce !== nonce) {
      return NextResponse.redirect(`${appUrl}/?error=invalid_nonce`);
    }

    // ---- Find or create user ----
    const refoldId = parseInt(externalId, 10);
    if (isNaN(refoldId)) {
      return NextResponse.redirect(`${appUrl}/?error=invalid_external_id`);
    }

    const username = name || `user_${refoldId}`;
    const db = getSupabaseServer();

    // Atomic find-or-create via upsert on refold_id (unique constraint).
    // If a row with this refold_id already exists it gets updated;
    // otherwise a new row is inserted. This eliminates the read-then-write
    // race condition.
    const { data: upserted } = await db
      .from("profiles")
      .upsert(
        {
          id: crypto.randomUUID(), // ignored on conflict (existing id kept)
          refold_id: refoldId,
          email,
          username,
        },
        { onConflict: "refold_id", ignoreDuplicates: false }
      )
      .select("*")
      .single();

    const profile: ProfileRecord | null = upserted as ProfileRecord | null;

    if (!profile) {
      return NextResponse.redirect(`${appUrl}/?error=profile_creation_failed`);
    }

    // ---- Create session ----
    const sessionPayload: SessionPayload = {
      userId: profile.id,
      refoldId,
      email,
      username: profile.username ?? username,
    };

    const token = createSessionToken(sessionPayload);

    // Build redirect response, set session cookie, clear nonce cookie
    const response = NextResponse.redirect(appUrl);
    setSessionCookie(response, token);
    response.cookies.set(NONCE_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("SSO callback error:", error);
    return NextResponse.redirect(`${appUrl}/?error=sso_callback_failed`);
  }
}
