"use client";

import { useEffect, useState } from "react";
import { Trophy, Download, Loader2, RefreshCw } from "lucide-react";
import { buildInstructorAuthorizedApiHeaders } from "@/lib/instructor-api-headers";
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { downloadTradeCenterPdf } from "@/lib/trade-center-pdf-download";
import { cn } from "@/lib/utils";
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar";
import {
  TC_MODULE_ID,
  TC_PANEL,
  TC_PANEL_INNER,
  TC_SPINNER,
  TC_STAT_INSET,
  TC_TITLE,
  TC_ROW_HOVER,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
  tcChrome,
  tcIconBadge,
} from "@/lib/trade-center/trade-center-instructor-ui";

export function InstructorTradeCenterAnalytics({
  instructorId: _instructorId,
}: {
  instructorId?: number;
}) {
  const fp = tcChrome().p;
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { courseScopeVersion } = useInstructorDashboardV2();
  const { toast } = useToast();

  useEffect(() => {
    void fetchAnalytics();
  }, [courseScopeVersion]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/trade-center/analytics", {
        headers: buildInstructorAuthorizedApiHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setAnalytics(data);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const fileName = await downloadTradeCenterPdf(
        "analytics",
        buildInstructorAuthorizedApiHeaders(),
        undefined,
        `trade-center-analytics-${Date.now()}.pdf`,
      );
      toast({ title: "PDF downloaded", description: fileName });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not export PDF";
      toast({ title: "Export failed", description: msg, variant: "destructive" });
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className={cn("h-8 w-8", TC_SPINNER)} />
      </div>
    );
  }

  const topTraders = analytics?.topTraders ?? [];
  const q = searchQuery.trim().toLowerCase();
  const filteredTraders = q
    ? topTraders.filter((student: any) =>
        [student.full_name, student.student_number, student.section].some((field) =>
          String(field || "")
            .toLowerCase()
            .includes(q),
        ),
      )
    : topTraders;

  return (
    <div className="space-y-4">
      <FacultyIntegratedToolbar
        moduleId={TC_MODULE_ID}
        search={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchClear={() => setSearchQuery("")}
        searchPlaceholder="Search traders by name, ID, or section…"
        meta={
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {filteredTraders.length === topTraders.length
              ? `${topTraders.length} traders`
              : `${filteredTraders.length} of ${topTraders.length} traders`}
            {" · "}engagement credits and session breakdown
          </p>
        }
        trailing={
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={exportingPdf}
              onClick={() => void handleExportPdf()}
              className={facultyToolbarFilterButtonClass()}
            >
              {exportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 opacity-70" />}
              <span className="hidden sm:inline">Export PDF</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void fetchAnalytics()}
              disabled={loading}
              className={facultyToolbarFilterButtonClass()}
            >
              <RefreshCw className={cn("h-3.5 w-3.5 opacity-70", loading && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </>
        }
      />

      <div className={cn(TC_PANEL, TC_PANEL_INNER)}>
        <h3 className={TC_TITLE}>Top Traders</h3>
        <p className={cn("text-sm mt-0.5 mb-4", PORTAL_TEXT_MUTED)}>Students with highest Engagement Credits</p>
        <div className="space-y-2">
          {filteredTraders.length > 0 ? (
            filteredTraders.map((student: any, index: number) => (
              <div
                key={student.id}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors",
                  index < 3 ? cn(fp.softBg, fp.border) : cn("border-[var(--sidebar-border)]", TC_ROW_HOVER),
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                      index < 3 ? tcIconBadge("sm") : "bg-[var(--sidebar-accent)]/60 text-[var(--cc-text-muted)]",
                    )}
                  >
                    {index < 3 ? <Trophy className="h-4 w-4" /> : index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className={cn("truncate font-medium", PORTAL_TEXT)}>{student.full_name}</p>
                    <p className={cn("truncate text-xs", PORTAL_TEXT_MUTED)}>
                      {student.student_number} · {student.section}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn("font-bold", fp.iconText)}>{student.engagement_credits || 0} EC</p>
                  <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{student.total_points || 0} pts</p>
                </div>
              </div>
            ))
          ) : (
            <p className={cn("py-8 text-center text-sm", PORTAL_TEXT_MUTED)}>
              {q ? "No traders match your search" : "No trader data available"}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className={cn(TC_PANEL, TC_PANEL_INNER)}>
          <h3 className={TC_TITLE}>Transaction Summary</h3>
          <p className={cn("text-sm mt-0.5 mb-4", PORTAL_TEXT_MUTED)}>This week&apos;s trades and donations</p>
          <div className="space-y-2">
            {analytics?.transactions?.length > 0 ? (
              analytics.transactions.map((tx: any) => (
                <div key={tx.transaction_type} className={cn("flex items-center justify-between", TC_STAT_INSET)}>
                  <div>
                    <p className={cn("font-medium capitalize", PORTAL_TEXT)}>{tx.transaction_type}</p>
                    <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>{tx.count} transactions</p>
                  </div>
                  <div className="text-right">
                    <p className={cn("font-bold", PORTAL_TEXT)}>{tx.total_points || 0} pts</p>
                    <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Avg: {Number(tx.avg_points || 0).toFixed(0)}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className={cn("py-4 text-center text-sm", PORTAL_TEXT_MUTED)}>No transactions this week</p>
            )}
          </div>
        </div>

        <div className={cn(TC_PANEL, TC_PANEL_INNER)}>
          <h3 className={TC_TITLE}>Session Breakdown</h3>
          <p className={cn("text-sm mt-0.5 mb-4", PORTAL_TEXT_MUTED)}>Engagement by session</p>
          <div className="space-y-2">
            {analytics?.sessionBreakdown?.length > 0 ? (
              analytics.sessionBreakdown.map((session: any, index: number) => (
                <div key={`${session.session ?? "ALL"}-${index}`} className={cn("flex items-center justify-between", TC_STAT_INSET)}>
                  <div>
                    <p className={cn("font-medium", PORTAL_TEXT)}>{session.session || "ALL"}</p>
                    <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>{session.student_count} students</p>
                  </div>
                  <div className="text-right">
                    <p className={cn("font-bold", fp.iconText)}>{Number(session.avg_ec || 0).toFixed(1)} EC</p>
                    <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Avg: {Number(session.avg_points || 0).toFixed(0)} pts</p>
                  </div>
                </div>
              ))
            ) : (
              <p className={cn("py-4 text-center text-sm", PORTAL_TEXT_MUTED)}>No session data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
