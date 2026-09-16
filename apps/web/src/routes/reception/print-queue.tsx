import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Printer } from "lucide-react";
import { useRealtimeSync } from "@/lib/realtime-sync";
import { useToast } from "@/lib/ui/use-toast";
import { Button } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";

/**
 * Receptionist Print Queue Component
 *
 * Displays reports ready for printing with real-time updates via polling.
 * New reports appear instantly as they are signed off by physicians.
 *
 * Features:
 * - Instant notification when reports are ready (2-3 second latency)
 * - Auto-refresh every 3 seconds
 * - Toast notification for new reports
 * - Print button for each report
 * - Patient trace code and report details
 */
export function ReceptionPrintQueue() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notificationCount, setNotificationCount] = useState(0);

  // Fetch reports ready for printing
  const { data: reports = [], isLoading, refetch } = useQuery(
    ["reports-ready"],
    async () => {
      const since = new Date(Date.now() - 1000 * 60 * 5).toISOString();
      const response = await fetch(`/api/workflow/reports-ready?since=${encodeURIComponent(since)}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch reports");
      return response.json();
    },
    {
      staleTime: 2000, // Data is fresh for 2 seconds
      gcTime: 5000, // Keep in cache for 5 seconds
      refetchInterval: 3000, // Refetch every 3 seconds
      refetchIntervalInBackground: true, // Keep polling even when tab is backgrounded
    }
  );

  // Enable real-time sync with instant notifications
  useRealtimeSync({
    enabled: true,
    intervalMs: 2000, // Receptionist gets fastest updates
    onReportsReady: (newReports, newCount) => {
      if (newCount > 0) {
        // Trigger UI refresh
        refetch();

        // Show toast notification
        toast({
          title: "Reports Ready for Printing",
          description: `${newCount} report(s) are ready. Print now or they'll be queued.`,
          duration: 6000,
          className: "border-2 border-green-500",
          action: {
            label: "View Queue",
            onClick: () => {
              // Scroll to queue or open modal
              document.getElementById("print-queue")?.scrollIntoView({ behavior: "smooth" });
            },
          },
        });

        // Browser notification if permission granted
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("MediLab Reports Ready", {
            body: `${newCount} report(s) ready for printing`,
            icon: "/logo.png",
            tag: "reports-ready",
            requireInteraction: false,
          });
        }

        setNotificationCount((prev) => prev + newCount);
      }
    },
  });

  const handlePrint = async (reportId: string, patientTraceCode: string) => {
    try {
      // Fetch the printable report
      const response = await fetch(`/api/reports/${reportId}/printable`, {
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to fetch report");

      const html = await response.text();

      // Open print dialog
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();

        toast({
          title: "Print Dialog Opened",
          description: `${patientTraceCode} - Complete the print operation in the dialog`,
        });
      }
    } catch (error) {
      toast({
        title: "Print Failed",
        description: error instanceof Error ? error.message : "Could not open report for printing",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="text-muted-foreground">Loading print queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" id="print-queue">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Print Queue</h1>
          <p className="text-sm text-muted-foreground">
            Reports ready for printing from physicians
          </p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold text-blue-600">{reports.length}</div>
          <p className="text-sm text-muted-foreground">Ready to print</p>
          {notificationCount > 0 && (
            <p className="text-xs text-green-600">+{notificationCount} new today</p>
          )}
        </div>
      </div>

      {/* Empty state */}
      {reports.length === 0 ? (
        <Card className="flex flex-col items-center justify-center border-dashed py-16">
          <Printer className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-semibold">No Reports Waiting</p>
          <p className="text-sm text-muted-foreground">
            Queue is empty. Refreshing every 3 seconds...
          </p>
        </Card>
      ) : (
        /* Reports grid */
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card key={report.id} className="overflow-hidden transition-shadow hover:shadow-md">
              <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-4 md:gap-6">
                {/* Patient info */}
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Patient Trace Code
                  </p>
                  <p className="text-lg font-bold text-blue-600">{report.patientTraceCode}</p>
                  <p className="text-sm text-muted-foreground">{report.patientName}</p>
                </div>

                {/* Report info */}
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Report Title
                  </p>
                  <p className="text-sm font-semibold">{report.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {report.status === "RELEASED" && "Released"}
                    {report.status === "APPROVED" && "Approved"}
                  </p>
                </div>

                {/* Signed by info */}
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Signed By
                  </p>
                  <p className="text-sm font-medium">{report.signedBy || "—"}</p>
                  {report.signedAt && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(report.signedAt).toLocaleTimeString()}
                    </p>
                  )}
                </div>

                {/* Critical flag & action */}
                <div className="flex flex-col items-end justify-between md:justify-start">
                  {report.criticalFlag && (
                    <div className="mb-2 flex items-center gap-1 rounded-full bg-red-50 px-3 py-1">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span className="text-xs font-semibold text-red-600">Critical</span>
                    </div>
                  )}
                  <Button
                    onClick={() => handlePrint(report.id, report.patientTraceCode)}
                    className="gap-2 bg-blue-600 hover:bg-blue-700"
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Refresh indicator */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <div className="h-2 w-2 animate-pulse rounded-full bg-green-600"></div>
        Auto-refreshing every 3 seconds...
      </div>
    </div>
  );
}
