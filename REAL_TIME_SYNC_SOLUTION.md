# Real-Time Sync Solution for MediLab Nexus

## Problem
Currently, the system uses request-response polling with long intervals (10-30 seconds), causing delays in notification of:
- Reports ready for printing (receptionist)
- Patient data updates (all portals)
- Order status changes (all portals)

## Solution Overview
Implement **efficient polling with instant change detection** - no external dependencies required, works with existing database.

### Architecture
1. **Heartbeat Endpoints** - Fast endpoints that return only changed data since last check
2. **Web Client Polling** - Check every 3-5 seconds instead of 30 seconds for critical updates
3. **Event Tracking** - Database tracks when entities were last synced per user
4. **Selective Refresh** - Only fetch data that actually changed

## Implementation Steps

### 1. Add Real-Time Event Types (✅ Already Done)

File: `packages/shared/src/index.ts`
- Added `RealtimeEventType` enum with event categories
- Added `RealtimeEvent<T>` generic type for event payloads
- Added `ReportSavedRealtimePayload` type for report print notifications

### 2. Create API Endpoints for Instant Updates

#### Endpoint: `/api/workflow/reports-ready`
Returns reports that are RELEASED/APPROVED (ready for printing).

```typescript
// Add to apps/api/src/server.ts

app.get("/api/workflow/reports-ready", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }

  // Only RECEPTION role can print
  if (request.actor.role !== "RECEPTION") {
    return reply.code(403).send({ message: "Only receptionists can access print queue" });
  }

  const minCreatedAt = request.query as { since?: string };
  const sinceDate = minCreatedAt.since ? new Date(minCreatedAt.since) : new Date(Date.now() - 1000 * 60 * 5); // Last 5 minutes
  
  const reports = await prisma.report.findMany({
    where: {
      status: { in: ["RELEASED", "APPROVED"] },
      createdAt: { gte: sinceDate },
    },
    include: {
      patient: true,
      order: { include: { items: { include: { catalogItem: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return reports.map(serializeSavedReport);
});
```

#### Endpoint: `/api/workflow/recent-changes`
Returns summary of recent patient/order/report changes.

```typescript
app.get("/api/workflow/recent-changes", async (request, reply) => {
  if (!request.actor.authenticated) {
    return unauthorized(reply);
  }

  const sinceMinutes = Math.max(1, Math.min(30, Number((request.query as any).minutes) || 5));
  const sinceTime = new Date(Date.now() - 1000 * 60 * sinceMinutes);

  const [patientCount, orderCount, reportCount, sampleCount, paymentCount] = 
    await Promise.all([
      prisma.patient.count({ where: { updatedAt: { gte: sinceTime } } }),
      prisma.diagnosticOrder.count({ where: { updatedAt: { gte: sinceTime } } }),
      prisma.report.count({ where: { updatedAt: { gte: sinceTime } } }),
      prisma.sample.count({ where: { updatedAt: { gte: sinceTime } } }),
      prisma.paymentRecord.count({ where: { createdAt: { gte: sinceTime } } }),
    ]);

  return {
    timeWindowMinutes: sinceMinutes,
    changedCounts: {
      patients: patientCount,
      orders: orderCount,
      reports: reportCount,
      samples: sampleCount,
      payments: paymentCount,
    },
    hasChanges: patientCount > 0 || orderCount > 0 || reportCount > 0 || sampleCount > 0 || paymentCount > 0,
    lastCheckedAt: new Date().toISOString(),
  };
});
```

### 3. Web Client Hook for Real-Time Updates

Create file: `apps/web/src/lib/realtime-sync.ts`

