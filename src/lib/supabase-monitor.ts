/**
 * Supabase Connection Monitor
 * Tracks all Supabase requests, client instances, and connection health
 */

export interface RequestLog {
  id: string;
  type: 'auth' | 'database' | 'storage' | 'unknown';
  operation: string;
  timestamp: number;
  duration: number;
  status: 'success' | 'failure' | 'timeout';
  error?: string;
  errorCode?: string;
  responseSize?: number;
}

export interface ClientInstance {
  id: string;
  type: 'authenticated' | 'anonymous' | 'server';
  createdAt: number;
  lastUsed: number;
  requestCount: number;
}

export interface InFlightRequest {
  id: string;
  type: 'auth' | 'database' | 'storage' | 'unknown';
  operation: string;
  startTime: number;
  duration?: number;
}

export interface ConnectionStats {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorBreakdown: Record<string, number>;
}

class SupabaseMonitor {
  private requestLogs: RequestLog[] = [];
  private readonly MAX_LOGS = 100;
  private clientInstances: Map<string, ClientInstance> = new Map();
  private requestCounter = 0;
  private inFlightRequests: Map<string, InFlightRequest> = new Map();

  /**
   * Start tracking an in-flight request
   */
  startRequest(type: 'auth' | 'database' | 'storage' | 'unknown', operation: string): string {
    const id = `req-${Date.now()}-${++this.requestCounter}`;
    this.inFlightRequests.set(id, {
      id,
      type,
      operation,
      startTime: Date.now(),
    });
    return id;
  }

  /**
   * Complete a request (remove from in-flight, add to logs)
   */
  completeRequest(requestId: string, log: Omit<RequestLog, 'id' | 'timestamp'>): void {
    const inFlight = this.inFlightRequests.get(requestId);
    if (!inFlight) {
      // Request wasn't tracked as in-flight, log it anyway
      this.logRequest(log);
      return;
    }

    this.inFlightRequests.delete(requestId);
    
    const fullLog: RequestLog = {
      ...log,
      id: requestId,
      timestamp: inFlight.startTime,
    };

    this.requestLogs.unshift(fullLog);
    
    // Keep only the most recent logs
    if (this.requestLogs.length > this.MAX_LOGS) {
      this.requestLogs = this.requestLogs.slice(0, this.MAX_LOGS);
    }
  }

  /**
   * Mark an in-flight request as timed out
   */
  timeoutRequest(requestId: string, timeoutMs: number): void {
    const inFlight = this.inFlightRequests.get(requestId);
    if (!inFlight) return;

    this.inFlightRequests.delete(requestId);
    
    const duration = Date.now() - inFlight.startTime;
    const fullLog: RequestLog = {
      id: requestId,
      type: inFlight.type,
      operation: inFlight.operation,
      timestamp: inFlight.startTime,
      duration,
      status: 'timeout',
      error: `Request timed out after ${timeoutMs}ms`,
    };

    this.requestLogs.unshift(fullLog);
    
    if (this.requestLogs.length > this.MAX_LOGS) {
      this.requestLogs = this.requestLogs.slice(0, this.MAX_LOGS);
    }
  }

  /**
   * Log a Supabase request (backwards compatibility - creates in-flight then completes)
   */
  logRequest(log: Omit<RequestLog, 'id' | 'timestamp'>): string {
    const id = this.startRequest(log.type, log.operation);
    this.completeRequest(id, log);
    return id;
  }

  /**
   * Get currently in-flight requests (stuck requests)
   */
  getInFlightRequests(): InFlightRequest[] {
    const now = Date.now();
    return Array.from(this.inFlightRequests.values()).map(req => ({
      ...req,
      duration: now - req.startTime,
    }));
  }

  /**
   * Check for and timeout stale requests (older than timeoutMs)
   */
  checkForStaleRequests(timeoutMs: number = 30000): void {
    const now = Date.now();
    const staleIds: string[] = [];
    
    this.inFlightRequests.forEach((req, id) => {
      if (now - req.startTime > timeoutMs) {
        staleIds.push(id);
      }
    });

    staleIds.forEach(id => this.timeoutRequest(id, timeoutMs));
  }

  /**
   * Register a client instance
   */
  registerClient(type: 'authenticated' | 'anonymous' | 'server'): string {
    const id = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.clientInstances.set(id, {
      id,
      type,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      requestCount: 0,
    });
    return id;
  }

  /**
   * Update client usage
   */
  updateClientUsage(clientId: string): void {
    const client = this.clientInstances.get(clientId);
    if (client) {
      client.lastUsed = Date.now();
      client.requestCount++;
    }
  }

  /**
   * Unregister a client instance
   */
  unregisterClient(clientId: string): void {
    this.clientInstances.delete(clientId);
  }

  /**
   * Get recent request logs
   */
  getRecentLogs(limit: number = 50): RequestLog[] {
    return this.requestLogs.slice(0, limit);
  }

  /**
   * Get request logs within a time window
   */
  getLogsSince(timestamp: number): RequestLog[] {
    return this.requestLogs.filter(log => log.timestamp >= timestamp);
  }

  /**
   * Get connection statistics for the last hour
   */
  getStats(): ConnectionStats {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentLogs = this.getLogsSince(oneHourAgo);

    if (recentLogs.length === 0) {
      return {
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        timeoutCount: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorBreakdown: {},
      };
    }

    const successCount = recentLogs.filter(l => l.status === 'success').length;
    const failureCount = recentLogs.filter(l => l.status === 'failure').length;
    const timeoutCount = recentLogs.filter(l => l.status === 'timeout').length;

    const responseTimes = recentLogs
      .map(l => l.duration)
      .sort((a, b) => a - b);

    const averageResponseTime =
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;

    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);

    const errorBreakdown: Record<string, number> = {};
    recentLogs
      .filter(l => l.status === 'failure' && l.error)
      .forEach(log => {
        const errorKey = log.error || 'Unknown error';
        errorBreakdown[errorKey] = (errorBreakdown[errorKey] || 0) + 1;
      });

    return {
      totalRequests: recentLogs.length,
      successCount,
      failureCount,
      timeoutCount,
      averageResponseTime: Math.round(averageResponseTime),
      p95ResponseTime: responseTimes[p95Index] || 0,
      p99ResponseTime: responseTimes[p99Index] || 0,
      errorBreakdown,
    };
  }

  /**
   * Get all client instances
   */
  getClientInstances(): ClientInstance[] {
    return Array.from(this.clientInstances.values());
  }

  /**
   * Get client instance count
   */
  getClientCount(): number {
    return this.clientInstances.size;
  }

  /**
   * Clear all logs (for testing/debugging)
   */
  clearLogs(): void {
    this.requestLogs = [];
  }

  /**
   * Get all logs (for export)
   */
  getAllLogs(): RequestLog[] {
    return [...this.requestLogs];
  }
}

// Singleton instance
export const supabaseMonitor = new SupabaseMonitor();
