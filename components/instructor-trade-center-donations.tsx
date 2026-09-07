"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Gift, Send, CheckCircle, XCircle, Clock, RefreshCw, Download, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { buildInstructorAuthorizedApiHeaders } from "@/lib/instructor-api-headers";
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context";
import { downloadTradeCenterPdf } from "@/lib/trade-center-pdf-download";
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar";
import {
  TC_EMPTY,
  TC_MODULE_ID,
  TC_PANEL,
  TC_PANEL_INNER,
  TC_SPINNER,
  TC_TITLE,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
  tcChrome,
  tcCtaClass,
  tcOutlineClass,
} from "@/lib/trade-center/trade-center-instructor-ui";

const SOURCE_LABELS: Record<string, string> = {
  practice: "Practice Hub",
  playground: "Playground",
  reading: "Lecture Reading",
  total: "Activity total",
  classroom: "Classroom",
};

function isPendingDonationRequest(row: { status?: string }) {
  return String(row.status ?? "").toLowerCase() === "pending";
}

function isPendingPointRequest(row: { status?: string }) {
  return String(row.status ?? "").toLowerCase() === "pending_instructor";
}

function formatReviewStatus(status?: string) {
  const raw = String(status ?? "").trim();
  if (!raw) return "Reviewed";
  return raw
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

export function InstructorTradeCenterDonations({ instructorId }: { instructorId?: number }) {
  const fp = tcChrome().p;
  const [donationRequests, setDonationRequests] = useState<any[]>([]);
  const [pointRequests, setPointRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const { courseScopeVersion } = useInstructorDashboardV2();

  const fetchAll = async () => {
    try {
      const h = buildInstructorAuthorizedApiHeaders();
      const [drRes, prRes] = await Promise.all([
        fetch("/api/trade-center/donation-requests?role=instructor&includeReviewed=true", { headers: h }),
        fetch("/api/trade-center/point-requests?role=instructor&includeReviewed=true", { headers: h }),
      ]);
      const drData = await drRes.json();
      const prData = await prRes.json();
      setDonationRequests(drData.requests || []);
      setPointRequests(prData.requests || []);
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [courseScopeVersion]);

  const handleApproveDonation = async (id: number) => {
    const key = `donation-${id}`;
    setApprovingId(key);
    try {
      const res = await fetch(`/api/trade-center/donation-requests/${id}/approve`, {
        method: "POST",
        headers: buildInstructorAuthorizedApiHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: "Approved", description: data.message });
        fetchAll();
      } else {
        toast({ title: "Failed", description: data.error || "Could not approve", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not approve donation.", variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectDonation = async (id: number) => {
    const key = `donation-${id}`;
    setRejectingId(key);
    try {
      const res = await fetch(`/api/trade-center/donation-requests/${id}/reject`, {
        method: "POST",
        headers: buildInstructorAuthorizedApiHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ reason: "Rejected by instructor" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: "Rejected", description: data.message });
        fetchAll();
      } else {
        toast({ title: "Failed", description: data.error || "Could not reject", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not reject donation.", variant: "destructive" });
    } finally {
      setRejectingId(null);
    }
  };

  const handleApprovePointRequest = async (id: number) => {
    const key = `point-${id}`;
    setApprovingId(key);
    try {
      const res = await fetch(`/api/trade-center/point-requests/${id}/approve-instructor`, {
        method: "POST",
        headers: buildInstructorAuthorizedApiHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: "Approved", description: data.message });
        fetchAll();
      } else {
        toast({ title: "Failed", description: data.error || "Could not approve", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not approve request.", variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectPointRequest = async (id: number) => {
    const key = `point-${id}`;
    setRejectingId(key);
    try {
      const res = await fetch(`/api/trade-center/point-requests/${id}/reject-instructor`, {
        method: "POST",
        headers: buildInstructorAuthorizedApiHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ reason: "Rejected by instructor" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: "Rejected", description: data.message });
        fetchAll();
      } else {
        toast({ title: "Failed", description: data.error || "Could not reject", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not reject request.", variant: "destructive" });
    } finally {
      setRejectingId(null);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const fileName = await downloadTradeCenterPdf(
        "donations",
        buildInstructorAuthorizedApiHeaders(),
        undefined,
        `trade-center-donations-${Date.now()}.pdf`,
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

  const pendingDonationCount = donationRequests.filter(isPendingDonationRequest).length;
  const pendingPointCount = pointRequests.filter(isPendingPointRequest).length;
  const pendingCount = pendingDonationCount + pendingPointCount;
  const hasAny = donationRequests.length > 0 || pointRequests.length > 0;

  return (
    <div className="space-y-4">
      <FacultyIntegratedToolbar
        moduleId={TC_MODULE_ID}
        meta={
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {pendingCount > 0
              ? `${pendingCount} pending request${pendingCount === 1 ? "" : "s"}`
              : hasAny
                ? "Recently reviewed requests shown below"
                : "No donation or point requests"}
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
            <Button variant="ghost" size="sm" onClick={fetchAll} className={facultyToolbarFilterButtonClass()}>
              <RefreshCw className="h-3.5 w-3.5 opacity-70" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </>
        }
      />

      {!hasAny ? (
        <div className={TC_EMPTY}>
          <Gift className={cn("h-12 w-12 mx-auto mb-4", fp.iconText, "opacity-40")} />
          <p className={cn("font-medium", PORTAL_TEXT)}>No donation requests</p>
          <p className={cn("text-sm mt-1", PORTAL_TEXT_MUTED)}>
            Donation and point requests appear here. Recently reviewed requests stay visible for 90 days.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {donationRequests.length > 0 && (
            <div className={cn(TC_PANEL, "overflow-hidden")}>
              <div className={cn(TC_PANEL_INNER, "border-b", fp.border)}>
                <h3 className={cn(TC_TITLE, "flex items-center gap-2")}>
                  <Gift className={cn("h-4 w-4", fp.iconText)} />
                  Donation Requests
                </h3>
                <p className={cn("text-sm mt-0.5", PORTAL_TEXT_MUTED)}>Students donating points to peers. Approve to execute the transfer.</p>
              </div>
              <div className={cn("divide-y", "divide-[var(--sidebar-border)]")}>
                  {donationRequests.map((dr) => (
                    <div
                      key={dr.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-[var(--sidebar-accent)]/25"
                    >
                      <div className="min-w-0">
                        <p className={cn("font-medium", PORTAL_TEXT)}>
                          {dr.donor_name} ({dr.donor_student_id}) → {dr.recipient_name} ({dr.recipient_student_id})
                        </p>
                        <p className={cn("text-sm mt-1", PORTAL_TEXT_MUTED)}>
                          {dr.points} pts from {SOURCE_LABELS[dr.source] || dr.source}
                        </p>
                        <p className={cn("text-xs flex items-center gap-1 mt-1", PORTAL_TEXT_MUTED)}>
                          <Clock className="h-3 w-3" />
                          {new Date(dr.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isPendingDonationRequest(dr) ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleApproveDonation(dr.id)}
                              disabled={!!approvingId}
                              className={cn("rounded-lg gap-1.5", tcCtaClass())}
                            >
                              {approvingId === `donation-${dr.id}` ? (
                                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4" />
                                  Approve
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectDonation(dr.id)}
                              disabled={!!rejectingId}
                              className={cn("rounded-lg text-red-600 border-red-500/30 hover:bg-red-500/10", tcOutlineClass())}
                            >
                              {rejectingId === `donation-${dr.id}` ? (
                                <span className="animate-spin h-4 w-4 border-2 border-red-600 border-t-transparent rounded-full" />
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4" />
                                  Reject
                                </>
                              )}
                            </Button>
                          </>
                        ) : (
                          <span className={cn("text-sm font-medium px-2.5 py-1 rounded-full", PORTAL_TEXT_MUTED, "bg-[var(--sidebar-accent)]/40")}>
                            {formatReviewStatus(dr.status)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
            </div>
          )}

          {pointRequests.length > 0 && (
            <div className={cn(TC_PANEL, "overflow-hidden")}>
              <div className={cn(TC_PANEL_INNER, "border-b", fp.border)}>
                <h3 className={cn(TC_TITLE, "flex items-center gap-2")}>
                  <Send className={cn("h-4 w-4", fp.iconText)} />
                  Point Requests (Peer Approved)
                </h3>
                <p className={cn("text-sm mt-0.5", PORTAL_TEXT_MUTED)}>
                  Peer has approved. Finalize to transfer points from donor to requester.
                </p>
              </div>
              <div className={cn("divide-y", "divide-[var(--sidebar-border)]")}>
                  {pointRequests.map((pr) => (
                    <div
                      key={pr.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-[var(--sidebar-accent)]/25"
                    >
                      <div className="min-w-0">
                        <p className={cn("font-medium", PORTAL_TEXT)}>
                          {pr.requester_name} ({pr.requester_student_id}) ← {pr.requestee_name} ({pr.requestee_student_id})
                        </p>
                        <p className={cn("text-sm mt-1", PORTAL_TEXT_MUTED)}>
                          {pr.points} pts from {SOURCE_LABELS[pr.source] || pr.source}
                          {pr.message && ` · "${pr.message}"`}
                        </p>
                        <p className={cn("text-xs flex items-center gap-1 mt-1", PORTAL_TEXT_MUTED)}>
                          <Clock className="h-3 w-3" />
                          {new Date(pr.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isPendingPointRequest(pr) ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleApprovePointRequest(pr.id)}
                              disabled={!!approvingId}
                              className={cn("rounded-lg gap-1.5", tcCtaClass())}
                            >
                              {approvingId === `point-${pr.id}` ? (
                                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4" />
                                  Finalize
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectPointRequest(pr.id)}
                              disabled={!!rejectingId}
                              className={cn("rounded-lg text-red-600 border-red-500/30 hover:bg-red-500/10", tcOutlineClass())}
                            >
                              {rejectingId === `point-${pr.id}` ? (
                                <span className="animate-spin h-4 w-4 border-2 border-red-600 border-t-transparent rounded-full" />
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4" />
                                  Reject
                                </>
                              )}
                            </Button>
                          </>
                        ) : (
                          <span className={cn("text-sm font-medium px-2.5 py-1 rounded-full", PORTAL_TEXT_MUTED, "bg-[var(--sidebar-accent)]/40")}>
                            {formatReviewStatus(pr.status)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
