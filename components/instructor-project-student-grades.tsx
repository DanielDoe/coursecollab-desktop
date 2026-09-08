"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Download,
  FileSpreadsheet,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { getProjectModuleSessionCodesForCourse, PROJECT_MODULE_SESSIONS } from "@/lib/project-module-sessions";
import { readFacultySelectedCourseCode } from "@/lib/project-presentation-course-scope";
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers";
import { instructorApiFetch } from "@/lib/instructor-api-headers";
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context";
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar";
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome";
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes";
import { ProjectGradeListCard } from "@/components/instructor/projects/project-overview-card";
import { cn } from "@/lib/utils";
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes";

type ProjectGradeSortColumn = "student" | "score" | "grade";

const GRADES_PERSIST = "instructor-project-grades";

interface GroupMemberRow {
  id: number;
  student_id: string;
  full_name: string;
}

interface StudentGrade {
  studentId: number;
  projectId: number;
  studentNumber: string;
  fullName: string;
  groupName: string;
  groupMembers: GroupMemberRow[];
  projectTitle: string;
  projectSummary: string | null;
  projectStatus: string;
  studentVotes: number;
  instructorVotes: number;
  studentPoints: number;
  instructorPoints: number;
  groupScore: number;
  /** 0–50 used for gradebook when set; otherwise groupScore */
  effectiveScore: number;
  overrideScore: number | null;
  session: string;
}

function parseGroupMembersFromProject(project: unknown, fallback: GroupMemberRow[]): GroupMemberRow[] {
  const p = project as Record<string, unknown>;
  const raw = p.members;
  if (!Array.isArray(raw)) return fallback;
  const out: GroupMemberRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = Number(r.id);
    if (!Number.isFinite(id)) continue;
    out.push({
      id,
      student_id: String(r.student_id ?? ""),
      full_name: String(r.full_name ?? ""),
    });
  }
  return out.length > 0 ? out : fallback;
}

function projectSummaryFromApi(project: unknown): string | null {
  const p = project as Record<string, unknown>;
  const s = p.summary;
  if (typeof s === "string" && s.trim().length > 0) return s.trim();
  return null;
}

function instructorAuthHeaders(): HeadersInit {
  const scope = getInstructorScopeHeaders() as Record<string, string>
  return {
    Authorization: typeof localStorage !== "undefined" ? localStorage.getItem("instructorSession") || "" : "",
    "Content-Type": "application/json",
    "x-instructor-id": typeof localStorage !== "undefined" ? localStorage.getItem("instructorId") || "" : "",
    ...scope,
  };
}

