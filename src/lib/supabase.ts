import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { supabaseMonitor } from "./supabase-monitor";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
  throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseAnonKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable"
  );
  throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

// TypeScript-safe constants (we know they're strings after the checks above)
const SUPABASE_URL: string = supabaseUrl;
const SUPABASE_ANON_KEY: string = supabaseAnonKey;

// Track client instances
const anonClientId = supabaseMonitor.registerClient('anonymous');

// Public / anon client for client-side read-only operations
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// ---------------------------------------------------------------------------
// Service-role client for server-side operations (bypasses RLS)
// ---------------------------------------------------------------------------
const serviceRoleClientId = supabaseMonitor.registerClient('service-role');

/**
 * Returns a Supabase client authenticated with the service role key.
 * Falls back to the anon key when SUPABASE_SERVICE_ROLE_KEY is not set
 * (e.g. in local development without the key configured).
 */
let _supabaseService: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Returns a Supabase client authenticated with the service role key.
 * Falls back to the anon key when SUPABASE_SERVICE_ROLE_KEY is not set
 * (e.g. in local development without the key configured).
 * Lazy-initialized to avoid throwing during Next.js build.
 */
export function getServiceClient() {
  if (_supabaseService) return _supabaseService;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.NODE_ENV === "production" && !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required in production");
  }
  const key = serviceKey || SUPABASE_ANON_KEY;
  if (!serviceKey) {
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY not set -- falling back to anon key. " +
        "Server-side writes will fail if RLS is still enabled."
    );
  }
  _supabaseService = createClient<Database>(SUPABASE_URL, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return _supabaseService;
}

// Lazy singleton — use this instead of calling getServiceClient() directly
export const supabaseService = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(_, prop) {
    return (getServiceClient() as any)[prop];
  },
});

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

// Helper function to get public URL for uploaded files
export const getPublicUrl = (path: string): string => {
  const startTime = Date.now();
  try {
    const { data } = supabase.storage.from("audio-clips").getPublicUrl(path);
    const duration = Date.now() - startTime;

    supabaseMonitor.logRequest({
      type: 'storage',
      operation: 'getPublicUrl',
      duration,
      status: 'success',
      responseSize: JSON.stringify(data).length,
    });

    return data.publicUrl;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    supabaseMonitor.logRequest({
      type: 'storage',
      operation: 'getPublicUrl',
      duration,
      status: 'failure',
      error: error?.message || 'Unknown error',
      errorCode: error?.code,
    });
    throw error;
  }
};

// Helper function to upload file and get the path
// Uses service role client (RLS removed)
export const uploadAudioFile = async (
  file: File,
  userId: string,
  filename: string,
): Promise<string> => {
  const startTime = Date.now();
  const filePath = `${userId}/${filename}`;

  console.log("Uploading:", filename, "for user:", userId);

  try {
    const { error } = await supabaseService.storage
      .from("audio-clips")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    const duration = Date.now() - startTime;

    if (error) {
      console.error("Upload failed:", error);
      supabaseMonitor.logRequest({
        type: 'storage',
        operation: 'upload',
        duration,
        status: 'failure',
        error: error.message,
        errorCode: (error as any)?.statusCode?.toString(),
      });
      throw new Error(`Upload failed: ${error.message}`);
    }

    supabaseMonitor.logRequest({
      type: 'storage',
      operation: 'upload',
      duration,
      status: 'success',
      responseSize: file.size,
    });

    console.log("File uploaded:", filePath);
    return filePath;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    supabaseMonitor.logRequest({
      type: 'storage',
      operation: 'upload',
      duration,
      status: 'failure',
      error: error?.message || 'Unknown error',
      errorCode: error?.code,
    });
    throw error;
  }
};

// Helper function to delete file from storage
export const deleteAudioFile = async (
  path: string,
): Promise<void> => {
  const startTime = Date.now();

  try {
    const { error } = await supabaseService.storage
      .from("audio-clips")
      .remove([path]);

    const duration = Date.now() - startTime;

    if (error) {
      console.warn(`Failed to delete file ${path}:`, error.message);
      supabaseMonitor.logRequest({
        type: 'storage',
        operation: 'delete',
        duration,
        status: 'failure',
        error: error.message,
        errorCode: (error as any)?.statusCode?.toString(),
      });
      // Don't throw - file might already be deleted
      return;
    }

    supabaseMonitor.logRequest({
      type: 'storage',
      operation: 'delete',
      duration,
      status: 'success',
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    supabaseMonitor.logRequest({
      type: 'storage',
      operation: 'delete',
      duration,
      status: 'failure',
      error: error?.message || 'Unknown error',
      errorCode: error?.code,
    });
    // Don't throw - file might already be deleted
  }
};
