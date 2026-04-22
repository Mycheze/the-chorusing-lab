// Server-side database layer using Supabase (simplified, no auth helpers)
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { User } from "@/types/auth";
import type {
  AudioClip,
  AudioFilters,
  AudioSort,
  FilterPreferences,
} from "@/types/audio";
import {
  convertAudioClipFromDb,
  convertAudioClipToDb,
  type SupabaseAudioClip,
} from "@/types/supabase";
import {
  getPublicUrl,
  deleteAudioFile,
  createAuthenticatedClient,
  verifyAccessToken,
} from "@/lib/supabase";
import { isAdmin } from "@/lib/admin";
import { supabaseMonitor } from "@/lib/supabase-monitor";
import { retryWithBackoff, isTransientError } from "@/lib/api-utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please check your .env.local file.",
  );
}

// Track server client instance
const serverClientId = supabaseMonitor.registerClient("server");

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
      const client = createAuthenticatedClient(accessToken);
      supabaseMonitor.updateClientUsage(serverClientId);
      return client;
    }
    supabaseMonitor.updateClientUsage(serverClientId);
    return supabaseServer;
  }

  // Helper to wrap database operations with monitoring and retry logic
  private async monitorDbOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    options: { retry?: boolean } = {},
  ): Promise<T> {
    const requestId = supabaseMonitor.startRequest("database", operation);
    const timeoutMs = 30000; // 30 seconds
    const shouldRetry = options.retry !== false; // Default to true

    const executeOperation = async (): Promise<T> => {
      return Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => {
            supabaseMonitor.timeoutRequest(requestId, timeoutMs);
            reject(new Error("Operation timeout"));
          }, timeoutMs),
        ),
      ]);
    };

    try {
      const result = shouldRetry
        ? await retryWithBackoff(executeOperation, {
            maxRetries: 2, // Retry up to 2 times (3 total attempts)
            initialDelayMs: 500,
            maxDelayMs: 5000,
            onRetry: (attempt, error) => {
              console.warn(
                `Retrying ${operation} (attempt ${attempt}):`,
                error?.message,
              );
            },
          })
        : await executeOperation();

      const duration =
        Date.now() -
          (supabaseMonitor as any).inFlightRequests.get(requestId)?.startTime ||
        0;
      supabaseMonitor.completeRequest(requestId, {
        type: "database",
        operation,
        duration,
        status: "success",
        responseSize: JSON.stringify(result).length,
      });
      return result;
    } catch (error: any) {
      const inFlight = (supabaseMonitor as any).inFlightRequests.get(requestId);
      const duration = inFlight ? Date.now() - inFlight.startTime : 0;
      const isTimeout = error?.message === "Operation timeout";

      if (!isTimeout) {
        // Only complete if not already timed out
        supabaseMonitor.completeRequest(requestId, {
          type: "database",
          operation,
          duration,
          status: "failure",
          error: error?.message || "Unknown error",
          errorCode: error?.code || error?.statusCode?.toString(),
        });
      }
      throw error;
    }
  }

  // Helper to check if a string is an email
  private isEmail(input: string): boolean {
    return input.includes("@") && input.includes(".");
  }

  // Helper to lookup user email by username
  async getUserEmailByUsername(username: string): Promise<string | null> {
    return this.monitorDbOperation("getUserEmailByUsername", async () => {
      const { data: profile, error } = await supabaseServer
        .from("profiles")
        .select("email")
        .eq("username", username)
        .single();

      if (error || !profile) {
        return null;
      }

      return profile.email;
    });
  }

  // Helper to get user profile by email
  async getUserByEmail(email: string): Promise<User | null> {
    return this.monitorDbOperation("getUserByEmail", async () => {
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
    });
  }

  // Helper to get user profile by username
  async getUserByUsername(username: string): Promise<User | null> {
    return this.monitorDbOperation("getUserByUsername", async () => {
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
    });
  }

  // User methods
  async createUser(
    email: string,
    username: string,
    password: string,
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
    password: string,
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
    return this.monitorDbOperation("getUserById", async () => {
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
    });
  }

  // Audio clip methods - NOW ACCEPT ACCESS TOKEN
  async createAudioClip(
    clip: Omit<SupabaseAudioClip, "id" | "createdAt" | "updatedAt">,
    accessToken?: string,
  ): Promise<AudioClip> {
    return this.monitorDbOperation("createAudioClip", async () => {
      const client = this.getAuthenticatedClient(accessToken);
      const dbClip = convertAudioClipToDb(clip);

      console.log("💾 Creating clip:", clip.title);
      console.log("💾 Uploaded by user ID:", clip.uploadedBy);
      console.log("💾 Has access token:", !!accessToken);

      // Verify the user exists before inserting (helps debug RLS issues)
      if (accessToken) {
        // Verify token using standard client (no custom storage)
        const { user, error: userError } = await verifyAccessToken(accessToken);
        if (userError || !user) {
          console.error(
            "❌ Cannot verify user with token:",
            userError?.message,
          );
          throw new Error(
            `Authentication failed: ${userError?.message || "User not found"}`,
          );
        }
        if (user.id !== clip.uploadedBy) {
          console.error("❌ User ID mismatch:", user.id, "vs", clip.uploadedBy);
          throw new Error(
            "User ID mismatch - cannot create clip for different user",
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
    });
  }

  async getAudioClips(
    filters?: AudioFilters,
    sort?: AudioSort,
    limit?: number,
    accessToken?: string,
  ): Promise<AudioClip[]> {
    return this.monitorDbOperation("getAudioClips", async () => {
      const client = this.getAuthenticatedClient(accessToken);
      // Note: Using select("*") because we need all columns for conversion
      // Ensure database has indexes on: language, speaker_gender, speaker_age_range,
      // speaker_dialect, uploaded_by, created_at, and tags (GIN index for array operations)
      let query = client.from("audio_clips").select("*");

      // Apply filters (order matters for query optimization - most selective first)
      if (filters) {
        // Single-value filters (most selective)
        if (filters.uploadedBy) {
          query = query.eq("uploaded_by", filters.uploadedBy);
        }
        if (filters.language) {
          query = query.eq("language", filters.language);
        }
        if (filters.speakerGender) {
          query = query.eq("speaker_gender", filters.speakerGender);
        }
        if (filters.speakerAgeRange) {
          query = query.eq("speaker_age_range", filters.speakerAgeRange);
        }
        if (filters.speakerDialect) {
          query = query.eq("speaker_dialect", filters.speakerDialect);
        }
        // Array filter (less selective, apply last)
        if (filters.tags && filters.tags.length > 0) {
          // Use overlap operator for array tags (requires GIN index on tags column)
          query = query.overlaps("tags", filters.tags);
        }
      }

      // Apply sorting (ensure index exists on sort column)
      if (sort) {
        const column = sort.field === "createdAt" ? "created_at" : sort.field;
        query = query.order(column, { ascending: sort.direction === "asc" });
      } else {
        // Default sort by created_at (should have index)
        query = query.order("created_at", { ascending: false });
      }

      // Apply limit to reduce data transfer
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
    });
  }

  async getAudioClipById(
    id: string,
    accessToken?: string,
  ): Promise<AudioClip | null> {
    return this.monitorDbOperation("getAudioClipById", async () => {
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
    });
  }

  async deleteAudioClip(
    id: string,
    userId: string,
    accessToken?: string,
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
          `Database permission error (RLS policy may be blocking admin operations): ${deleteError.message}`,
        );
      }
      throw new Error(`Failed to delete clip: ${deleteError.message}`);
    }

    // Check if anything was actually deleted
    if (!deleteData || deleteData.length === 0) {
      console.warn("Delete operation returned no deleted rows");
      throw new Error(
        "No rows were deleted - clip may not exist or you may not have permission",
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
    userId?: string,
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
          `Database permission error (RLS policy may be blocking admin operations): ${error.message}`,
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
    accessToken?: string,
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
    accessToken?: string,
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
    try {
      const client = this.getAuthenticatedClient(accessToken);

      const { data, error } = await client
        .from("clip_stars")
        .select("user_id")
        .eq("clip_id", clipId);

      if (error) {
        // If it's a connection/timeout error, return empty array instead of throwing
        if (
          error.message?.includes("fetch failed") ||
          error.message?.includes("timeout") ||
          error.message?.includes("ECONNREFUSED")
        ) {
          console.warn(
            `Connection error getting stars for clip ${clipId}:`,
            error.message,
          );
          return [];
        }
        throw new Error(`Failed to get clip stars: ${error.message}`);
      }

      return data.map((star) => star.user_id);
    } catch (error: any) {
      // Handle connection errors gracefully
      if (
        error?.message?.includes("fetch failed") ||
        error?.message?.includes("timeout") ||
        error?.message?.includes("ECONNREFUSED") ||
        error?.code === "UND_ERR_CONNECT_TIMEOUT"
      ) {
        console.warn(
          `Connection error getting stars for clip ${clipId}:`,
          error.message,
        );
        return [];
      }
      throw error;
    }
  }

  async getUserStarredClips(
    userId: string,
    accessToken?: string,
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

  // Batch methods for efficient querying
  async getClipStarsBatch(
    clipIds: string[],
    accessToken?: string,
  ): Promise<Map<string, string[]>> {
    return this.monitorDbOperation("getClipStarsBatch", async () => {
      if (clipIds.length === 0) {
        return new Map();
      }

      try {
        const client = this.getAuthenticatedClient(accessToken);

        const { data, error } = await client
          .from("clip_stars")
          .select("clip_id, user_id")
          .in("clip_id", clipIds);

        if (error) {
          // If it's a connection/timeout error, return empty map instead of throwing
          if (
            error.message?.includes("fetch failed") ||
            error.message?.includes("timeout") ||
            error.message?.includes("ECONNREFUSED")
          ) {
            console.warn(
              `Connection error getting stars batch:`,
              error.message,
            );
            return new Map();
          }
          throw new Error(`Failed to get clip stars batch: ${error.message}`);
        }

        // Group by clip_id
        const starsMap = new Map<string, string[]>();
        for (const clipId of clipIds) {
          starsMap.set(clipId, []);
        }

        if (data) {
          for (const star of data) {
            const existing = starsMap.get(star.clip_id) || [];
            existing.push(star.user_id);
            starsMap.set(star.clip_id, existing);
          }
        }

        return starsMap;
      } catch (error: any) {
        // Handle connection errors gracefully
        if (
          error?.message?.includes("fetch failed") ||
          error?.message?.includes("timeout") ||
          error?.message?.includes("ECONNREFUSED") ||
          error?.code === "UND_ERR_CONNECT_TIMEOUT"
        ) {
          console.warn(`Connection error getting stars batch:`, error.message);
          return new Map();
        }
        throw error;
      }
    });
  }

  // Difficulty rating methods
  async rateClipDifficulty(
    clipId: string,
    userId: string,
    rating: number,
    accessToken?: string,
  ): Promise<boolean> {
    return this.monitorDbOperation("rateClipDifficulty", async () => {
      const client = this.getAuthenticatedClient(accessToken);

      // Validate rating
      if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
        throw new Error("Rating must be an integer between 1 and 5");
      }

      // Use upsert to update if exists, insert if not
      const { error } = await client.from("clip_difficulty_ratings").upsert(
        {
          clip_id: clipId,
          user_id: userId,
          rating: rating,
        },
        {
          onConflict: "clip_id,user_id",
        },
      );

      if (error) {
        throw new Error(`Failed to rate clip difficulty: ${error.message}`);
      }

      return true;
    });
  }

  async removeDifficultyRating(
    clipId: string,
    userId: string,
    accessToken?: string,
  ): Promise<boolean> {
    return this.monitorDbOperation("removeDifficultyRating", async () => {
      const client = this.getAuthenticatedClient(accessToken);

      const { error } = await client
        .from("clip_difficulty_ratings")
        .delete()
        .eq("clip_id", clipId)
        .eq("user_id", userId);

      if (error) {
        throw new Error(`Failed to remove difficulty rating: ${error.message}`);
      }

      return true;
    });
  }

  async getClipDifficultyRating(
    clipId: string,
    accessToken?: string,
  ): Promise<{
    average: number | null;
    count: number;
    userRating: number | null;
  }> {
    return this.monitorDbOperation("getClipDifficultyRating", async () => {
      try {
        const client = this.getAuthenticatedClient(accessToken);

        const { data, error } = await client
          .from("clip_difficulty_ratings")
          .select("rating, user_id")
          .eq("clip_id", clipId);

        // If table doesn't exist (migration not run), return defaults
        if (error) {
          if (
            error.message?.includes("does not exist") ||
            error.code === "42P01"
          ) {
            console.warn(
              "clip_difficulty_ratings table does not exist. Migration may not have been run.",
            );
            return { average: null, count: 0, userRating: null };
          }
          throw new Error(
            `Failed to get clip difficulty rating: ${error.message}`,
          );
        }

        if (!data || data.length === 0) {
          return { average: null, count: 0, userRating: null };
        }

        // Get user ID if authenticated
        let userId: string | null = null;
        if (accessToken) {
          const { user } = await verifyAccessToken(accessToken);
          userId = user?.id || null;
        }

        const ratings = data.map((r) => r.rating);
        const average = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
        const userRating = userId
          ? data.find((r) => r.user_id === userId)?.rating || null
          : null;

        return {
          average: Math.round(average * 10) / 10, // Round to 1 decimal
          count: ratings.length,
          userRating: userRating || null,
        };
      } catch (error: any) {
        // Fallback for any unexpected errors (table doesn't exist, connection issues, etc.)
        if (
          error?.message?.includes("does not exist") ||
          error?.code === "42P01"
        ) {
          console.warn(
            "clip_difficulty_ratings table does not exist. Migration may not have been run.",
          );
          return { average: null, count: 0, userRating: null };
        }
        // Handle connection errors gracefully
        if (
          error?.message?.includes("fetch failed") ||
          error?.message?.includes("timeout") ||
          error?.message?.includes("ECONNREFUSED") ||
          error?.code === "UND_ERR_CONNECT_TIMEOUT"
        ) {
          console.warn(
            "Connection error getting difficulty rating:",
            error.message,
          );
          return { average: null, count: 0, userRating: null };
        }
        throw error;
      }
    });
  }

  async getClipDifficultyRatingsBatch(
    clipIds: string[],
    accessToken?: string,
  ): Promise<
    Map<
      string,
      { average: number | null; count: number; userRating: number | null }
    >
  > {
    return this.monitorDbOperation(
      "getClipDifficultyRatingsBatch",
      async () => {
        if (clipIds.length === 0) {
          return new Map();
        }

        try {
          const client = this.getAuthenticatedClient(accessToken);

          const { data, error } = await client
            .from("clip_difficulty_ratings")
            .select("clip_id, rating, user_id")
            .in("clip_id", clipIds);

          // If table doesn't exist (migration not run), return defaults
          if (error) {
            if (
              error.message?.includes("does not exist") ||
              error.code === "42P01"
            ) {
              console.warn(
                "clip_difficulty_ratings table does not exist. Migration may not have been run.",
              );
              const defaultMap = new Map();
              for (const clipId of clipIds) {
                defaultMap.set(clipId, {
                  average: null,
                  count: 0,
                  userRating: null,
                });
              }
              return defaultMap;
            }
            // Handle connection errors gracefully
            if (
              error.message?.includes("fetch failed") ||
              error.message?.includes("timeout") ||
              error.message?.includes("ECONNREFUSED")
            ) {
              console.warn(
                "Connection error getting difficulty ratings batch:",
                error.message,
              );
              const defaultMap = new Map();
              for (const clipId of clipIds) {
                defaultMap.set(clipId, {
                  average: null,
                  count: 0,
                  userRating: null,
                });
              }
              return defaultMap;
            }
            throw new Error(
              `Failed to get clip difficulty ratings batch: ${error.message}`,
            );
          }

          // Get user ID if authenticated
          let userId: string | null = null;
          if (accessToken) {
            const { user } = await verifyAccessToken(accessToken);
            userId = user?.id || null;
          }

          // Group by clip_id
          const ratingsMap = new Map<
            string,
            { average: number | null; count: number; userRating: number | null }
          >();

          // Initialize all clipIds with defaults
          for (const clipId of clipIds) {
            ratingsMap.set(clipId, {
              average: null,
              count: 0,
              userRating: null,
            });
          }

          // Group ratings by clip_id
          const ratingsByClip = new Map<
            string,
            Array<{ rating: number; user_id: string }>
          >();
          if (data) {
            for (const rating of data) {
              const existing = ratingsByClip.get(rating.clip_id) || [];
              existing.push({ rating: rating.rating, user_id: rating.user_id });
              ratingsByClip.set(rating.clip_id, existing);
            }
          }

          // Calculate averages and user ratings
          for (const [clipId, ratings] of ratingsByClip.entries()) {
            if (ratings.length === 0) continue;

            const ratingValues = ratings.map((r) => r.rating);
            const average =
              ratingValues.reduce((sum, r) => sum + r, 0) / ratingValues.length;
            const userRating = userId
              ? ratings.find((r) => r.user_id === userId)?.rating || null
              : null;

            ratingsMap.set(clipId, {
              average: Math.round(average * 10) / 10, // Round to 1 decimal
              count: ratings.length,
              userRating: userRating || null,
            });
          }

          return ratingsMap;
        } catch (error: any) {
          // Fallback for any unexpected errors (table doesn't exist, connection issues, etc.)
          if (
            error?.message?.includes("does not exist") ||
            error?.code === "42P01"
          ) {
            console.warn(
              "clip_difficulty_ratings table does not exist. Migration may not have been run.",
            );
            const defaultMap = new Map();
            for (const clipId of clipIds) {
              defaultMap.set(clipId, {
                average: null,
                count: 0,
                userRating: null,
              });
            }
            return defaultMap;
          }
          // Handle connection errors gracefully
          if (
            error?.message?.includes("fetch failed") ||
            error?.message?.includes("timeout") ||
            error?.message?.includes("ECONNREFUSED") ||
            error?.code === "UND_ERR_CONNECT_TIMEOUT"
          ) {
            console.warn(
              "Connection error getting difficulty ratings batch:",
              error.message,
            );
            const defaultMap = new Map();
            for (const clipId of clipIds) {
              defaultMap.set(clipId, {
                average: null,
                count: 0,
                userRating: null,
              });
            }
            return defaultMap;
          }
          throw error;
        }
      },
    );
  }

  // Vote methods
  async voteClip(
    clipId: string,
    userId: string,
    voteType: "up" | "down",
    accessToken?: string,
  ): Promise<boolean> {
    return this.monitorDbOperation("voteClip", async () => {
      const client = this.getAuthenticatedClient(accessToken);

      // Use upsert to update if exists, insert if not
      const { error } = await client.from("clip_votes").upsert(
        {
          clip_id: clipId,
          user_id: userId,
          vote_type: voteType,
        },
        {
          onConflict: "clip_id,user_id",
        },
      );

      if (error) {
        throw new Error(`Failed to vote clip: ${error.message}`);
      }

      return true;
    });
  }

  async removeClipVote(
    clipId: string,
    userId: string,
    accessToken?: string,
  ): Promise<boolean> {
    return this.monitorDbOperation("removeClipVote", async () => {
      const client = this.getAuthenticatedClient(accessToken);

      const { error } = await client
        .from("clip_votes")
        .delete()
        .eq("clip_id", clipId)
        .eq("user_id", userId);

      if (error) {
        throw new Error(`Failed to remove clip vote: ${error.message}`);
      }

      return true;
    });
  }

  async getClipVotes(
    clipId: string,
    accessToken?: string,
  ): Promise<{
    upvoteCount: number;
    downvoteCount: number;
    voteScore: number;
    userVote: "up" | "down" | null;
  }> {
    return this.monitorDbOperation("getClipVotes", async () => {
      try {
        const client = this.getAuthenticatedClient(accessToken);

        const { data, error } = await client
          .from("clip_votes")
          .select("vote_type, user_id")
          .eq("clip_id", clipId);

        // If table doesn't exist (migration not run), return defaults
        if (error) {
          if (
            error.message?.includes("does not exist") ||
            error.code === "42P01"
          ) {
            console.warn(
              "clip_votes table does not exist. Migration may not have been run.",
            );
            return {
              upvoteCount: 0,
              downvoteCount: 0,
              voteScore: 0,
              userVote: null,
            };
          }
          throw new Error(`Failed to get clip votes: ${error.message}`);
        }

        // Get user ID if authenticated
        let userId: string | null = null;
        if (accessToken) {
          const { user } = await verifyAccessToken(accessToken);
          userId = user?.id || null;
        }

        const upvoteCount = data.filter((v) => v.vote_type === "up").length;
        const downvoteCount = data.filter((v) => v.vote_type === "down").length;
        const voteScore = upvoteCount - downvoteCount;
        const userVote = userId
          ? (data.find((v) => v.user_id === userId)?.vote_type as
              | "up"
              | "down"
              | null) || null
          : null;

        return {
          upvoteCount,
          downvoteCount,
          voteScore,
          userVote,
        };
      } catch (error: any) {
        // Fallback for any unexpected errors (table doesn't exist, connection issues, etc.)
        if (
          error?.message?.includes("does not exist") ||
          error?.code === "42P01"
        ) {
          console.warn(
            "clip_votes table does not exist. Migration may not have been run.",
          );
          return {
            upvoteCount: 0,
            downvoteCount: 0,
            voteScore: 0,
            userVote: null,
          };
        }
        // Handle connection errors gracefully
        if (
          error?.message?.includes("fetch failed") ||
          error?.message?.includes("timeout") ||
          error?.message?.includes("ECONNREFUSED") ||
          error?.code === "UND_ERR_CONNECT_TIMEOUT"
        ) {
          console.warn("Connection error getting votes:", error.message);
          return {
            upvoteCount: 0,
            downvoteCount: 0,
            voteScore: 0,
            userVote: null,
          };
        }
        throw error;
      }
    });
  }

  async getClipVotesBatch(
    clipIds: string[],
    accessToken?: string,
  ): Promise<
    Map<
      string,
      {
        upvoteCount: number;
        downvoteCount: number;
        voteScore: number;
        userVote: "up" | "down" | null;
      }
    >
  > {
    return this.monitorDbOperation("getClipVotesBatch", async () => {
      if (clipIds.length === 0) {
        return new Map();
      }

      try {
        const client = this.getAuthenticatedClient(accessToken);

        const { data, error } = await client
          .from("clip_votes")
          .select("clip_id, vote_type, user_id")
          .in("clip_id", clipIds);

        // If table doesn't exist (migration not run), return defaults
        if (error) {
          if (
            error.message?.includes("does not exist") ||
            error.code === "42P01"
          ) {
            console.warn(
              "clip_votes table does not exist. Migration may not have been run.",
            );
            const defaultMap = new Map();
            for (const clipId of clipIds) {
              defaultMap.set(clipId, {
                upvoteCount: 0,
                downvoteCount: 0,
                voteScore: 0,
                userVote: null,
              });
            }
            return defaultMap;
          }
          // Handle connection errors gracefully
          if (
            error.message?.includes("fetch failed") ||
            error.message?.includes("timeout") ||
            error.message?.includes("ECONNREFUSED")
          ) {
            console.warn(
              "Connection error getting votes batch:",
              error.message,
            );
            const defaultMap = new Map();
            for (const clipId of clipIds) {
              defaultMap.set(clipId, {
                upvoteCount: 0,
                downvoteCount: 0,
                voteScore: 0,
                userVote: null,
              });
            }
            return defaultMap;
          }
          throw new Error(`Failed to get clip votes batch: ${error.message}`);
        }

        // Get user ID if authenticated
        let userId: string | null = null;
        if (accessToken) {
          const { user } = await verifyAccessToken(accessToken);
          userId = user?.id || null;
        }

        // Initialize all clipIds with defaults
        const votesMap = new Map<
          string,
          {
            upvoteCount: number;
            downvoteCount: number;
            voteScore: number;
            userVote: "up" | "down" | null;
          }
        >();
        for (const clipId of clipIds) {
          votesMap.set(clipId, {
            upvoteCount: 0,
            downvoteCount: 0,
            voteScore: 0,
            userVote: null,
          });
        }

        // Group votes by clip_id
        const votesByClip = new Map<
          string,
          Array<{ vote_type: string; user_id: string }>
        >();
        if (data) {
          for (const vote of data) {
            const existing = votesByClip.get(vote.clip_id) || [];
            existing.push({ vote_type: vote.vote_type, user_id: vote.user_id });
            votesByClip.set(vote.clip_id, existing);
          }
        }

        // Calculate vote counts and user votes
        for (const [clipId, votes] of votesByClip.entries()) {
          const upvoteCount = votes.filter((v) => v.vote_type === "up").length;
          const downvoteCount = votes.filter(
            (v) => v.vote_type === "down",
          ).length;
          const voteScore = upvoteCount - downvoteCount;
          const userVote = userId
            ? (votes.find((v) => v.user_id === userId)?.vote_type as
                | "up"
                | "down"
                | null) || null
            : null;

          votesMap.set(clipId, {
            upvoteCount,
            downvoteCount,
            voteScore,
            userVote,
          });
        }

        return votesMap;
      } catch (error: any) {
        // Fallback for any unexpected errors (table doesn't exist, connection issues, etc.)
        if (
          error?.message?.includes("does not exist") ||
          error?.code === "42P01"
        ) {
          console.warn(
            "clip_votes table does not exist. Migration may not have been run.",
          );
          const defaultMap = new Map();
          for (const clipId of clipIds) {
            defaultMap.set(clipId, {
              upvoteCount: 0,
              downvoteCount: 0,
              voteScore: 0,
              userVote: null,
            });
          }
          return defaultMap;
        }
        // Handle connection errors gracefully
        if (
          error?.message?.includes("fetch failed") ||
          error?.message?.includes("timeout") ||
          error?.message?.includes("ECONNREFUSED") ||
          error?.code === "UND_ERR_CONNECT_TIMEOUT"
        ) {
          console.warn("Connection error getting votes batch:", error.message);
          const defaultMap = new Map();
          for (const clipId of clipIds) {
            defaultMap.set(clipId, {
              upvoteCount: 0,
              downvoteCount: 0,
              voteScore: 0,
              userVote: null,
            });
          }
          return defaultMap;
        }
        throw error;
      }
    });
  }

  // Helper: Calculate characters per second (alphanumeric only)
  calculateCharactersPerSecond(clip: AudioClip): number | null {
    if (!clip.metadata.transcript || !clip.duration || clip.duration <= 0) {
      return null;
    }

    // Count only alphanumeric characters (exclude spaces, punctuation)
    const alphanumericChars = clip.metadata.transcript.replace(
      /[^a-zA-Z0-9]/g,
      "",
    ).length;
    return alphanumericChars / clip.duration;
  }

  // Helper: Calculate speed percentiles
  getSpeedPercentiles(clips: AudioClip[]): {
    slow: number;
    medium: number;
    fast: number;
  } {
    const speeds = clips
      .map((clip) => this.calculateCharactersPerSecond(clip))
      .filter((speed): speed is number => speed !== null)
      .sort((a, b) => a - b);

    if (speeds.length === 0) {
      return { slow: 0, medium: 0, fast: 0 };
    }

    const slowThreshold = speeds[Math.floor(speeds.length * 0.33)];
    const fastThreshold = speeds[Math.floor(speeds.length * 0.66)];

    return {
      slow: slowThreshold,
      medium: fastThreshold,
      fast: speeds[speeds.length - 1],
    };
  }

  // User filter preferences methods
  async getUserFilterPreferences(
    userId: string,
    accessToken?: string,
  ): Promise<FilterPreferences | null> {
    const client = this.getAuthenticatedClient(accessToken);

    const { data, error } = await client
      .from("profiles")
      .select("filter_preferences")
      .eq("id", userId)
      .single();

    if (error) {
      // If profile doesn't exist or other error, return null
      if (error.code === "PGRST116") {
        // No rows returned
        return null;
      }
      // If column doesn't exist yet (database migration not run), return null gracefully
      if (
        error.message?.includes("does not exist") ||
        error.message?.includes("column")
      ) {
        console.warn(
          "filter_preferences column does not exist yet. Please run the database migration.",
        );
        return null;
      }
      throw new Error(
        `Failed to get user filter preferences: ${error.message}`,
      );
    }

    if (!data || !data.filter_preferences) {
      return null;
    }

    // Parse JSONB and validate structure
    try {
      const preferences = data.filter_preferences as any;
      // Validate and return only the expected fields
      const result: FilterPreferences = {};
      if (preferences.language && typeof preferences.language === "string") {
        result.language = preferences.language;
      }
      if (
        preferences.speakerGender &&
        ["male", "female", "other"].includes(preferences.speakerGender)
      ) {
        result.speakerGender = preferences.speakerGender;
      }
      if (
        preferences.speakerAgeRange &&
        ["teen", "younger-adult", "adult", "senior"].includes(
          preferences.speakerAgeRange,
        )
      ) {
        result.speakerAgeRange = preferences.speakerAgeRange;
      }
      if (
        preferences.speakerDialect &&
        typeof preferences.speakerDialect === "string"
      ) {
        result.speakerDialect = preferences.speakerDialect;
      }
      if (
        preferences.speedFilter &&
        ["slow", "medium", "fast"].includes(preferences.speedFilter)
      ) {
        result.speedFilter = preferences.speedFilter;
      }
      if (
        preferences.defaultSort &&
        typeof preferences.defaultSort === "object"
      ) {
        const sort = preferences.defaultSort;
        if (
          sort.field &&
          typeof sort.field === "string" &&
          sort.direction &&
          ["asc", "desc"].includes(sort.direction)
        ) {
          result.defaultSort = {
            field: sort.field as any,
            direction: sort.direction,
          };
        }
      }

      // Return null if no valid preferences found
      return Object.keys(result).length > 0 ? result : null;
    } catch (parseError) {
      console.error("Failed to parse filter preferences:", parseError);
      return null;
    }
  }

  async saveUserFilterPreferences(
    userId: string,
    preferences: FilterPreferences | null,
    accessToken?: string,
  ): Promise<void> {
    const client = this.getAuthenticatedClient(accessToken);

    // Handle null preferences (clearing them)
    if (!preferences) {
      const { error } = await client
        .from("profiles")
        .update({ filter_preferences: null })
        .eq("id", userId);

      if (error) {
        throw new Error(
          `Failed to save user filter preferences: ${error.message}`,
        );
      }
      return;
    }

    // Only save the preference fields, ignore any extra fields
    const preferencesToSave: FilterPreferences = {};
    if (preferences.language) {
      preferencesToSave.language = preferences.language;
    }
    if (preferences.speakerGender) {
      preferencesToSave.speakerGender = preferences.speakerGender;
    }
    if (preferences.speakerAgeRange) {
      preferencesToSave.speakerAgeRange = preferences.speakerAgeRange;
    }
    if (preferences.speakerDialect) {
      preferencesToSave.speakerDialect = preferences.speakerDialect;
    }
    if (preferences.speedFilter) {
      preferencesToSave.speedFilter = preferences.speedFilter;
    }
    if (preferences.defaultSort) {
      preferencesToSave.defaultSort = preferences.defaultSort;
    }

    // If all preferences are empty, save null to clear them
    const valueToSave =
      Object.keys(preferencesToSave).length > 0 ? preferencesToSave : null;

    const { error } = await client
      .from("profiles")
      .update({ filter_preferences: valueToSave })
      .eq("id", userId);

    if (error) {
      // If column doesn't exist yet (database migration not run), log warning but don't throw
      if (
        error.message?.includes("does not exist") ||
        error.message?.includes("column")
      ) {
        console.warn(
          "filter_preferences column does not exist yet. Please run the database migration.",
        );
        return; // Silently fail - user needs to run migration
      }
      throw new Error(
        `Failed to save user filter preferences: ${error.message}`,
      );
    }
  }

  // Stats methods
  async getUserStats(
    userId: string,
    accessToken?: string,
  ): Promise<{
    totalChorusingTimeSeconds: number;
    totalClipsPracticed: number;
    totalTranscriptionAttempts: number;
    totalClipsSubmitted: number;
    languageStats: Record<
      string,
      { timeSeconds: number; clipsPracticed: number }
    >;
    practiceStreak: number;
  }> {
    return this.monitorDbOperation("getUserStats", async () => {
      const client = this.getAuthenticatedClient(accessToken);

      // Always calculate fresh stats (cache disabled — not needed at conference scale)
      const [sessionsResult, attemptsResult, clipsResult] = await Promise.all([
        client
          .from("clip_sessions")
          .select("total_time_seconds, language, clip_id")
          .eq("user_id", userId),
        client
          .from("transcription_attempts")
          .select("id")
          .eq("user_id", userId),
        client.from("audio_clips").select("id").eq("uploaded_by", userId),
      ]);

      const sessions = sessionsResult.data || [];
      const attempts = attemptsResult.data || [];
      const clips = clipsResult.data || [];

      // Calculate totals
      const totalChorusingTimeSeconds = sessions.reduce(
        (sum, s) => sum + (Number(s.total_time_seconds) || 0),
        0,
      );
      const uniqueClipsPracticed = new Set(sessions.map((s) => s.clip_id)).size;
      const totalTranscriptionAttempts = attempts.length;
      const totalClipsSubmitted = clips.length;

      // Calculate per-language stats
      const languageStats: Record<
        string,
        { timeSeconds: number; clipsPracticed: number }
      > = {};
      const languageClips = new Map<string, Set<string>>();

      for (const session of sessions) {
        const lang = session.language || "unknown";
        const time = Number(session.total_time_seconds) || 0;

        if (!languageStats[lang]) {
          languageStats[lang] = { timeSeconds: 0, clipsPracticed: 0 };
          languageClips.set(lang, new Set());
        }

        languageStats[lang].timeSeconds += time;
        languageClips.get(lang)!.add(session.clip_id);
      }

      // Set clips practiced per language
      for (const [lang, clipSet] of languageClips.entries()) {
        if (languageStats[lang]) {
          languageStats[lang].clipsPracticed = clipSet.size;
        }
      }

      // Calculate practice streak
      const practiceStreak = await this.calculatePracticeStreak(userId, client);

      // Update cache
      const languageStatsJson: any = {};
      for (const [lang, stats] of Object.entries(languageStats)) {
        languageStatsJson[lang] = {
          time_seconds: stats.timeSeconds,
          clips_practiced: stats.clipsPracticed,
        };
      }

      await client
        .from("user_stats_cache")
        .upsert({
          user_id: userId,
          total_chorusing_time_seconds: totalChorusingTimeSeconds,
          total_clips_practiced: uniqueClipsPracticed,
          total_transcription_attempts: totalTranscriptionAttempts,
          total_clips_submitted: totalClipsSubmitted,
          language_stats: languageStatsJson,
          last_updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      return {
        totalChorusingTimeSeconds,
        totalClipsPracticed: uniqueClipsPracticed,
        totalTranscriptionAttempts,
        totalClipsSubmitted,
        languageStats,
        practiceStreak,
      };
    });
  }

  private async calculatePracticeStreak(
    userId: string,
    client: any,
  ): Promise<number> {
    // Get all sessions grouped by date
    const { data: sessions } = await client
      .from("clip_sessions")
      .select("started_at, total_time_seconds")
      .eq("user_id", userId)
      .order("started_at", { ascending: false });

    if (!sessions || sessions.length === 0) return 0;

    // Group by date and check if at least 1 minute was practiced
    const practiceDays = new Set<string>();
    for (const session of sessions) {
      const date = new Date(session.started_at);
      const dateStr = date.toISOString().split("T")[0];
      const timeSeconds = Number(session.total_time_seconds) || 0;

      if (timeSeconds >= 60) {
        // At least 1 minute
        practiceDays.add(dateStr);
      }
    }

    // Calculate consecutive days from today backwards
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;
    let currentDate = new Date(today);

    while (true) {
      const dateStr = currentDate.toISOString().split("T")[0];
      if (practiceDays.has(dateStr)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  async getClipStats(
    clipId: string,
    userId: string,
    accessToken?: string,
  ): Promise<{
    totalTimeSeconds: number;
    sessionCount: number;
    totalLoops: number;
    totalRestarts: number;
    lastPracticedAt: string | null;
    transcriptionAttempts: number;
  }> {
    return this.monitorDbOperation("getClipStats", async () => {
      const client = this.getAuthenticatedClient(accessToken);

      const [sessionsResult, attemptsResult] = await Promise.all([
        client
          .from("clip_sessions")
          .select("total_time_seconds, loop_count, restart_count, started_at")
          .eq("user_id", userId)
          .eq("clip_id", clipId)
          .order("started_at", { ascending: false }),
        client
          .from("transcription_attempts")
          .select("id")
          .eq("user_id", userId)
          .eq("clip_id", clipId),
      ]);

      const sessions = sessionsResult.data || [];
      const attempts = attemptsResult.data || [];

      const totalTimeSeconds = sessions.reduce(
        (sum, s) => sum + (Number(s.total_time_seconds) || 0),
        0,
      );
      const totalLoops = sessions.reduce(
        (sum, s) => sum + (s.loop_count || 0),
        0,
      );
      const totalRestarts = sessions.reduce(
        (sum, s) => sum + (s.restart_count || 0),
        0,
      );
      const lastPracticedAt =
        sessions.length > 0 ? sessions[0].started_at : null;

      return {
        totalTimeSeconds,
        sessionCount: sessions.length,
        totalLoops,
        totalRestarts,
        lastPracticedAt,
        transcriptionAttempts: attempts.length,
      };
    });
  }

  async getTimeline(
    userId: string,
    limit: number = 50,
    offset: number = 0,
    accessToken?: string,
  ): Promise<
    Array<{
      clip: SupabaseAudioClip;
      lastPracticedAt: string;
      totalTimeSeconds: number;
      sessionCount: number;
      totalLoops: number;
    }>
  > {
    return this.monitorDbOperation("getTimeline", async () => {
      const client = this.getAuthenticatedClient(accessToken);

      // Get distinct clips with their most recent session
      const { data: sessions, error } = await client
        .from("clip_sessions")
        .select(
          `
          clip_id,
          started_at,
          total_time_seconds,
          loop_count,
          audio_clips (
            id,
            title,
            duration,
            filename,
            original_filename,
            file_size,
            storage_path,
            language,
            speaker_gender,
            speaker_age_range,
            speaker_dialect,
            transcript,
            source_url,
            tags,
            uploaded_by,
            created_at,
            updated_at
          )
        `,
        )
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(limit * 10); // Get more to account for grouping

      if (error) throw error;

      // Group by clip_id and aggregate
      const clipMap = new Map<
        string,
        {
          clip: any;
          lastPracticedAt: string;
          totalTimeSeconds: number;
          sessionCount: number;
          totalLoops: number;
        }
      >();

      for (const session of sessions || []) {
        const clipId = session.clip_id;
        const clip = (session as any).audio_clips;

        if (!clip) continue;

        if (!clipMap.has(clipId)) {
          clipMap.set(clipId, {
            clip: convertAudioClipFromDb(clip),
            lastPracticedAt: session.started_at,
            totalTimeSeconds: Number(session.total_time_seconds) || 0,
            sessionCount: 1,
            totalLoops: session.loop_count || 0,
          });
        } else {
          const existing = clipMap.get(clipId)!;
          existing.totalTimeSeconds += Number(session.total_time_seconds) || 0;
          existing.sessionCount += 1;
          existing.totalLoops += session.loop_count || 0;
          // Keep the most recent practice date
          if (
            new Date(session.started_at) > new Date(existing.lastPracticedAt)
          ) {
            existing.lastPracticedAt = session.started_at;
          }
        }
      }

      // Convert to array, sort by last practiced, and limit
      const result = Array.from(clipMap.values())
        .sort(
          (a, b) =>
            new Date(b.lastPracticedAt).getTime() -
            new Date(a.lastPracticedAt).getTime(),
        )
        .slice(offset, offset + limit);

      return result;
    });
  }

  async getContributionStats(
    userId: string,
    accessToken?: string,
  ): Promise<{
    totalClipsSubmitted: number;
    totalTimeByOthers: number;
    popularClips: Array<{
      clip: SupabaseAudioClip;
      totalTimeByOthers: number;
      userCount: number;
    }>;
  }> {
    return this.monitorDbOperation("getContributionStats", async () => {
      const client = this.getAuthenticatedClient(accessToken);

      // Get all clips uploaded by user
      const { data: clips, error: clipsError } = await client
        .from("audio_clips")
        .select("*")
        .eq("uploaded_by", userId);

      if (clipsError) throw clipsError;

      const totalClipsSubmitted = clips?.length || 0;

      // Get all sessions for these clips (excluding the creator's own sessions)
      const clipIds = clips?.map((c) => c.id) || [];
      if (clipIds.length === 0) {
        return {
          totalClipsSubmitted: 0,
          totalTimeByOthers: 0,
          popularClips: [],
        };
      }

      const { data: sessions, error: sessionsError } = await client
        .from("clip_sessions")
        .select("clip_id, total_time_seconds, user_id")
        .in("clip_id", clipIds)
        .neq("user_id", userId); // Exclude creator's own sessions

      if (sessionsError) throw sessionsError;

      // Calculate total time by others
      const totalTimeByOthers = (sessions || []).reduce(
        (sum, s) => sum + (Number(s.total_time_seconds) || 0),
        0,
      );

      // Group by clip and calculate stats
      const clipStatsMap = new Map<
        string,
        {
          totalTime: number;
          users: Set<string>;
        }
      >();

      for (const session of sessions || []) {
        const clipId = session.clip_id;
        if (!clipStatsMap.has(clipId)) {
          clipStatsMap.set(clipId, {
            totalTime: 0,
            users: new Set(),
          });
        }
        const stats = clipStatsMap.get(clipId)!;
        stats.totalTime += Number(session.total_time_seconds) || 0;
        stats.users.add(session.user_id);
      }

      // Build popular clips list
      const popularClips = Array.from(clipStatsMap.entries())
        .map(([clipId, stats]) => {
          const clip = clips?.find((c) => c.id === clipId);
          if (!clip) return null;
          return {
            clip: convertAudioClipFromDb(clip),
            totalTimeByOthers: stats.totalTime,
            userCount: stats.users.size,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => b.totalTimeByOthers - a.totalTimeByOthers)
        .slice(0, 10); // Top 10

      return {
        totalClipsSubmitted,
        totalTimeByOthers,
        popularClips,
      };
    });
  }
}

export const serverDb = new SupabaseDatabase();
