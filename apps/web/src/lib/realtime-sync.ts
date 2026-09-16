import { useCallback, useEffect, useRef } from "react";

const workflowRefreshEventName = "medilab-workflow-refresh";

interface RealtimeSyncOptions {
  enabled?: boolean;
  intervalMs?: number;
  onReportsReady?: (reports: any[], newCount: number) => void;
  onDataChanged?: (type: "patients" | "orders" | "reports" | "samples" | "payments", count: number) => void;
}

/**
 * React hook for real-time data synchronization via polling.
 * Enables instant notifications for critical updates without WebSocket overhead.
 *
 * Usage:
 * ```tsx
 * useRealtimeSync({
 *   enabled: userRole === "RECEPTION",
 *   intervalMs: 2000, // Check every 2 seconds
 *   onReportsReady: (reports, newCount) => {
 *     if (newCount > 0) toast(`${newCount} report(s) ready to print`);
 *   }
 * });
 * ```
 */
export function useRealtimeSync(options: RealtimeSyncOptions = {}) {
  const {
    enabled = true,
    intervalMs = 3000, // 3 second default polling
    onReportsReady,
    onDataChanged,
  } = options;

  const lastReportIdsRef = useRef<Set<string>>(new Set());
  const lastChangeCountsRef = useRef({
    patients: 0,
    orders: 0,
    reports: 0,
    samples: 0,
    payments: 0,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCheckingRef = useRef(false);

  const checkReportsReady = useCallback(async () => {
    if (isCheckingRef.current) return;

    try {
      isCheckingRef.current = true;
      const since = new Date(Date.now() - 1000 * 60 * 5).toISOString();
      const response = await fetch(`/api/workflow/reports-ready?since=${encodeURIComponent(since)}`, {
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Session expired, stop polling
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return;
      }

      const reports = await response.json();
      const newReportIds = new Set(reports.map((r: any) => r.id));
      const newReports = reports.filter((r: any) => !lastReportIdsRef.current.has(r.id));

      if (newReports.length > 0) {
        lastReportIdsRef.current = newReportIds;
        onReportsReady?.(newReports, newReports.length);
      }
    } catch (error) {
      console.warn("[RealtimeSync] Reports check failed:", error);
    } finally {
      isCheckingRef.current = false;
    }
  }, [onReportsReady]);

  const checkRecentChanges = useCallback(async () => {
    if (isCheckingRef.current) return;

    try {
      isCheckingRef.current = true;
      const response = await fetch("/api/workflow/recent-changes?minutes=5", {
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Session expired, stop polling
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return;
      }

      const data = await response.json();
      const { changedCounts } = data;

      // Notify on changes
      Object.entries(changedCounts).forEach(([type, count]: [string, number]) => {
        const lastCount =
          lastChangeCountsRef.current[type as keyof typeof changedCounts] ?? 0;
        if (count > lastCount) {
          onDataChanged?.(type as any, count - lastCount);
        }
      });

      lastChangeCountsRef.current = changedCounts;
    } catch (error) {
      console.warn("[RealtimeSync] Changes check failed:", error);
    } finally {
      isCheckingRef.current = false;
    }
  }, [onDataChanged]);

  const triggerRefresh = useCallback(() => {
    void checkReportsReady();
    void checkRecentChanges();
  }, [checkReportsReady, checkRecentChanges]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return; // Already polling

    // Check immediately on start
    triggerRefresh();

    // Then check periodically
    intervalRef.current = setInterval(() => {
      triggerRefresh();
    }, intervalMs);
  }, [intervalMs, triggerRefresh]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopPolling();
      return;
    }

    const handleImmediateRefresh = () => {
      triggerRefresh();
    };
    const handleBroadcastRefresh = () => {
      handleImmediateRefresh();
    };
    const handleStorageRefresh = (event: StorageEvent) => {
      if (event.key === "medilab-workflow-refresh") {
        handleImmediateRefresh();
      }
    };

    const channel = "medilab-nexus-sync";
    const broadcastChannel = "BroadcastChannel" in window ? new BroadcastChannel(channel) : null;

    if (broadcastChannel) {
      broadcastChannel.addEventListener("message", handleBroadcastRefresh);
    }
    window.addEventListener(workflowRefreshEventName, handleImmediateRefresh as EventListener);
    window.addEventListener("storage", handleStorageRefresh);

    startPolling();

    return () => {
      stopPolling();
      if (broadcastChannel) {
        broadcastChannel.removeEventListener("message", handleBroadcastRefresh);
        broadcastChannel.close();
      }
      window.removeEventListener(workflowRefreshEventName, handleImmediateRefresh as EventListener);
      window.removeEventListener("storage", handleStorageRefresh);
    };
  }, [enabled, startPolling, stopPolling, triggerRefresh]);

  return {
    checkReportsReady,
    checkRecentChanges,
    isEnabled: enabled,
    start: startPolling,
    stop: stopPolling,
  };
}
