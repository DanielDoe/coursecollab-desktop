"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Edit, UserPlus, BookOpen, Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers";
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context";
import { uniqueSessionCodes } from "@/lib/unique-session-codes";
import { FacultyAttendancePanel, FacultyAttendanceLoading } from "@/components/attendance/faculty-attendance-ui";
import {
  ATTENDANCE_INPUT,
  ATTENDANCE_TABLE_HEAD,
  ATTENDANCE_TABLE_ROW,
  PORTAL_CTA,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/attendance/attendance-surface-classes";
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome";
import { cn } from "@/lib/utils";

const chrome = facultyEmbedChrome("attendance");

interface GradebookAttendanceRow {
  studentId: number;
  studentName: string;
  studentNumber: string;
  section: string;
  gradeSession: string;
  attendanceScore: number;
  /** From `student_grades.last_calculated_at` — used when merging “All sections” fetches. */
  lastCalculatedAt: string | null;
}

function mergeGradebookRow(
  existing: GradebookAttendanceRow | undefined,
  incoming: GradebookAttendanceRow,
): GradebookAttendanceRow {
  if (!existing) return incoming;
  const t0 = existing.lastCalculatedAt ? Date.parse(existing.lastCalculatedAt) : 0;
  const t1 = incoming.lastCalculatedAt ? Date.parse(incoming.lastCalculatedAt) : 0;
  if (t1 > t0) return incoming;
  if (t1 < t0) return existing;
  if (existing.gradeSession === "ALL" && incoming.gradeSession !== "ALL") return incoming;
  if (incoming.gradeSession === "ALL" && existing.gradeSession !== "ALL") return existing;
  return incoming;
}

function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      return star[1].trim();
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(header);
  if (quoted?.[1]) return quoted[1].trim();
  const bare = /filename=([^;\s]+)/i.exec(header);
  return bare?.[1]?.replace(/^["']|["']$/g, "").trim() ?? null;
}

interface RosterStudentRow {
  studentId: number;
  fullName: string;
  studentNumber: string;
  section: string;
}

interface InstructorAttendanceGradebookProps {
  instructorId: string;
}

/** PATCH requires a section for roster auth — use filter, or each row’s section when viewing all sections. */
function resolvePatchAuthSection(
  sectionFilter: string,
  row: GradebookAttendanceRow | null,
): string | null {
  if (sectionFilter !== "all" && sectionFilter.trim()) return sectionFilter.trim();
  const fromRow = row?.section?.trim();
  return fromRow || null;
}

export function InstructorAttendanceGradebook({ instructorId }: InstructorAttendanceGradebookProps) {
  const { toast } = useToast();
  const { courseScopeVersion } = useInstructorDashboardV2();

  const [searchQuery, setSearchQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [availableSessions, setAvailableSessions] = useState<{ code: string }[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [gradebookRows, setGradebookRows] = useState<GradebookAttendanceRow[]>([]);
  const [loadingGradebook, setLoadingGradebook] = useState(false);
  const [gradebookRefreshNonce, setGradebookRefreshNonce] = useState(0);

  const [gbEditRow, setGbEditRow] = useState<GradebookAttendanceRow | null>(null);
  const [gbEditPercent, setGbEditPercent] = useState("");
  const [gbSaving, setGbSaving] = useState(false);
  const [gbAddOpen, setGbAddOpen] = useState(false);
  const [gbAddRoster, setGbAddRoster] = useState<RosterStudentRow[]>([]);
  const [gbAddRosterLoading, setGbAddRosterLoading] = useState(false);
  const [gbAddStudentId, setGbAddStudentId] = useState("");
  const [gbAddGradeSession, setGbAddGradeSession] = useState("");
  const [gbAddPercent, setGbAddPercent] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);

  const instructorAuthHeaders = (): Record<string, string> => ({
    ...buildInstructorApiHeaders(),
    Authorization: localStorage.getItem("instructorSession") || "",
    "x-instructor-id": localStorage.getItem("instructorId") || instructorId || "",
  });

  const fetchAvailableSessions = async () => {
    try {
      setLoadingSessions(true);
      const response = await instructorApiFetch("/api/instructor/sessions", {
        headers: buildInstructorApiHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableSessions(uniqueSessionCodes(data.sessions || []));
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    void fetchAvailableSessions();
  }, [courseScopeVersion]);

  useEffect(() => {
    if (loadingSessions) return;

    const loadGradebook = async () => {
      setLoadingGradebook(true);
      try {
        const hdrs = instructorAuthHeaders();

        const codes =
          sectionFilter !== "all"
            ? [sectionFilter]
            : [...new Set(availableSessions.map((s) => s.code).filter(Boolean))];

        if (codes.length === 0) {
          setGradebookRows([]);
          return;
        }

        const results = await Promise.all(
          codes.map((code) =>
            fetch(
              `/api/instructor/attendance-gradebook-scores?section=${encodeURIComponent(code)}`,
              { headers: hdrs },
            ).then((r) => (r.ok ? r.json() : { rows: [] })),
          ),
        );

        const byId = new Map<number, GradebookAttendanceRow>();
        for (const data of results) {
          for (const raw of data.rows || []) {
            const row: GradebookAttendanceRow = {
              studentId: Number(raw.studentId),
              studentName: String(raw.studentName ?? ""),
              studentNumber: String(raw.studentNumber ?? ""),
              section: String(raw.section ?? ""),
              gradeSession: String(raw.gradeSession ?? ""),
              attendanceScore: Math.min(100, Math.max(0, Number(raw.attendanceScore) || 0)),
              lastCalculatedAt:
                raw.lastCalculatedAt != null ? String(raw.lastCalculatedAt) : null,
            };
            byId.set(row.studentId, mergeGradebookRow(byId.get(row.studentId), row));
          }
        }
        setGradebookRows(
          Array.from(byId.values()).sort((a, b) =>
            a.studentName.localeCompare(b.studentName, undefined, { sensitivity: "base" }),
          ),
        );
      } catch (e) {
        console.error("Failed to load gradebook attendance:", e);
      } finally {
        setLoadingGradebook(false);
      }
    };

    void loadGradebook();
  }, [sectionFilter, availableSessions, loadingSessions, instructorId, gradebookRefreshNonce, courseScopeVersion]);

  const refreshGradebook = useCallback(() => {
    setGradebookRefreshNonce((n) => n + 1);
  }, []);

  const handleExportGradebookPdf = async () => {
    setExportingPdf(true);
    try {
      const qs =
        sectionFilter !== "all" && sectionFilter.trim()
          ? `?section=${encodeURIComponent(sectionFilter.trim())}`
          : "?section=all";
      const res = await instructorApiFetch(`/api/instructor/attendance-gradebook/export${qs}`, {
        headers: instructorAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === "string" ? err.error : "Export failed");
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const fromHeader = filenameFromContentDisposition(res.headers.get("content-disposition"));
      const fileName =
        fromHeader && /\.pdf$/i.test(fromHeader)
          ? fromHeader
          : `attendance-gradebook-${Date.now()}.pdf`;
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
      toast({ title: "PDF downloaded", description: fileName });
    } catch (e) {
      toast({
        title: "Export failed",
        description: e instanceof Error ? e.message : "Could not export PDF",
        variant: "destructive",
      });
    } finally {
      setExportingPdf(false);
    }
  };

  const patchGradebookAttendance = async (
    studentId: number,
    gradeSession: string,
    attendanceScore: number,
    authSection: string,
  ) => {
    const sec = authSection.trim();
    if (!sec) {
      toast({
        title: "Section required",
        description:
          "Choose a section in the filter, or ensure the student row has a section so we can authorize the update.",
        variant: "destructive",
      });
      return false;
    }
    const res = await fetch(
      `/api/instructor/attendance-gradebook-scores?section=${encodeURIComponent(sec)}`,
      {
        method: "PATCH",
        headers: {
          ...instructorAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studentId, gradeSession, attendanceScore }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "Save failed");
    }
    return true;
  };

  const openGbEdit = (row: GradebookAttendanceRow) => {
    setGbEditRow(row);
    setGbEditPercent(String(row.attendanceScore));
  };

  const saveGbEdit = async () => {
    if (!gbEditRow) return;
    const n = parseFloat(gbEditPercent);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      toast({
        title: "Invalid value",
        description: "Enter a percentage from 0 to 100.",
        variant: "destructive",
      });
      return;
    }
    const authSection = resolvePatchAuthSection(sectionFilter, gbEditRow);
    if (!authSection) {
      toast({
        title: "Cannot save",
        description:
          "Pick a section in the filter above, or fix the student’s section on the roster so this row has a section.",
        variant: "destructive",
      });
      return;
    }
    setGbSaving(true);
    try {
      await patchGradebookAttendance(gbEditRow.studentId, gbEditRow.gradeSession, n, authSection);
      toast({ title: "Saved", description: "Gradebook attendance % updated." });
      setGbEditRow(null);
      refreshGradebook();
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to save",
        variant: "destructive",
      });
    } finally {
      setGbSaving(false);
    }
  };

  const openGbAdd = async () => {
    if (sectionFilter === "all") return;
    setGbAddOpen(true);
    setGbAddGradeSession(sectionFilter);
    setGbAddStudentId("");
    setGbAddPercent("");
    setGbAddRosterLoading(true);
    try {
      const r = await fetch(
        `/api/instructor/attendance-roster?section=${encodeURIComponent(sectionFilter)}`,
        { headers: instructorAuthHeaders() },
      );
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setGbAddRoster([]);
        toast({
          title: "Roster error",
          description: typeof d.error === "string" ? d.error : "Could not load students.",
          variant: "destructive",
        });
        return;
      }
      setGbAddRoster(Array.isArray(d.students) ? d.students : []);
    } finally {
      setGbAddRosterLoading(false);
    }
  };

  const saveGbAdd = async () => {
    const sid = parseInt(gbAddStudentId, 10);
    if (!Number.isFinite(sid)) {
      toast({ title: "Select a student", variant: "destructive" });
      return;
    }
    const n = parseFloat(gbAddPercent);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      toast({
        title: "Invalid value",
        description: "Enter a percentage from 0 to 100.",
        variant: "destructive",
      });
      return;
    }
    const gs = gbAddGradeSession.trim();
    if (!gs) {
      toast({
        title: "Grade row required",
        description: "Choose which grade session to attach this to.",
        variant: "destructive",
      });
      return;
    }
    const authSection = resolvePatchAuthSection(sectionFilter, null);
    if (!authSection) {
      toast({
        title: "Pick a section",
        description: "Choose a section in the filter before adding a gradebook attendance value.",
        variant: "destructive",
      });
      return;
    }
    setGbSaving(true);
    try {
      await patchGradebookAttendance(sid, gs, n, authSection);
      toast({ title: "Saved", description: "Gradebook attendance % saved." });
      setGbAddOpen(false);
      refreshGradebook();
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to save",
        variant: "destructive",
      });
    } finally {
      setGbSaving(false);
    }
  };

  const filteredGradebookRows = gradebookRows.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.studentName.toLowerCase().includes(q) ||
      r.studentNumber.toLowerCase().includes(q) ||
      r.section.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-3">
      <FacultyAttendancePanel
        title="Attendance %"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={exportingPdf || loadingGradebook}
              onClick={() => void handleExportGradebookPdf()}
              variant="outline"
              className={cn("h-8 gap-1.5", chrome.quiet)}
            >
              {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              PDF
            </Button>
            {sectionFilter !== "all" ? (
              <Button type="button" size="sm" className={cn("h-8", PORTAL_CTA)} onClick={() => void openGbAdd()}>
                <UserPlus className="mr-1 h-4 w-4" />
                Set %
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
              <Input
                placeholder="Search students…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn("h-9 pl-9", ATTENDANCE_INPUT)}
              />
            </div>
            <Select value={sectionFilter} onValueChange={setSectionFilter} disabled={loadingSessions}>
              <SelectTrigger className={cn("h-9 w-[150px]", ATTENDANCE_INPUT)}>
                <SelectValue placeholder={loadingSessions ? "Loading…" : "Section"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sections</SelectItem>
                {availableSessions.map((session) => (
                  <SelectItem key={session.code} value={session.code}>
                    {session.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
        </div>
          {loadingGradebook ? (
            <FacultyAttendanceLoading />
          ) : filteredGradebookRows.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <div className={cn("mx-auto mb-3", chrome.iconBadge())}>
                <BookOpen className="h-5 w-5 !text-white" />
              </div>
              <p className={cn("font-medium", PORTAL_TEXT)}>No gradebook attendance scores for this filter</p>
              <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>
                When a section is selected, use Set attendance % to create or update attendance_score.
              </p>
              {sectionFilter !== "all" ? (
                <Button type="button" className={cn("mt-4", PORTAL_CTA)} onClick={() => void openGbAdd()}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Set gradebook attendance %
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={ATTENDANCE_TABLE_HEAD}>
                  <tr>
                    <th className={cn("px-3 py-2 text-left font-medium", PORTAL_TEXT_MUTED)}>Student</th>
                    <th className={cn("px-3 py-2 text-left font-medium", PORTAL_TEXT_MUTED)}>ID</th>
                    <th className={cn("px-3 py-2 text-left font-medium", PORTAL_TEXT_MUTED)}>Section</th>
                    <th className={cn("px-3 py-2 text-right font-medium", PORTAL_TEXT_MUTED)}>%</th>
                    <th className={cn("w-16 px-3 py-2 text-right font-medium", PORTAL_TEXT_MUTED)}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGradebookRows.map((row, idx) => (
                    <tr key={`${row.studentId}-${row.gradeSession}-${idx}`} className={ATTENDANCE_TABLE_ROW}>
                      <td className={cn("px-3 py-2", PORTAL_TEXT)}>{row.studentName}</td>
                      <td className={cn("px-3 py-2 font-mono text-xs", PORTAL_TEXT_MUTED)}>{row.studentNumber}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px]">{row.section}</Badge>
                      </td>
                      <td className={cn("px-3 py-2 text-right font-medium tabular-nums", PORTAL_TEXT)}>{row.attendanceScore}%</td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={cn("h-7 text-[var(--cc-text)]", chrome.quiet)}
                          disabled={!resolvePatchAuthSection(sectionFilter, row)}
                          onClick={() => openGbEdit(row)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </FacultyAttendancePanel>

      <Dialog open={gbEditRow !== null} onOpenChange={(open) => !open && setGbEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit gradebook attendance %</DialogTitle>
            <DialogDescription>
              {gbEditRow
                ? `${gbEditRow.studentName} — grade row “${gbEditRow.gradeSession}”. Other grade columns are unchanged.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Attendance (0–100)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={gbEditPercent}
              onChange={(e) => setGbEditPercent(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGbEditRow(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void saveGbEdit()}
              disabled={gbSaving || !gbEditRow || !resolvePatchAuthSection(sectionFilter, gbEditRow)}
            >
              {gbSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={gbAddOpen} onOpenChange={(open) => !open && setGbAddOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set gradebook attendance %</DialogTitle>
            <DialogDescription>
              Section <strong>{sectionFilter}</strong>. Creates or updates the{" "}
              <code className="text-xs">student_grades</code> row for the student and grade session you choose.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Student</Label>
              {gbAddRosterLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--cc-accent)] border-t-transparent" />
                  Loading roster…
                </div>
              ) : (
                <Select
                  value={gbAddStudentId || "__none__"}
                  onValueChange={(v) => setGbAddStudentId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose student…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Choose student…</SelectItem>
                    {gbAddRoster.map((s) => (
                      <SelectItem key={s.studentId} value={String(s.studentId)}>
                        {s.fullName} ({s.studentNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Grade row (session key)</Label>
              <Select
                value={gbAddGradeSession || "__none__"}
                onValueChange={(v) => setGbAddGradeSession(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Session key…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Choose…</SelectItem>
                  {sectionFilter !== "all" ? (
                    <SelectItem value={sectionFilter}>{sectionFilter} (this section)</SelectItem>
                  ) : null}
                  <SelectItem value="ALL">ALL</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Use the same session as your gradebook row (often the catalog section code or ALL).
              </p>
            </div>
            <div className="space-y-2">
              <Label>Attendance % (0–100)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={gbAddPercent}
                onChange={(e) => setGbAddPercent(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGbAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveGbAdd()} disabled={gbSaving || sectionFilter === "all"}>
              {gbSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
