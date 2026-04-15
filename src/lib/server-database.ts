// Server-side database layer using Supabase service role client (no RLS)
import type { Database, Json } from "@/types/supabase";
import type { User } from "@/types/auth";
import type { AudioClip, AudioFilters, AudioSort, FilterPreferences } from "@/types/audio";
import {
  convertAudioClipFromDb,
  convertAudioClipToDb,
  type SupabaseAudioClip,
} from "@/types/supabase";
import {
  getPublicUrl,
  deleteAudioFile,
  supabaseService,
} from "@/lib/supabase";
import { isAdmin } from "@/lib/admin";
import { supabaseMonitor } from "@/lib/supabase-monitor";
import { retryWithBackoff, isTransientError } from "@/lib/api-utils";

// Track server client instance
supabaseMonitor.registerClient('server');

// All database operations use the service role client (RLS removed)
const db = supabaseService;

class SupabaseDatabase {
  // Helper to wrap database operations with monitoring and retry logic
  private async monitorDbOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    options: { retry?: boolean } = {}
  ): Promise<T> {
    const requestId = supabaseMonitor.startRequest('database', operation);
    const startTime = Date.now();
    const timeoutMs = 30000; // 30 seconds
    const shouldRetry = options.retry !== false; // Default to true

    const executeOperation = async (): Promise<T> => {
      return Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => {
            supabaseMonitor.timeoutRequest(requestId, timeoutMs);
            reject(new Error('Operation timeout'));
          }, timeoutMs)
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
              console.warn(`Retrying ${operation} (attempt ${attempt}):`, error?.message);
            },
          })
        : await executeOperation();

      const duration = Date.now() - startTime;
      supabaseMonitor.completeRequest(requestId, {
        type: 'database',
        operation,
        duration,
        status: 'success',
        responseSize: JSON.stringify(result).length,
      });
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const isTimeout = error?.message === 'Operation timeout';

      if (!isTimeout) {
        // Only complete if not already timed out
        supabaseMonitor.completeRequest(requestId, {
          type: 'database',
          operation,
          duration,
          status: 'failure',
          error: error?.message || 'Unknown error',
          errorCode: error?.code || error?.statusCode?.toString(),
        });
      }
      throw error;
    }
  }

  // Get distinct dialects for a given language
  async getDistinctDialects(language: string): Promise<string[]> {
    return this.monitorDbOperation('getDistinctDialects', async () => {
      const { data, error } = await db
        .from("audio_clips")
        .select("speaker_dialect")
        .eq("language", language)
        .not("speaker_dialect", "is", null);

      if (error) {
        throw new Error(`Failed to fetch dialects: ${error.message}`);
      }

      const dialects = Array.from(
        new Set(
          (data || [])
            .map((row) => row.speaker_dialect)
            .filter((dialect): dialect is string => !!dialect)
        )
      ).sort();

      return dialects;
    });
  }

  // Helper to check if a string is an email
  private isEmail(input: string): boolean {
    return input.includes("@") && input.includes(".");
  }

  // Helper to lookup user email by username
  async getUserEmailByUsername(username: string): Promise<string | null> {
    return this.monitorDbOperation('getUserEmailByUsername', async () => {
      const { data: profile, error } = await db
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
    return this.monitorDbOperation('getUserByEmail', async () => {
      const { data: profile, error } = await db
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
      };
    });
  }

  // Helper to get user profile by username
  async getUserByUsername(username: string): Promise<User | null> {
    return this.monitorDbOperation('getUserByUsername', async () => {
      const { data: profile, error } = await db
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
      };
    });
  }

  async getUserById(id: string): Promise<User | null> {
    return this.monitorDbOperation('getUserById', async () => {
      const { data: profile, error } = await db
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
      };
    });
  }

  // Audio clip methods
  async createAudioClip(
    clip: Omit<SupabaseAudioClip, "id" | "createdAt" | "updatedAt">,
    userId: string
  ): Promise<AudioClip> {
    return this.monitorDbOperation('createAudioClip', async () => {
      const dbClip = convertAudioClipToDb(clip);

      console.log("Creating clip:", clip.title);
      console.log("Uploaded by user ID:", clip.uploadedBy);

      // Verify the caller owns the clip
      if (userId !== clip.uploadedBy) {
        console.error("User ID mismatch:", userId, "vs", clip.uploadedBy);
        throw new Error(
          "User ID mismatch - cannot create clip for different user"
        );
      }

      const { data, error } = await db
        .from("audio_clips")
        .insert(dbClip)
        .select()
        .single();

      if (error) {
        console.error("Database insert failed:", error);
        console.error("Error code:", error.code);
        console.error("Error details:", error.details);
        console.error("Error hint:", error.hint);
        throw new Error(`Failed to create audio clip: ${error.message}`);
      }

      console.log("Clip created:", data.id);
      const convertedClip = convertAudioClipFromDb(data);

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
  ): Promise<AudioClip[]> {
    return this.monitorDbOperation('getAudioClips', async () => {
      let query = db.from("audio_clips").select("*");

    // Apply filters (order matters for query optimization - most selective first)
    if (filters) {
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
      if (filters.tags && filters.tags.length > 0) {
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

    if (limit) {
      query = query.limit(limit);
    }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch audio clips: ${error.message}`);
      }

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
  ): Promise<AudioClip | null> {
    return this.monitorDbOperation('getAudioClipById', async () => {
      const { data, error } = await db
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

  async getAudioClipByFilename(
    filename: string,
  ): Promise<(AudioClip & { storagePath: string }) | null> {
    return this.monitorDbOperation('getAudioClipByFilename', async () => {
      const { data, error } = await db
        .from("audio_clips")
        .select("*")
        .eq("filename", filename)
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
        storagePath: converted.storagePath,
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
    refoldId?: number
  ): Promise<boolean> {
    return this.monitorDbOperation('deleteAudioClip', async () => {
      // First get the clip to check ownership and get storage path
      const { data: clip, error: fetchError } = await db
        .from("audio_clips")
        .select("uploaded_by, storage_path")
        .eq("id", id)
        .single();

      if (fetchError || !clip) {
        return false;
      }

      // Check if user owns this clip or is an admin
      const adminCheck = refoldId != null ? isAdmin(refoldId) : false;
      if (clip.uploaded_by !== userId && !adminCheck) {
        throw new Error("Unauthorized to delete this clip");
      }

      // Delete from database
      const { error: deleteError, data: deleteData } = await db
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
        await deleteAudioFile(clip.storage_path);
      } catch (error) {
        console.warn(`Could not delete file ${clip.storage_path}:`, error);
      }

      return true;
    });
  }

  async updateAudioClip(
    id: string,
    updates: Partial<Pick<AudioClip, "title" | "metadata">>,
    userId: string,
    refoldId?: number
  ): Promise<AudioClip | null> {
    return this.monitorDbOperation('updateAudioClip', async () => {
      // First get the clip to check ownership
      const { data: clip, error: fetchError } = await db
        .from("audio_clips")
        .select("uploaded_by")
        .eq("id", id)
        .single();

      if (fetchError || !clip) {
        console.error("Failed to fetch clip for update:", fetchError);
        return null;
      }

      // Check if user owns this clip or is an admin
      const updateAdminCheck = refoldId != null ? isAdmin(refoldId) : false;
      if (clip.uploaded_by !== userId && !updateAdminCheck) {
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

      const { data, error } = await db
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
    });
  }

  // Star methods
  async starClip(
    clipId: string,
    userId: string,
  ): Promise<boolean> {
    return this.monitorDbOperation('starClip', async () => {
      const { error } = await db.from("clip_stars").insert({
        clip_id: clipId,
        user_id: userId,
      });

      // Return false if already starred (unique constraint violation)
      if (error) {
        if (error.code === "23505") {
          return false;
        }
        throw new Error(`Failed to star clip: ${error.message}`);
      }

      return true;
    }, { retry: false });
  }

  async unstarClip(
    clipId: string,
    userId: string,
  ): Promise<boolean> {
    return this.monitorDbOperation('unstarClip', async () => {
      const { error } = await db
        .from("clip_stars")
        .delete()
        .eq("clip_id", clipId)
        .eq("user_id", userId);

      if (error) {
        throw new Error(`Failed to unstar clip: ${error.message}`);
      }

      return true;
    });
  }

  async getClipStars(clipId: string): Promise<string[]> {
    return this.monitorDbOperation('getClipStars', async () => {
      try {
        const { data, error } = await db
          .from("clip_stars")
          .select("user_id")
          .eq("clip_id", clipId);

        if (error) {
          if (isTransientError(error)) {
            console.warn(`Connection error getting stars for clip ${clipId}:`, error.message);
            return [];
          }
          throw new Error(`Failed to get clip stars: ${error.message}`);
        }

        return data.map((star) => star.user_id);
      } catch (error: any) {
        if (isTransientError(error)) {
          console.warn(`Connection error getting stars for clip ${clipId}:`, error.message);
          return [];
        }
        throw error;
      }
    });
  }

  async getUserStarredClips(
    userId: string,
  ): Promise<string[]> {
    return this.monitorDbOperation('getUserStarredClips', async () => {
      const { data, error } = await db
        .from("clip_stars")
        .select("clip_id")
        .eq("user_id", userId);

      if (error) {
        throw new Error(`Failed to get user starred clips: ${error.message}`);
      }

      return data.map((star) => star.clip_id);
    });
  }

  // Batch methods for efficient querying
  async getClipStarsBatch(
    clipIds: string[],
  ): Promise<Map<string, string[]>> {
    return this.monitorDbOperation('getClipStarsBatch', async () => {
      if (clipIds.length === 0) {
        return new Map();
      }

      try {
        const { data, error } = await db
          .from("clip_stars")
          .select("clip_id, user_id")
          .in("clip_id", clipIds);

        if (error) {
          if (isTransientError(error)) {
            console.warn(`Connection error getting stars batch:`, error.message);
            return new Map();
          }
          throw new Error(`Failed to get clip stars batch: ${error.message}`);
        }

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
        if (isTransientError(error)) {
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
  ): Promise<boolean> {
    return this.monitorDbOperation('rateClipDifficulty', async () => {
      if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
        throw new Error("Rating must be an integer between 1 and 5");
      }

      const { error } = await db
        .from("clip_difficulty_ratings")
        .upsert(
          {
            clip_id: clipId,
            user_id: userId,
            rating: rating,
          },
          {
            onConflict: "clip_id,user_id",
          }
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
  ): Promise<boolean> {
    return this.monitorDbOperation('removeDifficultyRating', async () => {
      const { error } = await db
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
    userId?: string
  ): Promise<{ average: number | null; count: number; userRating: number | null }> {
    return this.monitorDbOperation('getClipDifficultyRating', async () => {
      try {
        const { data, error } = await db
          .from("clip_difficulty_ratings")
          .select("rating, user_id")
          .eq("clip_id", clipId);

        if (error) {
          if (error.message?.includes("does not exist") || error.code === "42P01") {
            console.warn("clip_difficulty_ratings table does not exist. Migration may not have been run.");
            return { average: null, count: 0, userRating: null };
          }
          throw new Error(`Failed to get clip difficulty rating: ${error.message}`);
        }

        if (!data || data.length === 0) {
          return { average: null, count: 0, userRating: null };
        }

        const ratings = data.map((r) => r.rating);
        const average = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
        const userRating = userId
          ? data.find((r) => r.user_id === userId)?.rating || null
          : null;

        return {
          average: Math.round(average * 10) / 10,
          count: ratings.length,
          userRating: userRating || null,
        };
      } catch (error: any) {
        if (error?.message?.includes("does not exist") || error?.code === "42P01") {
          console.warn("clip_difficulty_ratings table does not exist. Migration may not have been run.");
          return { average: null, count: 0, userRating: null };
        }
        if (isTransientError(error)) {
          console.warn("Connection error getting difficulty rating:", error.message);
          return { average: null, count: 0, userRating: null };
        }
        throw error;
      }
    });
  }

  async getClipDifficultyRatingsBatch(
    clipIds: string[],
    userId?: string
  ): Promise<Map<string, { average: number | null; count: number; userRating: number | null }>> {
    return this.monitorDbOperation('getClipDifficultyRatingsBatch', async () => {
      if (clipIds.length === 0) {
        return new Map();
      }

      try {
        const { data, error } = await db
          .from("clip_difficulty_ratings")
          .select("clip_id, rating, user_id")
          .in("clip_id", clipIds);

        if (error) {
          if (error.message?.includes("does not exist") || error.code === "42P01") {
            console.warn("clip_difficulty_ratings table does not exist. Migration may not have been run.");
            const defaultMap = new Map();
            for (const clipId of clipIds) {
              defaultMap.set(clipId, { average: null, count: 0, userRating: null });
            }
            return defaultMap;
          }
          if (isTransientError(error)) {
            console.warn("Connection error getting difficulty ratings batch:", error.message);
            const defaultMap = new Map();
            for (const clipId of clipIds) {
              defaultMap.set(clipId, { average: null, count: 0, userRating: null });
            }
            return defaultMap;
          }
          throw new Error(`Failed to get clip difficulty ratings batch: ${error.message}`);
        }

        // Group by clip_id
        const ratingsMap = new Map<string, { average: number | null; count: number; userRating: number | null }>();

        for (const clipId of clipIds) {
          ratingsMap.set(clipId, { average: null, count: 0, userRating: null });
        }

        const ratingsByClip = new Map<string, Array<{ rating: number; user_id: string }>>();
        if (data) {
          for (const rating of data) {
            const existing = ratingsByClip.get(rating.clip_id) || [];
            existing.push({ rating: rating.rating, user_id: rating.user_id });
            ratingsByClip.set(rating.clip_id, existing);
          }
        }

        for (const [clipId, ratings] of ratingsByClip.entries()) {
          if (ratings.length === 0) continue;

          const ratingValues = ratings.map((r) => r.rating);
          const average = ratingValues.reduce((sum, r) => sum + r, 0) / ratingValues.length;
          const userRating = userId
            ? ratings.find((r) => r.user_id === userId)?.rating || null
            : null;

          ratingsMap.set(clipId, {
            average: Math.round(average * 10) / 10,
            count: ratings.length,
            userRating: userRating || null,
          });
        }

        return ratingsMap;
      } catch (error: any) {
        if (error?.message?.includes("does not exist") || error?.code === "42P01") {
          console.warn("clip_difficulty_ratings table does not exist. Migration may not have been run.");
          const defaultMap = new Map();
          for (const clipId of clipIds) {
            defaultMap.set(clipId, { average: null, count: 0, userRating: null });
          }
          return defaultMap;
        }
        if (isTransientError(error)) {
          console.warn("Connection error getting difficulty ratings batch:", error.message);
          const defaultMap = new Map();
          for (const clipId of clipIds) {
            defaultMap.set(clipId, { average: null, count: 0, userRating: null });
          }
          return defaultMap;
        }
        throw error;
      }
    });
  }

  // Vote methods
  async voteClip(
    clipId: string,
    userId: string,
    voteType: "up" | "down",
  ): Promise<boolean> {
    return this.monitorDbOperation('voteClip', async () => {
      const { error } = await db
        .from("clip_votes")
        .upsert(
          {
            clip_id: clipId,
            user_id: userId,
            vote_type: voteType,
          },
          {
            onConflict: "clip_id,user_id",
          }
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
  ): Promise<boolean> {
    return this.monitorDbOperation('removeClipVote', async () => {
      const { error } = await db
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
    userId?: string
  ): Promise<{ upvoteCount: number; downvoteCount: number; voteScore: number; userVote: "up" | "down" | null }> {
    return this.monitorDbOperation('getClipVotes', async () => {
      try {
        const { data, error } = await db
          .from("clip_votes")
          .select("vote_type, user_id")
          .eq("clip_id", clipId);

        if (error) {
          if (error.message?.includes("does not exist") || error.code === "42P01") {
            console.warn("clip_votes table does not exist. Migration may not have been run.");
            return { upvoteCount: 0, downvoteCount: 0, voteScore: 0, userVote: null };
          }
          throw new Error(`Failed to get clip votes: ${error.message}`);
        }

        const upvoteCount = data.filter((v) => v.vote_type === "up").length;
        const downvoteCount = data.filter((v) => v.vote_type === "down").length;
        const voteScore = upvoteCount - downvoteCount;
        const userVote = userId
          ? (data.find((v) => v.user_id === userId)?.vote_type as "up" | "down" | null) || null
          : null;

        return {
          upvoteCount,
          downvoteCount,
          voteScore,
          userVote,
        };
      } catch (error: any) {
        if (error?.message?.includes("does not exist") || error?.code === "42P01") {
          console.warn("clip_votes table does not exist. Migration may not have been run.");
          return { upvoteCount: 0, downvoteCount: 0, voteScore: 0, userVote: null };
        }
        if (isTransientError(error)) {
          console.warn("Connection error getting votes:", error.message);
          return { upvoteCount: 0, downvoteCount: 0, voteScore: 0, userVote: null };
        }
        throw error;
      }
    });
  }

  async getClipVotesBatch(
    clipIds: string[],
    userId?: string
  ): Promise<Map<string, { upvoteCount: number; downvoteCount: number; voteScore: number; userVote: "up" | "down" | null }>> {
    return this.monitorDbOperation('getClipVotesBatch', async () => {
      if (clipIds.length === 0) {
        return new Map();
      }

      try {
        const { data, error } = await db
          .from("clip_votes")
          .select("clip_id, vote_type, user_id")
          .in("clip_id", clipIds);

        if (error) {
          if (error.message?.includes("does not exist") || error.code === "42P01") {
            console.warn("clip_votes table does not exist. Migration may not have been run.");
            const defaultMap = new Map();
            for (const clipId of clipIds) {
              defaultMap.set(clipId, { upvoteCount: 0, downvoteCount: 0, voteScore: 0, userVote: null });
            }
            return defaultMap;
          }
          if (isTransientError(error)) {
            console.warn("Connection error getting votes batch:", error.message);
            const defaultMap = new Map();
            for (const clipId of clipIds) {
              defaultMap.set(clipId, { upvoteCount: 0, downvoteCount: 0, voteScore: 0, userVote: null });
            }
            return defaultMap;
          }
          throw new Error(`Failed to get clip votes batch: ${error.message}`);
        }

        const votesMap = new Map<string, { upvoteCount: number; downvoteCount: number; voteScore: number; userVote: "up" | "down" | null }>();
        for (const clipId of clipIds) {
          votesMap.set(clipId, { upvoteCount: 0, downvoteCount: 0, voteScore: 0, userVote: null });
        }

        const votesByClip = new Map<string, Array<{ vote_type: string; user_id: string }>>();
        if (data) {
          for (const vote of data) {
            const existing = votesByClip.get(vote.clip_id) || [];
            existing.push({ vote_type: vote.vote_type, user_id: vote.user_id });
            votesByClip.set(vote.clip_id, existing);
          }
        }

        for (const [clipId, votes] of votesByClip.entries()) {
          const upvoteCount = votes.filter((v) => v.vote_type === "up").length;
          const downvoteCount = votes.filter((v) => v.vote_type === "down").length;
          const voteScore = upvoteCount - downvoteCount;
          const userVote = userId
            ? (votes.find((v) => v.user_id === userId)?.vote_type as "up" | "down" | null) || null
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
        if (error?.message?.includes("does not exist") || error?.code === "42P01") {
          console.warn("clip_votes table does not exist. Migration may not have been run.");
          const defaultMap = new Map();
          for (const clipId of clipIds) {
            defaultMap.set(clipId, { upvoteCount: 0, downvoteCount: 0, voteScore: 0, userVote: null });
          }
          return defaultMap;
        }
        if (isTransientError(error)) {
          console.warn("Connection error getting votes batch:", error.message);
          const defaultMap = new Map();
          for (const clipId of clipIds) {
            defaultMap.set(clipId, { upvoteCount: 0, downvoteCount: 0, voteScore: 0, userVote: null });
          }
          return defaultMap;
        }
        throw error;
      }
    });
  }

  // Helper: Calculate characters per second (all scripts: Latin, CJK, Cyrillic, Arabic, etc.)
  calculateCharactersPerSecond(clip: AudioClip): number | null {
    if (!clip.metadata.transcript || !clip.duration || clip.duration <= 0) {
      return null;
    }

    // Remove whitespace and punctuation/symbols, count remaining characters
    // Works for Latin, CJK, Cyrillic, Arabic, etc.
    const chars = clip.metadata.transcript.replace(/[\s\p{P}\p{S}]/gu, "").length;
    return chars / clip.duration;
  }

  // Helper: Calculate speed percentiles
  getSpeedPercentiles(clips: AudioClip[]): { slow: number; medium: number; fast: number } {
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
  ): Promise<FilterPreferences | null> {
    return this.monitorDbOperation('getUserFilterPreferences', async () => {
      const { data, error } = await db
        .from("profiles")
        .select("filter_preferences")
        .eq("id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null;
        }
        if (error.message?.includes("does not exist") || error.message?.includes("column")) {
          console.warn("filter_preferences column does not exist yet. Please run the database migration.");
          return null;
        }
        throw new Error(`Failed to get user filter preferences: ${error.message}`);
      }

      if (!data || !data.filter_preferences) {
        return null;
      }

      try {
        const preferences = data.filter_preferences as any;
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
            preferences.speakerAgeRange
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
        if (preferences.defaultSort && typeof preferences.defaultSort === "object") {
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

        return Object.keys(result).length > 0 ? result : null;
      } catch (parseError) {
        console.error("Failed to parse filter preferences:", parseError);
        return null;
      }
    });
  }

  async saveUserFilterPreferences(
    userId: string,
    preferences: FilterPreferences | null,
  ): Promise<void> {
    return this.monitorDbOperation('saveUserFilterPreferences', async () => {
      if (!preferences) {
        const { error } = await db
          .from("profiles")
          .update({ filter_preferences: null })
          .eq("id", userId);

        if (error) {
          throw new Error(`Failed to save user filter preferences: ${error.message}`);
        }
        return;
      }

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

      const valueToSave =
        Object.keys(preferencesToSave).length > 0 ? preferencesToSave : null;

      const { error } = await db
        .from("profiles")
        .update({ filter_preferences: valueToSave as Json })
        .eq("id", userId);

      if (error) {
        if (error.message?.includes("does not exist") || error.message?.includes("column")) {
          console.warn("filter_preferences column does not exist yet. Please run the database migration.");
          return;
        }
        throw new Error(`Failed to save user filter preferences: ${error.message}`);
      }
    });
  }
}

export const serverDb = new SupabaseDatabase();