function MemberProjectScoreEditor({
  projectId,
  studentId,
  session,
  groupScore,
  overrideScore,
  onAfterSave,
}: {
  projectId: number;
  studentId: number;
  session: string;
  groupScore: number;
  overrideScore: number | null;
  onAfterSave: () => void;
}) {
  const { toast } = useToast();
  const [value, setValue] = useState(() => String(overrideScore ?? groupScore));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(String(overrideScore ?? groupScore));
  }, [overrideScore, groupScore, projectId, studentId]);

  const save = async () => {
    const n = parseFloat(value);
    if (!Number.isFinite(n) || n < 0 || n > 50) {
      toast({
        title: "Invalid score",
        description: "Enter a number from 0 to 50.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const res = await instructorApiFetch("/api/instructor/projects/member-scores", {
        method: "PUT",
        headers: instructorAuthHeaders(),
        body: JSON.stringify({
          projectId,
          studentId,
          session,
          score0To50: n,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Save failed");
      }
      toast({ title: "Saved", description: "Individual project score updated. Course grade recalculated when weights exist." });
      onAfterSave();
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to save",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const revert = async () => {
    setSaving(true);
    try {
      const res = await instructorApiFetch("/api/instructor/projects/member-scores", {
        method: "PUT",
        headers: instructorAuthHeaders(),
        body: JSON.stringify({
          projectId,
          studentId,
          session,
          score0To50: null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Revert failed");
      }
      setValue(String(groupScore));
      toast({ title: "Reverted", description: "This student again uses the group project total for this project." });
      onAfterSave();
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to revert",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const hasOverride = overrideScore != null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <Input
        type="number"
        min={0}
        max={50}
        step={0.5}
        className="h-8 w-[4.5rem] px-1.5 text-center font-mono text-xs"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={saving}
        aria-label="Individual project score 0 to 50"
      />
      <Button type="button" size="sm" className="h-8 px-2 text-xs" onClick={() => void save()} disabled={saving}>
        Save
      </Button>
      {hasOverride && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0 shrink-0"
          onClick={() => void revert()}
          disabled={saving}
          title="Use group total"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export function InstructorProjectStudentGrades({ embedInDashboard }: { embedInDashboard?: boolean } = {}) {
  const chrome = facultyEmbedChrome("projects");
  const fp = chrome.p;
  const cardBase = chrome.card;
  const { toast } = useToast();
  const { courseScopeVersion } = useInstructorDashboardV2();
  const [grades, setGrades] = useState<StudentGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionFilter, setSessionFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailRow, setDetailRow] = useState<StudentGrade | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = usePersistedState<number>(
    `${GRADES_PERSIST}-itemsPerPage`,
    10,
    "local",
  );
  const [sortColumn, setSortColumn] = usePersistedState<ProjectGradeSortColumn>(
    `${GRADES_PERSIST}-sortColumn`,
    "student",
    "local",
  );
  const [sortDirection, setSortDirection] = usePersistedState<"asc" | "desc">(
    `${GRADES_PERSIST}-sortDirection`,
    "asc",
    "local",
  );

  const sessions = useMemo(
    () => ["all", ...getProjectModuleSessionCodesForCourse(readFacultySelectedCourseCode())],
    [courseScopeVersion],
  );

  useEffect(() => {
    setSessionFilter("all");
    setSearchQuery("");
    setGrades([]);
  }, [courseScopeVersion]);

  const fetchStudentGrades = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) {
        setLoading(true);
      }

      const query =
        sessionFilter === "all" ? `/api/groups` : `/api/groups?session=${encodeURIComponent(sessionFilter)}`;

      const response = await instructorApiFetch(query, { headers: getInstructorScopeHeaders() });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to fetch groups");
      }

      const scoresResponse = await instructorApiFetch("/api/projects/list", {
        headers: getInstructorScopeHeaders(),
      });
      const scoresData = await scoresResponse.json().catch(() => ({}));

      const totalsRes = await instructorApiFetch("/api/projects/vote-totals", {
        headers: getInstructorScopeHeaders(),
      });
      const totalsJson = (await totalsRes.json().catch(() => ({}))) as {
        byProjectId?: Record<string, { totalScore?: number }>;
      };
      const voteTotalsByProjectId = new Map<number, number>();
      if (totalsRes.ok && totalsJson.byProjectId) {
        for (const [key, row] of Object.entries(totalsJson.byProjectId)) {
          const pid = Number(key);
          if (!Number.isFinite(pid)) continue;
          voteTotalsByProjectId.set(pid, Number(row?.totalScore) || 0);
        }
      }

      const overrideUrl =
        sessionFilter === "all"
          ? "/api/instructor/projects/member-scores"
          : `/api/instructor/projects/member-scores?session=${encodeURIComponent(sessionFilter)}`;
      const overrideRes = await fetch(overrideUrl, { headers: instructorAuthHeaders() });
      const overrideMap = new Map<string, number>();
      if (overrideRes.ok) {
        const ov = await overrideRes.json();
        for (const r of ov.overrides || []) {
          const pid = Number(r.project_id);
          const sid = Number(r.student_id);
          if (Number.isFinite(pid) && Number.isFinite(sid)) {
            overrideMap.set(`${pid}-${sid}`, Number(r.score_0_50));
          }
        }
      }

      const studentGrades: StudentGrade[] = [];

      for (const group of data.groups || []) {
        const project = scoresData.projects?.find((p: { group_id: number }) => p.group_id === group.id);

        if (!project) continue;

        const groupScore = voteTotalsByProjectId.get(project.id as number) ?? 0;

        const fallbackMembers: GroupMemberRow[] = Array.isArray(group.members)
          ? group.members.map((m: { id: number; student_id: string; full_name: string }) => ({
              id: Number(m.id),
              student_id: String(m.student_id ?? ""),
              full_name: String(m.full_name ?? ""),
            }))
          : [];

        if (group.members && Array.isArray(group.members)) {
          for (const member of group.members) {
            const sid = member.id as number;
            const pid = project.id as number;
            const ov = overrideMap.get(`${pid}-${sid}`);
            const effective = ov != null && Number.isFinite(ov) ? ov : groupScore;
            studentGrades.push({
              studentId: sid,
              projectId: pid,
              studentNumber: member.student_id,
              fullName: member.full_name,
              groupName: group.name,
              groupMembers: parseGroupMembersFromProject(project, fallbackMembers),
              projectTitle: project.title,
              projectSummary: projectSummaryFromApi(project),
              projectStatus: project.status,
              studentVotes: 0,
              instructorVotes: 0,
              studentPoints: 0,
              instructorPoints: 0,
              groupScore,
              effectiveScore: effective,
              overrideScore: ov != null && Number.isFinite(ov) ? ov : null,
              session: group.session,
            });
          }
        }
      }

      setGrades(studentGrades);
    } catch (error) {
      console.error("Error fetching student grades:", error);
      toast({
        title: "Error",
        description: "Failed to fetch student grades",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [sessionFilter, toast, courseScopeVersion]);

  useEffect(() => {
    void fetchStudentGrades();
  }, [fetchStudentGrades]);

  useEffect(() => {
    setDetailRow((current) => {
      if (!current) return null;
      const next = grades.find(
        (g) => g.studentId === current.studentId && g.projectId === current.projectId,
      );
      return next ?? null;
    });
  }, [grades]);

  useEffect(() => {
    setCurrentPage(1);
  }, [sessionFilter, searchQuery, sortColumn, sortDirection, itemsPerPage]);

  const filteredGrades = useMemo(() => {
    return grades.filter((g) => {
      const matchesSession = sessionFilter === "all" || g.session === sessionFilter;
      const matchesSearch =
        searchQuery === "" ||
        g.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.studentNumber.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSession && matchesSearch;
    });
  }, [grades, sessionFilter, searchQuery]);

  const sortedGrades = useMemo(() => {
    const mult = sortDirection === "asc" ? 1 : -1;
    return [...filteredGrades].sort((a, b) => {
      switch (sortColumn) {
        case "student":
          return mult * a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" });
        case "score":
          return mult * (a.effectiveScore - b.effectiveScore);
        case "grade": {
          const pctA = (a.effectiveScore / 50) * 100;
          const pctB = (b.effectiveScore / 50) * 100;
          return mult * (pctA - pctB);
        }
        default:
          return 0;
      }
    });
  }, [filteredGrades, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedGrades.length / itemsPerPage));

  useEffect(() => {
    setCurrentPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedGrades = sortedGrades.slice(startIndex, endIndex);

  const exportToCSV = () => {
    const headers = [
      "Student ID",
      "Student Name",
      "Group",
      "Session",
      "Project",
      "Group score",
      "Recorded score (0-50)",
    ];
    const rows = sortedGrades.map((g) => [
      g.studentNumber,
      g.fullName,
      g.groupName,
      g.session,
      g.projectTitle,
      g.groupScore.toFixed(1),
      g.effectiveScore.toFixed(1),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `student-project-grades-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();

    toast({
      title: "Export Complete",
      description: "Student grades exported to CSV",
    });
  };

  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20";
    if (percentage >= 80) return "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20";
    if (percentage >= 70) return "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20";
    if (percentage >= 60) return "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20";
    return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20";
  };

  const getLetterGrade = (percentage: number) => {
    if (percentage >= 90) return "A";
    if (percentage >= 80) return "B";
    if (percentage >= 70) return "C";
    if (percentage >= 60) return "D";
    return "F";
  };

  const emptyPanelClass = embedInDashboard
    ? cn(cardBase, "flex min-h-0 flex-1 flex-col items-center justify-center border-dashed px-4 py-10 text-center")
    : cn(cardBase, "p-8 text-center sm:p-10");
  const loadingPanelClass = embedInDashboard
    ? cn(cardBase, "flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-10")
    : cn(cardBase, "flex items-center justify-center min-h-[280px] p-8");

  return (
    <div className={cn(embedInDashboard ? "flex min-h-0 flex-1 flex-col gap-4" : "space-y-4", "min-w-0 max-w-full")}>
      <FacultyIntegratedToolbar
        moduleId="projects"
        search={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchClear={() => setSearchQuery("")}
        searchPlaceholder="Search name or student ID…"
        filters={
          <>
            <Select value={sessionFilter} onValueChange={setSessionFilter}>
              <SelectTrigger
                className={cn(
                  facultyToolbarFilterButtonClass(sessionFilter !== "all"),
                  "h-9 w-[148px] shadow-none",
                )}
              >
                <SelectValue placeholder="All sessions" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "all" ? "All sessions" : PROJECT_MODULE_SESSIONS.find((x) => x.code === s)?.label ?? s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={sortColumn}
              onValueChange={(v) => setSortColumn(v as ProjectGradeSortColumn)}
            >
              <SelectTrigger
                className={cn(facultyToolbarFilterButtonClass(sortColumn !== "student"), "h-9 w-[120px] shadow-none")}
              >
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="score">Score</SelectItem>
                <SelectItem value="grade">Grade</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(facultyToolbarFilterButtonClass(), "h-9 w-9 p-0")}
              onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
              aria-label={sortDirection === "asc" ? "Sort descending" : "Sort ascending"}
            >
              {sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </>
        }
        meta={
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {filteredGrades.length === grades.length
              ? `${sortedGrades.length} students`
              : `${sortedGrades.length} of ${grades.length} students`}
          </p>
        }
        trailing={
          <Button
            type="button"
            onClick={exportToCSV}
            disabled={sortedGrades.length === 0}
            size="sm"
            className={cn("h-9 rounded-lg", chrome.cta)}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
        }
      />

      {loading ? (
        <div className={loadingPanelClass}>
          <div className="text-center space-y-4">
            <div className={cn("h-8 w-8 animate-spin rounded-full border-2 border-t-transparent mx-auto", facultyModuleSpinnerClass("projects"))} />
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Loading project grades…</p>
          </div>
        </div>
      ) : (
        <div className={cn("min-w-0 max-w-full space-y-3", embedInDashboard && "flex min-h-0 flex-1 flex-col")}>
            {sortedGrades.length === 0 ? (
              <div className={emptyPanelClass}>
                <Users className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
                <p className={cn("font-semibold", PORTAL_TEXT)}>
                  {searchQuery ? `No students match “${searchQuery}”` : "No project grades to show"}
                </p>
                <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>
                  {searchQuery ? "Try adjusting search or session." : "Students appear after they join a group with an approved project."}
                </p>
              </div>
            ) : (
              <div className={cn(cardBase, "divide-y divide-[var(--border)] overflow-hidden", embedInDashboard && "min-h-0 flex-1 overflow-y-auto pr-1 sm:pr-2")}>
                {paginatedGrades.map((student, index) => {
                  const pct = Math.min(100, Math.max(0, (student.effectiveScore / 50) * 100));
                  return (
                    <ProjectGradeListCard
                      key={`${student.studentId}-${student.projectId}`}
                      index={index}
                      name={student.fullName}
                      meta={`${student.projectTitle} · ${student.groupName} · ${student.session}`}
                      score={student.effectiveScore}
                      letter={getLetterGrade(pct)}
                      percent={pct}
                      hasOverride={student.overrideScore != null}
                      onSelect={() => setDetailRow(student)}
                    />
                  );
                })}
              </div>
            )}

            {sortedGrades.length > 0 && (
              <div className={cn(cardBase, "flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between")}>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {startIndex + 1}–{Math.min(endIndex, sortedGrades.length)} of {sortedGrades.length}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNumber: number;
                    if (totalPages <= 5) {
                      pageNumber = i + 1;
                    } else if (currentPage <= 3) {
                      pageNumber = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNumber = totalPages - 4 + i;
                    } else {
                      pageNumber = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        type="button"
                        key={pageNumber}
                        variant={currentPage === pageNumber ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNumber)}
                        className={cn("h-8 w-8 p-0", currentPage === pageNumber && chrome.cta)}
                      >
                        {pageNumber}
                      </Button>
                    );
                  })}
                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <>
                      <span className="text-slate-400" aria-hidden>
                        …
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        className="h-8 w-8 p-0"
                      >
                        {totalPages}
                      </Button>
                    </>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(v) => setItemsPerPage(Number(v))}
                  >
                    <SelectTrigger className="h-8 w-[70px] sm:w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 / page</SelectItem>
                      <SelectItem value="10">10 / page</SelectItem>
                      <SelectItem value="20">20 / page</SelectItem>
                      <SelectItem value="50">50 / page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
        </div>
      )}

      {!loading && sortedGrades.length > 0 && (
        <Alert className={cn("rounded-xl border", fp.softBg, "border-[var(--border)]")}>
          <FileSpreadsheet className={cn("h-4 w-4", fp.iconText)} />
          <AlertDescription className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            Group voting totals apply to each member. Open a student to view the breakdown and set a 0–50 override.
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={detailRow != null} onOpenChange={(open) => !open && setDetailRow(null)}>
        <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-lg">
          {detailRow && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8 text-left">{detailRow.fullName}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Student
                  </p>
                  <p className="mt-1 text-slate-800 dark:text-slate-200">
                    <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{detailRow.studentNumber}</span>
                    <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
                    <Badge variant="outline" className="text-xs align-middle">
                      {detailRow.session}
                    </Badge>
                  </p>
                </div>

                <Separator />

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Group</p>
                  <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">{detailRow.groupName}</p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Group members
                  </p>
                  {detailRow.groupMembers.length === 0 ? (
                    <p className="mt-2 text-slate-500 dark:text-slate-400 text-xs">No members listed.</p>
                  ) : (
                    <ul className="mt-2 max-h-40 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800">
                      {[...detailRow.groupMembers]
                        .sort((a, b) => a.full_name.localeCompare(b.full_name))
                        .map((m) => (
                          <li
                            key={m.id}
                            className="px-3 py-2 text-slate-800 dark:text-slate-200 flex flex-wrap items-baseline justify-between gap-2"
                          >
                            <span>{m.full_name}</span>
                            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{m.student_id}</span>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>

                <Separator />

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Project</p>
                  <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">{detailRow.projectTitle}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Status: {detailRow.projectStatus}</p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Description
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed">
                    {detailRow.projectSummary ?? "No description provided."}
                  </p>
                </div>

                <Separator />

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Scores</p>
                  <dl className="mt-2 space-y-2 text-slate-800 dark:text-slate-200">
                    <div className="flex justify-between gap-4 tabular-nums">
                      <dt className="text-slate-600 dark:text-slate-400">Recorded (0–50)</dt>
                      <dd className="font-semibold">{detailRow.effectiveScore.toFixed(1)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 tabular-nums">
                      <dt className="text-slate-600 dark:text-slate-400">Percent · letter</dt>
                      <dd className="flex items-center gap-2">
                        <Badge
                          className={`${getGradeColor(
                            Math.min(100, Math.max(0, (detailRow.effectiveScore / 50) * 100)),
                          )} text-xs px-2 py-0.5 border-0`}
                        >
                          {Math.min(100, Math.max(0, (detailRow.effectiveScore / 50) * 100)).toFixed(0)}%
                        </Badge>
                        <span className="font-semibold">
                          {getLetterGrade(Math.min(100, Math.max(0, (detailRow.effectiveScore / 50) * 100)))}
                        </span>
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 tabular-nums">
                      <dt className="text-slate-600 dark:text-slate-400">Group voting total</dt>
                      <dd>{detailRow.groupScore.toFixed(1)} / 50</dd>
                    </div>
                    {detailRow.overrideScore != null && (
                      <div className="flex justify-between gap-4 tabular-nums">
                        <dt className="text-slate-600 dark:text-slate-400">Instructor override</dt>
                        <dd className="font-medium text-amber-700 dark:text-amber-300">
                          {detailRow.overrideScore.toFixed(1)} / 50
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                <Separator />

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Adjust score
                  </p>
                  <div className="mt-2">
                    <MemberProjectScoreEditor
                      projectId={detailRow.projectId}
                      studentId={detailRow.studentId}
                      session={detailRow.session}
                      groupScore={detailRow.groupScore}
                      overrideScore={detailRow.overrideScore}
                      onAfterSave={() => void fetchStudentGrades({ silent: true })}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
