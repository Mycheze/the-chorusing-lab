// Server-side database layer using Supabase (simplified, no auth helpers)
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { User } from "@/types/auth";
import type { AudioClip, AudioFilters, AudioSort } from "@/types/audio";
import {
  convertAudioClipFromDb,
  convertAudioClipToDb,
  type SupabaseAudioClip,
} from "@/types/supabase";
import {
  getPublicUrl,
  deleteAudioFile,
  createAuthenticatedClient,
} from "@/lib/supabase";
import { isAdmin } from "@/lib/admin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please check your .env.local file."
  );
}

// Create client for server-side operations (using anon key for now)
const supabaseServer = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

class SupabaseDatabase {
  // Helper to get authenticated client with access token
  private getAuthenticatedClient(accessToken?: string) {
    if (accessToken) {
      return createAuthenticatedClient(accessToken);
    }
    return supabaseServer;
  }

  // Helper to check if a string is an email
  private isEmail(input: string): boolean {
    return input.includes("@") && input.includes(".");
  }

  // Helper to lookup user email by username
  async getUserEmailByUsername(username: string): Promise<string | null> {
    const { data: profile, error } = await supabaseServer
      .from("profiles")
      .select("email")
      .eq("username", username)
      .single();

    if (error || !profile) {
      return null;
    }

    return profile.email;
  }

  // Helper to get user profile by email
  async getUserByEmail(email: string): Promise<User | null> {
    const { data: profile, error } = await supabaseServer
      .from("profiles")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !profile) {
      return null;
    }

