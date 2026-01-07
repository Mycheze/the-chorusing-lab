"use client";

import { useEffect, useState } from "react";
import type { RequestLog, ClientInstance, ConnectionStats } from "@/lib/supabase-monitor";

interface HealthTestResult {
  test: string;
  success: boolean;
  latency: number;
  error?: string;
}

interface InFlightRequest {
  id: string;
  type: 'auth' | 'database' | 'storage' | 'unknown';
  operation: string;
  startTime: number;
  duration: number;
}

interface HealthReportData {
  connectionStatus: "connected" | "degraded" | "error";
  lastSuccessTime: number | null;
  recentLogs: RequestLog[];
  inFlightRequests?: InFlightRequest[];
  stats: ConnectionStats;
  clientInstances: ClientInstance[];
  clientCount: number;
  envInfo: {
    supabaseUrl: string;
    environment: string;
    nodeVersion: string;
    nextVersion: string;
    supabaseClientVersion: string;
  };
  healthTests: HealthTestResult[];
  timestamp: number;
}

export default function HealthReportPage() {
  const [data, setData] = useState<HealthReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const fetchData = async (runTests = false) => {
    try {
      const response = await fetch(
        `/api/health-report${runTests ? "?test=true" : ""}`
      );
      
      if (response.ok) {
        const healthData = await response.json();
        setData(healthData);
      }
    } catch (error) {
      console.error("Failed to fetch health report:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (autoRefresh) {
      const interval = setInterval(() => fetchData(), 5000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh]);

  const exportLogs = () => {
    if (!data) return;
    const exportData = {
      ...data,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `health-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "text-green-600 bg-green-50";
      case "failure":
        return "text-red-600 bg-red-50";
      case "timeout":
        return "text-yellow-600 bg-yellow-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getConnectionStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "text-green-600";
      case "degraded":
        return "text-yellow-600";
      case "error":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const filteredLogs = data?.recentLogs.filter((log) => {
    if (filterType !== "all" && log.type !== filterType) return false;
    if (filterStatus !== "all" && log.status !== filterStatus) return false;
    return true;
  });

  if (loading && !data) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">Health Report</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">Health Report</h1>
          <p className="text-red-600">Failed to load health report</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Supabase Health Report</h1>
          <div className="flex gap-2">
            <button
              onClick={() => fetchData(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Run Tests & Refresh
            </button>
            <button
              onClick={() => fetchData()}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Refresh
            </button>
            <button
              onClick={exportLogs}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Export Logs
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-white border rounded cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span>Auto-refresh (5s)</span>
            </label>
          </div>
        </div>

        {/* Connection Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600">Status</div>
              <div
                className={`text-2xl font-bold ${getConnectionStatusColor(
                  data.connectionStatus
                )}`}
              >
                {data.connectionStatus.toUpperCase()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Last Success</div>
              <div className="text-lg">
                {data.lastSuccessTime
                  ? new Date(data.lastSuccessTime).toLocaleTimeString()
                  : "Never"}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Active Clients</div>
              <div className="text-lg font-semibold">{data.clientCount}</div>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Statistics (Last Hour)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">Total Requests</div>
              <div className="text-2xl font-bold">{data.stats.totalRequests}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Success Rate</div>
              <div className="text-2xl font-bold text-green-600">
                {data.stats.totalRequests > 0
                  ? Math.round(
                      (data.stats.successCount / data.stats.totalRequests) * 100
                    )
                  : 0}
                %
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Avg Response Time</div>
              <div className="text-2xl font-bold">
                {data.stats.averageResponseTime}ms
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Failures</div>
              <div className="text-2xl font-bold text-red-600">
                {data.stats.failureCount}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">P95 Response Time</div>
              <div className="text-lg">{data.stats.p95ResponseTime}ms</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">P99 Response Time</div>
              <div className="text-lg">{data.stats.p99ResponseTime}ms</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Timeouts</div>
              <div className="text-lg text-yellow-600">
                {data.stats.timeoutCount}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Success Count</div>
              <div className="text-lg text-green-600">
                {data.stats.successCount}
              </div>
            </div>
          </div>
          {Object.keys(data.stats.errorBreakdown).length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-semibold mb-2">Error Breakdown</div>
              <div className="space-y-1">
                {Object.entries(data.stats.errorBreakdown).map(([error, count]) => (
                  <div key={error} className="flex justify-between text-sm">
                    <span className="text-gray-700">{error}</span>
                    <span className="font-semibold text-red-600">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Health Tests */}
        {data.healthTests && data.healthTests.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Health Tests</h2>
            <div className="space-y-2">
              {data.healthTests.map((test, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded ${
                    test.success ? "bg-green-50" : "bg-red-50"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{test.test}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm">
                        {test.latency > 0 ? `${test.latency}ms` : "N/A"}
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-sm ${
                          test.success
                            ? "bg-green-200 text-green-800"
                            : "bg-red-200 text-red-800"
                        }`}
                      >
                        {test.success ? "PASS" : "FAIL"}
                      </span>
                    </div>
                  </div>
                  {test.error && (
                    <div className="mt-2 text-sm text-red-600">{test.error}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* In-Flight Requests (Stuck Requests) */}
        {data.inFlightRequests && data.inFlightRequests.length > 0 && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-red-800">
              ⚠️ Stuck Requests ({data.inFlightRequests.length})
            </h2>
            <p className="text-sm text-red-600 mb-4">
              These requests have been running for a long time and may be stuck:
            </p>
            <div className="space-y-2">
              {data.inFlightRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-white p-3 rounded border border-red-200"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-semibold">{req.operation}</span>
                      <span className="ml-2 text-sm text-gray-600">({req.type})</span>
                    </div>
                    <div className="text-red-600 font-semibold">
                      {Math.round(req.duration / 1000)}s
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Started: {new Date(req.startTime).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Client Instances */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Client Instances</h2>
          {data.clientInstances.length === 0 ? (
            <p className="text-gray-500">No client instances tracked</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">ID</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-left p-2">Created</th>
                    <th className="text-left p-2">Last Used</th>
                    <th className="text-left p-2">Request Count</th>
                  </tr>
                </thead>
                <tbody>
                  {data.clientInstances.map((client) => (
                    <tr key={client.id} className="border-b">
                      <td className="p-2 text-sm font-mono">
                        {client.id.substring(0, 20)}...
                      </td>
                      <td className="p-2">{client.type}</td>
                      <td className="p-2 text-sm">
                        {new Date(client.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="p-2 text-sm">
                        {new Date(client.lastUsed).toLocaleTimeString()}
                      </td>
                      <td className="p-2">{client.requestCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Request History */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Recent Request History</h2>
            <div className="flex gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-1 border rounded"
              >
                <option value="all">All Types</option>
                <option value="auth">Auth</option>
                <option value="database">Database</option>
                <option value="storage">Storage</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1 border rounded"
              >
                <option value="all">All Status</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
                <option value="timeout">Timeout</option>
              </select>
            </div>
          </div>
          {filteredLogs && filteredLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Time</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-left p-2">Operation</th>
                    <th className="text-left p-2">Duration</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 text-sm">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="p-2">
                        <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                          {log.type}
                        </span>
                      </td>
                      <td className="p-2 font-mono text-sm">{log.operation}</td>
                      <td className="p-2">{log.duration}ms</td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-1 rounded text-xs ${getStatusColor(
                            log.status
                          )}`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="p-2 text-sm text-red-600 max-w-xs truncate">
                        {log.error || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">No requests match the filters</p>
          )}
        </div>

        {/* Environment Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Environment Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">Supabase URL</div>
              <div className="text-sm font-mono break-all">
                {data.envInfo.supabaseUrl}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Environment</div>
              <div className="text-sm">{data.envInfo.environment}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Node.js Version</div>
              <div className="text-sm">{data.envInfo.nodeVersion}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Next.js Version</div>
              <div className="text-sm">{data.envInfo.nextVersion}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Supabase Client Version</div>
              <div className="text-sm">{data.envInfo.supabaseClientVersion}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Last Updated</div>
              <div className="text-sm">
                {new Date(data.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
