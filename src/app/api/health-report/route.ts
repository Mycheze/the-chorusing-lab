import { NextRequest, NextResponse } from "next/server";
import { supabaseMonitor } from "@/lib/supabase-monitor";
import { supabase } from "@/lib/supabase";
import { serverDb } from "@/lib/server-database";

export const dynamic = "force-dynamic";

interface HealthTestResult {
  test: string;
  success: boolean;
  latency: number;
  error?: string;
}

/**
 * Sanitize error messages to remove sensitive information
 */
function sanitizeError(error: string | undefined): string | undefined {
  if (!error) return undefined;
  
  // Remove potential user IDs (UUIDs)
  let sanitized = error.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    "[USER_ID]"
  );
  
  // Remove potential email addresses
  sanitized = sanitized.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "[EMAIL]"
  );
  
  // Remove potential file paths
  sanitized = sanitized.replace(
    /\/[^\s]+/g,
    "[PATH]"
  );
  
  return sanitized;
}

/**
 * Mask Supabase URL to show only domain
 */
function maskSupabaseUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}`;
  } catch {
    return url.substring(0, 30) + "...";
  }
}

async function runHealthTests(): Promise<HealthTestResult[]> {
  const results: HealthTestResult[] = [];

  // Test 1: Database query
  try {
    const start = Date.now();
    await serverDb.getUserById("00000000-0000-0000-0000-000000000000"); // Non-existent ID, but tests connection
    const latency = Date.now() - start;
    results.push({
      test: "Database Query",
      success: true,
      latency,
    });
  } catch (error: any) {
    const latency = Date.now();
    results.push({
      test: "Database Query",
      success: false,
      latency: 0,
      error: error?.message || "Unknown error",
    });
  }

  // Test 2: Auth operation
  try {
    const start = Date.now();
    const { error } = await supabase.auth.getSession();
    const latency = Date.now() - start;
    
    // This will be logged by the auth.tsx wrapper, but we also log it here for the test
    supabaseMonitor.logRequest({
      type: 'auth',
      operation: 'getSession',
      duration: latency,
      status: error ? 'failure' : 'success',
      error: error?.message,
      errorCode: error?.status?.toString(),
    });
    
    results.push({
      test: "Auth GetSession",
      success: !error,
      latency,
      error: error?.message,
    });
  } catch (error: any) {
    const latency = Date.now();
    supabaseMonitor.logRequest({
      type: 'auth',
      operation: 'getSession',
      duration: latency,
      status: 'failure',
      error: error?.message || "Unknown error",
    });
    results.push({
      test: "Auth GetSession",
      success: false,
      latency: 0,
      error: error?.message || "Unknown error",
    });
  }

  // Test 3: Storage operation
  try {
    const start = Date.now();
    const { data, error } = await supabase.storage.listBuckets();
    const latency = Date.now() - start;
    
    supabaseMonitor.logRequest({
      type: 'storage',
      operation: 'listBuckets',
      duration: latency,
      status: error ? 'failure' : 'success',
      error: error?.message,
      errorCode: (error as any)?.statusCode?.toString(),
      responseSize: data ? JSON.stringify(data).length : undefined,
    });
    
    results.push({
      test: "Storage ListBuckets",
      success: !error,
      latency,
      error: error?.message,
    });
  } catch (error: any) {
    const latency = Date.now();
    supabaseMonitor.logRequest({
      type: 'storage',
      operation: 'listBuckets',
      duration: latency,
      status: 'failure',
      error: error?.message || "Unknown error",
      errorCode: (error as any)?.code || (error as any)?.statusCode?.toString(),
    });
    results.push({
      test: "Storage ListBuckets",
      success: false,
      latency: 0,
      error: error?.message || "Unknown error",
    });
  }

  return results;
}

export async function GET(request: NextRequest) {
  try {
    // Health report is publicly accessible (no auth required)
    // All sensitive data is sanitized before being returned
    const { searchParams } = new URL(request.url);
    const runTests = searchParams.get("test") === "true";

    // Check for stale requests and timeout them
    supabaseMonitor.checkForStaleRequests(30000); // 30 second timeout

    // Get in-flight requests (stuck requests)
    const inFlightRequests = supabaseMonitor.getInFlightRequests();

    // Get recent logs and sanitize error messages
    const recentLogs = supabaseMonitor.getRecentLogs(50).map(log => ({
      ...log,
      error: sanitizeError(log.error),
    }));

    // Get statistics
    const stats = supabaseMonitor.getStats();

    // Get client instances
    const clientInstances = supabaseMonitor.getClientInstances();

    // Get environment info (mask sensitive URLs)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "Not set";
    const envInfo = {
      supabaseUrl: maskSupabaseUrl(supabaseUrl),
      environment: process.env.NODE_ENV || "unknown",
      nodeVersion: process.version,
      nextVersion: "14.1.0", // Update if needed
      supabaseClientVersion: "2.39.7", // Update if needed
    };

    // Get last successful connection time
    const successfulLogs = recentLogs.filter((log) => log.status === "success");
    const lastSuccessTime =
      successfulLogs.length > 0
        ? successfulLogs[0].timestamp
        : null;

    // Run health tests if requested
    let healthTests: HealthTestResult[] = [];
    if (runTests) {
      healthTests = await runHealthTests();
    }

    // Sanitize error breakdown
    const sanitizedErrorBreakdown: Record<string, number> = {};
    Object.entries(stats.errorBreakdown).forEach(([error, count]) => {
      const sanitized = sanitizeError(error) || "Unknown error";
      sanitizedErrorBreakdown[sanitized] = (sanitizedErrorBreakdown[sanitized] || 0) + count;
    });

    // Calculate current connection status
    const recentFailures = recentLogs
      .filter((log) => log.status === "failure" || log.status === "timeout")
      .slice(0, 5);
    const connectionStatus =
      recentFailures.length === 0
        ? "connected"
        : recentFailures.length < 3
        ? "degraded"
        : "error";

    return NextResponse.json({
      connectionStatus,
      lastSuccessTime,
      recentLogs,
      inFlightRequests: inFlightRequests.map(req => ({
        ...req,
        operation: sanitizeError(req.operation) || req.operation,
      })),
      stats: {
        ...stats,
        errorBreakdown: sanitizedErrorBreakdown,
      },
      clientInstances,
      clientCount: clientInstances.length,
      envInfo,
      healthTests: healthTests.map(test => ({
        ...test,
        error: sanitizeError(test.error),
      })),
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error("Health report error:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to generate health report",
        connectionStatus: "error",
        timestamp: Date.now(),
      },
      { status: 500 }
    );
  }
}