    return {
      id: profile.id,
      username: profile.username,
      email: profile.email,
      createdAt: profile.created_at,
    };
  }

  // Helper to get user profile by username
  async getUserByUsername(username: string): Promise<User | null> {
    const { data: profile, error } = await supabaseServer
      .from("profiles")
      .select("*")
      .eq("username", username)
      .single();

    if (error || !profile) {
      return null;
    }

    return {
      id: profile.id,
      username: profile.username,
      email: profile.email,
      createdAt: profile.created_at,
    };
  }

  // User methods
  async createUser(
    email: string,
    username: string,
    password: string
  ): Promise<User> {
    // Check if email already exists
    const existingUserByEmail = await this.getUserByEmail(email);
    if (existingUserByEmail) {
      throw new Error("Email already exists");
    }

    // Check if username already exists
    const existingUserByUsername = await this.getUserByUsername(username);
    if (existingUserByUsername) {
      throw new Error("Username already exists");
    }

    // Create user with Supabase Auth using the email
    const { data, error } = await supabaseServer.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          email,
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error("Failed to create user");
    }

    return {
      id: data.user.id,
      username,
      email,
      createdAt: data.user.created_at,
    };
  }

  async authenticateUser(
    emailOrUsername: string,
    password: string
  ): Promise<User> {
    let email: string;

    // Determine if input is email or username
    if (this.isEmail(emailOrUsername)) {
      email = emailOrUsername;
    } else {
      // Look up email by username
      const userEmail = await this.getUserEmailByUsername(emailOrUsername);
      if (!userEmail) {
        throw new Error("Invalid credentials");
      }
      email = userEmail;
    }

    // Sign in with email/password
    const { data, error } = await supabaseServer.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error("Invalid credentials");
    }

    if (!data.user) {
      throw new Error("Authentication failed");
    }

    // Get profile data
    const { data: profile, error: profileError } = await supabaseServer
      .from("profiles")
      .select("username, email")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("User profile not found");
    }

    return {
      id: data.user.id,
      username: profile.username,
      email: profile.email,
      createdAt: data.user.created_at,
    };
  }

  async getUserById(id: string): Promise<User | null> {
    const { data: profile, error } = await supabaseServer
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !profile) {
      return null;
    }

    return {
      id: profile.id,
      username: profile.username,
      email: profile.email,
      createdAt: profile.created_at,
    };
  }

  // Audio clip methods - NOW ACCEPT ACCESS TOKEN
  async createAudioClip(
    clip: Omit<SupabaseAudioClip, "id" | "createdAt" | "updatedAt">,
    accessToken?: string
  ): Promise<AudioClip> {
    const client = this.getAuthenticatedClient(accessToken);
    const dbClip = convertAudioClipToDb(clip);

    console.log("💾 Creating clip:", clip.title);
    console.log("💾 Uploaded by user ID:", clip.uploadedBy);
    console.log("💾 Has access token:", !!accessToken);

    // Verify the user exists before inserting (helps debug RLS issues)
    if (accessToken) {
      const {
        data: { user },
        error: userError,
      } = await client.auth.getUser();
      if (userError || !user) {
        console.error("❌ Cannot verify user with token:", userError?.message);
        throw new Error(
          `Authentication failed: ${userError?.message || "User not found"}`
        );
      }
      if (user.id !== clip.uploadedBy) {
        console.error("❌ User ID mismatch:", user.id, "vs", clip.uploadedBy);
        throw new Error(
          "User ID mismatch - cannot create clip for different user"
        );
      }
      console.log("✅ Verified user ID matches:", user.id);
    }

    const { data, error } = await client
      .from("audio_clips")
      .insert(dbClip)
      .select()
      .single();

    if (error) {
      console.error("❌ Database insert failed:", error);
      console.error("❌ Error code:", error.code);
      console.error("❌ Error details:", error.details);
      console.error("❌ Error hint:", error.hint);
      throw new Error(`Failed to create audio clip: ${error.message}`);
    }

    console.log("✅ Clip created:", data.id);
    const convertedClip = convertAudioClipFromDb(data);

    // Convert to legacy AudioClip format for compatibility
    return {
      id: convertedClip.id,
      title: convertedClip.title,
      duration: convertedClip.duration,
      filename: convertedClip.filename,
      originalFilename: convertedClip.originalFilename,
      fileSize: convertedClip.fileSize,
      metadata: convertedClip.metadata,
      uploadedBy: convertedClip.uploadedBy,
      createdAt: convertedClip.createdAt,
      updatedAt: convertedClip.updatedAt,
    };
  }

  async getAudioClips(
    filters?: AudioFilters,
    sort?: AudioSort,
    limit?: number,
    accessToken?: string
  ): Promise<AudioClip[]> {
    const client = this.getAuthenticatedClient(accessToken);
    let query = client.from("audio_clips").select("*");

    // Apply filters
    if (filters) {
      if (filters.language) {
        query = query.eq("language", filters.language);
      }
      if (filters.speakerGender) {
        query = query.eq("speaker_gender", filters.speakerGender);
      }
      if (filters.speakerAgeRange) {
        query = query.eq("speaker_age_range", filters.speakerAgeRange);
      }
      if (filters.uploadedBy) {
        query = query.eq("uploaded_by", filters.uploadedBy);
      }
      if (filters.tags && filters.tags.length > 0) {
        // Use overlap operator for array tags
        query = query.overlaps("tags", filters.tags);
      }
    }

    // Apply sorting
    if (sort) {
      const column = sort.field === "createdAt" ? "created_at" : sort.field;
      query = query.order(column, { ascending: sort.direction === "asc" });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    // Apply limit
    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch audio clips: ${error.message}`);
    }

    // Convert to legacy AudioClip format
    return data.map((row) => {
      const converted = convertAudioClipFromDb(row);
      return {
        id: converted.id,
        title: converted.title,
        duration: converted.duration,
        filename: converted.filename,
        originalFilename: converted.originalFilename,
        fileSize: converted.fileSize,
        metadata: converted.metadata,
        uploadedBy: converted.uploadedBy,
        createdAt: converted.createdAt,
        updatedAt: converted.updatedAt,
      };
    });
  }

  async getAudioClipById(
    id: string,
    accessToken?: string
  ): Promise<AudioClip | null> {
    const client = this.getAuthenticatedClient(accessToken);

    const { data, error } = await client
      .from("audio_clips")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }

    const converted = convertAudioClipFromDb(data);
    return {
      id: converted.id,
      title: converted.title,
      duration: converted.duration,
      filename: converted.filename,
      originalFilename: converted.originalFilename,
      fileSize: converted.fileSize,
      metadata: converted.metadata,
      uploadedBy: converted.uploadedBy,
      createdAt: converted.createdAt,
      updatedAt: converted.updatedAt,
    };
  }

  async deleteAudioClip(
    id: string,
    userId: string,
    accessToken?: string
  ): Promise<boolean> {
    const client = this.getAuthenticatedClient(accessToken);

    // First get the clip to check ownership and get storage path
    const { data: clip, error: fetchError } = await client
      .from("audio_clips")
      .select("uploaded_by, storage_path")
      .eq("id", id)
      .single();

    if (fetchError || !clip) {
      return false;
    }

    // Check if user owns this clip or is an admin
    if (clip.uploaded_by !== userId && !isAdmin(userId)) {
      throw new Error("Unauthorized to delete this clip");
    }

    // Delete from database
    const { error: deleteError, data: deleteData } = await client
      .from("audio_clips")
      .delete()
      .eq("id", id)
      .select();

    if (deleteError) {
      console.error("Delete clip database error:", deleteError);
      console.error("Error details:", {
        code: deleteError.code,
        message: deleteError.message,
        details: deleteError.details,
        hint: deleteError.hint,
      });
      // If it's an RLS/permission error, provide more context
      if (
        deleteError.message?.includes("permission") ||
        deleteError.message?.includes("policy") ||
        deleteError.code === "42501" ||
        deleteError.code === "PGRST301"
      ) {
        throw new Error(
          `Database permission error (RLS policy may be blocking admin operations): ${deleteError.message}`
        );
      }
      throw new Error(`Failed to delete clip: ${deleteError.message}`);
    }

    // Check if anything was actually deleted
    if (!deleteData || deleteData.length === 0) {
      console.warn("Delete operation returned no deleted rows");
      throw new Error(
        "No rows were deleted - clip may not exist or you may not have permission"
      );
    }

    // Delete file from storage (don't fail if file doesn't exist)
    try {
      const authClient = accessToken
        ? this.getAuthenticatedClient(accessToken)
        : undefined;
      await deleteAudioFile(clip.storage_path, authClient);
    } catch (error) {
      console.warn(`Could not delete file ${clip.storage_path}:`, error);
    }

    return true;
  }

  async updateAudioClip(
    id: string,
    updates: Partial<Pick<AudioClip, "title" | "metadata">>,
    accessToken?: string,
    userId?: string
  ): Promise<AudioClip | null> {
    const client = this.getAuthenticatedClient(accessToken);

    // If userId is not provided, try to get it from accessToken
    let resolvedUserId: string | null = userId || null;
    if (!resolvedUserId && accessToken) {
      try {
        const authenticatedClient = createAuthenticatedClient(accessToken);
        const {
          data: { user },
        } = await authenticatedClient.auth.getUser();
        if (user) resolvedUserId = user.id;
      } catch (error) {
        console.warn("Failed to get user from access token:", error);
        return null;
      }
    }

    // First get the clip to check ownership (if we have userId)
    // Note: We still fetch to verify the clip exists, but ownership is checked at API level
    const { data: clip, error: fetchError } = await client
      .from("audio_clips")
      .select("uploaded_by")
      .eq("id", id)
      .single();

    if (fetchError || !clip) {
      console.error("Failed to fetch clip for update:", fetchError);
      return null;
    }

    // Check if user owns this clip or is an admin (if we have userId)
    if (
      resolvedUserId &&
      clip.uploaded_by !== resolvedUserId &&
      !isAdmin(resolvedUserId)
    ) {
      throw new Error("Unauthorized to update this clip");
    }

    // Convert updates to database format
    const dbUpdates: any = {};

    if (updates.title) {
      dbUpdates.title = updates.title;
    }

    if (updates.metadata) {
      if (updates.metadata.language)
        dbUpdates.language = updates.metadata.language;
      if (updates.metadata.speakerGender !== undefined)
        dbUpdates.speaker_gender = updates.metadata.speakerGender;
      if (updates.metadata.speakerAgeRange !== undefined)
        dbUpdates.speaker_age_range = updates.metadata.speakerAgeRange;
      if (updates.metadata.speakerDialect !== undefined)
        dbUpdates.speaker_dialect = updates.metadata.speakerDialect;
      if (updates.metadata.transcript !== undefined)
        dbUpdates.transcript = updates.metadata.transcript;
      if (updates.metadata.sourceUrl !== undefined)
        dbUpdates.source_url = updates.metadata.sourceUrl;
      if (updates.metadata.tags !== undefined)
        dbUpdates.tags = updates.metadata.tags;
    }

    const { data, error } = await client
      .from("audio_clips")
      .update(dbUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update clip database error:", error);
      console.error("Error details:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      // If it's an RLS/permission error, throw it so it can be handled properly
      if (
        error.message?.includes("permission") ||
        error.message?.includes("policy") ||
        error.code === "42501" ||
        error.code === "PGRST301"
      ) {
        throw new Error(
          `Database permission error (RLS policy may be blocking admin operations): ${error.message}`
        );
      }
      return null;
    }

    if (!data) {
      console.warn("Update clip returned no data");
      return null;
    }

    const converted = convertAudioClipFromDb(data);
    return {
      id: converted.id,
      title: converted.title,
      duration: converted.duration,
      filename: converted.filename,
      originalFilename: converted.originalFilename,
      fileSize: converted.fileSize,
      metadata: converted.metadata,
      uploadedBy: converted.uploadedBy,
      createdAt: converted.createdAt,
      updatedAt: converted.updatedAt,
    };
  }

  // Star methods
  async starClip(
    clipId: string,
    userId: string,
    accessToken?: string
  ): Promise<boolean> {
    const client = this.getAuthenticatedClient(accessToken);

    const { error } = await client.from("clip_stars").insert({
      clip_id: clipId,
      user_id: userId,
    });

    // Return false if already starred (unique constraint violation)
    if (error) {
      if (error.code === "23505") {
        // Unique constraint violation
        return false;
      }
      throw new Error(`Failed to star clip: ${error.message}`);
    }

    return true;
  }

  async unstarClip(
    clipId: string,
    userId: string,
    accessToken?: string
  ): Promise<boolean> {
    const client = this.getAuthenticatedClient(accessToken);

    const { error } = await client
      .from("clip_stars")
      .delete()
      .eq("clip_id", clipId)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to unstar clip: ${error.message}`);
    }

    return true;
  }

  async getClipStars(clipId: string, accessToken?: string): Promise<string[]> {
    const client = this.getAuthenticatedClient(accessToken);

    const { data, error } = await client
      .from("clip_stars")
      .select("user_id")
      .eq("clip_id", clipId);

    if (error) {
      throw new Error(`Failed to get clip stars: ${error.message}`);
    }

    return data.map((star) => star.user_id);
  }

  async getUserStarredClips(
    userId: string,
    accessToken?: string
  ): Promise<string[]> {
    const client = this.getAuthenticatedClient(accessToken);

    const { data, error } = await client
      .from("clip_stars")
      .select("clip_id")
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to get user starred clips: ${error.message}`);
    }

    return data.map((star) => star.clip_id);
  }
}

export const serverDb = new SupabaseDatabase();