```typescript
import { useCallback, useEffect, useRef, useRef } from "react";

interface RealtimeSyncOptions {
  enabled?: boolean;
  intervalMs?: number;
  onReportsReady?: (count: number) => void;
  onDataChanged?: (type: "patients" | "orders" | "reports" | "samples" | "payments") => void;
}

export function useRealtimeSync(options: RealtimeSyncOptions = {}) {
  const {
    enabled = true,
    intervalMs = 3000, // 3 second polling for critical updates
    onReportsReady,
    onDataChanged,
  } = options;

  const lastReportCheckRef = useRef<Record<string, boolean>>({});
  const lastChangeCountsRef = useRef({ patients: 0, orders: 0, reports: 0, samples: 0, payments: 0 });

  const checkReportsReady = useCallback(async () => {
    try {
      const since = new Date(Date.now() - 1000 * 60 * 5).toISOString();
      const response = await fetch(`/api/workflow/reports-ready?since=${since}`, {
        credentials: "include",
      });

      if (!response.ok) return;

      const reports = await response.json();
      const newReports = reports.filter((r: any) => !lastReportCheckRef.current[r.id]);

      if (newReports.length > 0) {
        newReports.forEach((r: any) => {
          lastReportCheckRef.current[r.id] = true;
        });
        onReportsReady?.(newReports.length);
      }
    } catch (error) {
      console.warn("Real-time sync check failed:", error);
    }
  }, [onReportsReady]);

  const checkRecentChanges = useCallback(async () => {
    try {
      const response = await fetch("/api/workflow/recent-changes?minutes=5", {
        credentials: "include",
      });

      if (!response.ok) return;

      const data = await response.json();
      const { changedCounts } = data;

      // Notify on changes
      Object.entries(changedCounts).forEach(([type, count]: [string, number]) => {
        const lastCount = lastChangeCountsRef.current[type as keyof typeof changedCounts] ?? 0;
        if (count > lastCount) {
          onDataChanged?.(type as any);
        }
      });

      lastChangeCountsRef.current = changedCounts;
    } catch (error) {
      console.warn("Real-time sync check failed:", error);
    }
  }, [onDataChanged]);

  useEffect(() => {
    if (!enabled) return;

    // Check immediately on mount
    checkReportsReady();
    checkRecentChanges();

    // Then check periodically
    const interval = setInterval(() => {
      checkReportsReady();
      checkRecentChanges();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [enabled, intervalMs, checkReportsReady, checkRecentChanges]);

  return { checkReportsReady, checkRecentChanges };
}
```

### 4. Integration in Web App Layout

File: `apps/web/src/routes/portal-layout.tsx`

```typescript
import { useRealtimeSync } from "@/lib/realtime-sync";
import { useToast } from "@/lib/ui/use-toast";

export function PortalLayout() {
  const { toast } = useToast();
  const userRole = useSession().user?.role;

  useRealtimeSync({
    enabled: true,
    intervalMs: userRole === "RECEPTION" ? 2000 : 5000, // Faster for reception (print queue)
    onReportsReady: (count) => {
      if (userRole === "RECEPTION") {
        toast({
          title: "Reports Ready",
          description: `${count} report(s) ready for printing`,
          variant: "default",
          duration: 5000,
        });
      }
    },
    onDataChanged: (type) => {
      if (type === "reports") {
        // Refresh reports view
        queryClient.invalidateQueries(["reports"]);
      } else if (type === "orders") {
        queryClient.invalidateQueries(["orders"]);
      }
    },
  });

  return (
    // ... existing layout code
  );
}
```

### 5. Receptionist Print Queue View

File: `apps/web/src/routes/reception/print-queue.tsx`

```typescript
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ReportCard } from "@/components/report-card";

export function PrintQueue() {
  const { data: reports, refetch } = useQuery(
    ["reports-ready"],
    async () => {
      const since = new Date(Date.now() - 1000 * 60 * 5).toISOString();
      const response = await fetch(`/api/workflow/reports-ready?since=${since}`, {
        credentials: "include",
      });
      return response.json();
    },
    {
      refetchInterval: 3000, // Refresh every 3 seconds
      staleTime: 2000, // Data stale after 2 seconds
    }
  );

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Print Queue</h1>
        <div className="text-sm text-muted-foreground">
          {reports?.length || 0} report(s) ready
        </div>
      </div>

      {!reports || reports.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No reports waiting for printing</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
```

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Report notification delay | ~2-3 seconds (RECEPTION role) |
| Order update delay | ~5 seconds (other roles) |
| Database queries/minute | ~10-12 (1 check every 3-5s) |
| Network payload | ~1-2 KB per check |
| Browser memory impact | Negligible |

## Migration Path

1. ✅ Add `RealtimeEventType` types to shared package
2. Create API endpoints for quick change detection
3. Add React hook for polling logic
4. Integrate hook into portal layout
5. Update receptionist print queue view
6. Monitor performance and adjust intervals

## Future Enhancements

- Add WebSocket support when dependencies allow (optional improvement)
- Implement Server-Sent Events (SSE) for true push
- Add change tracking table for precise delta queries
- Client-side change queue for offline support

## Deployment Notes

- No database migrations needed
- No new npm dependencies required
- Backward compatible with existing polling system
- Can be toggled per-role via config

