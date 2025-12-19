import { NextRequest, NextResponse } from "next/server";
import { serverDb } from "@/lib/server-database";
import { unlink } from "fs/promises";
import path from "path";
import type { AudioMetadata } from "@/types/audio";
import { createClient } from "@supabase/supabase-js";
import { createAuthenticatedClient } from "@/lib/supabase";
import type { Database } from "@/types/supabase";
import { isAdmin } from "@/lib/admin";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    // Get user from auth header
    let userId: string | null = null;
    let accessToken: string | null = null;
    const authHeader = request.headers.get("Authorization");

    if (authHeader && authHeader.startsWith("Bearer ")) {
      accessToken = authHeader.substring(7);
      const authenticatedClient = createAuthenticatedClient(accessToken);

      const {
        data: { user },
      } = await authenticatedClient.auth.getUser();
      if (user) userId = user.id;
    }

    if (!userId || !accessToken) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, metadata } = body;

    // Validate required fields
    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!metadata?.language) {
      return NextResponse.json(
        { error: "Language is required" },
        { status: 400 }
      );
    }

    // Get the clip first to check ownership
    const clip = await serverDb.getAudioClipById(id, accessToken);

    if (!clip) {
      return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    }

    // Check if user owns this clip or is an admin
    if (clip.uploadedBy !== userId && !isAdmin(userId)) {
      return NextResponse.json(
        { error: "Unauthorized to edit this clip" },
        { status: 403 }
      );
    }

    // Prepare clean metadata
    const cleanMetadata: AudioMetadata = {
      language: metadata.language,
      speakerGender: metadata.speakerGender || undefined,
      speakerAgeRange: metadata.speakerAgeRange || undefined,
      speakerDialect: metadata.speakerDialect?.trim() || undefined,
      transcript: metadata.transcript?.trim() || undefined,
      sourceUrl: metadata.sourceUrl?.trim() || undefined,
      tags: Array.isArray(metadata.tags)
        ? metadata.tags.filter(Boolean)
        : typeof metadata.tags === "string"
        ? metadata.tags
            .split(",")
            .map((tag: string) => tag.trim())
            .filter(Boolean)
        : [],
    };

    try {
      const updatedClip = await serverDb.updateAudioClip(
        id,
        {
          title: title.trim(),
          metadata: cleanMetadata,
        },
        accessToken,
        userId
      );

      if (!updatedClip) {
        return NextResponse.json({ error: "Clip not found" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        clip: updatedClip,
      });
    } catch (updateError: any) {
      console.error("Update clip error in catch block:", updateError);
      // If updateAudioClip throws an error (e.g., unauthorized), handle it
      if (updateError.message?.includes("Unauthorized")) {
        return NextResponse.json(
          { error: "Unauthorized to edit this clip" },
          { status: 403 }
        );
      }
      // If it's a database permission error, provide helpful message
      if (updateError.message?.includes("Database permission error")) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 403 }
        );
      }
      // Re-throw other errors to be caught by outer try-catch
      throw updateError;
    }
  } catch (error) {
    console.error("Update clip error:", error);
    return NextResponse.json(
      { error: "Failed to update clip" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    // Get user from auth header
    let userId: string | null = null;
    let accessToken: string | null = null;
    const authHeader = request.headers.get("Authorization");

    if (authHeader && authHeader.startsWith("Bearer ")) {
      accessToken = authHeader.substring(7);
      const authenticatedClient = createAuthenticatedClient(accessToken);

      const {
        data: { user },
      } = await authenticatedClient.auth.getUser();
      if (user) userId = user.id;
    }

    if (!userId || !accessToken) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get the clip first to check ownership and get filename
    const clip = await serverDb.getAudioClipById(id, accessToken);

    if (!clip) {
      return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    }

    // Check if user owns this clip or is an admin
    if (clip.uploadedBy !== userId && !isAdmin(userId)) {
      return NextResponse.json(
        { error: "Unauthorized to delete this clip" },
        { status: 403 }
      );
    }

    // Delete from database first
    try {
      const deleted = await serverDb.deleteAudioClip(id, userId, accessToken);

      if (!deleted) {
        return NextResponse.json(
          { error: "Failed to delete clip from database" },
          { status: 500 }
        );
      }
    } catch (deleteError: any) {
      console.error("Delete clip error in catch block:", deleteError);
      // If deleteAudioClip throws an error (e.g., unauthorized), handle it
      if (deleteError.message?.includes("Unauthorized")) {
        return NextResponse.json(
          { error: "Unauthorized to delete this clip" },
          { status: 403 }
        );
      }
      // If it's a database permission error, provide helpful message
      if (deleteError.message?.includes("Database permission error")) {
        return NextResponse.json(
          { error: deleteError.message },
          { status: 403 }
        );
      }
      // Re-throw other errors to be caught by outer try-catch
      throw deleteError;
    }

    // Try to delete the physical file (don't fail if file doesn't exist)
    try {
      const filePath = path.join(UPLOAD_DIR, clip.filename);
      await unlink(filePath);
      console.log(`Deleted file: ${clip.filename}`);
    } catch (fileError) {
      // Log but don't fail - file might already be deleted or not exist
      console.warn(`Could not delete file ${clip.filename}:`, fileError);
    }

    return NextResponse.json({
      success: true,
      message: "Clip deleted successfully",
    });
  } catch (error) {
    console.error("Delete clip error:", error);
    return NextResponse.json(
      { error: "Failed to delete clip" },
      { status: 500 }
    );
  }
}
