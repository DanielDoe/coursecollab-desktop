"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Edit, Search, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { GradeBreakdown } from "@/components/grade-breakdown";
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers";

interface InstructorGradesManageProps {
  instructorId: number;
  session?: string;
  dataRefreshKey?: number;
}

export function InstructorGradesManage({ instructorId, session = "ALL", dataRefreshKey = 0 }: InstructorGradesManageProps) {
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [detailRefreshing, setDetailRefreshing] = useState(false);
  const [breakdownReloadToken, setBreakdownReloadToken] = useState(0);
  const [grades, setGrades] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [editingGrade, setEditingGrade] = useState<any | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchGrades = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        instructorId: String(instructorId),
        session,
        page: String(page),
        limit: "15",
      });
      if (search.trim()) params.set("search", search.trim());
      const response = await studentApiFetch(`/api/grades/list?${params}`, {
        headers: buildInstructorApiHeaders(),
      });
      const data = await response.json();

      if (response.ok) {
        setGrades(data.grades || []);
        setPagination(data.pagination || { total: 0, totalPages: 1 });
      }
    } catch (error) {
      console.error("Error fetching grades:", error);
      toast({ title: "Error", description: "Failed to load grades", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrades();
  }, [instructorId, session, page, search, dataRefreshKey]);

  const resolveBreakdownSession = (row: { grade_session?: string; section?: string } | null) => {
    if (!row) return session || "ALL";
    if (session && session !== "ALL") return session;
    return row.grade_session || row.section || session || "ALL";
  };

  const handleRefreshStudentDetail = async () => {
    if (!selectedGrade) return;
    const sid = selectedGrade.student_id;
    const sess = resolveBreakdownSession(selectedGrade);
    setDetailRefreshing(true);
    try {
      const response = await fetch(
        `/api/grades/student?studentId=${sid}&session=${encodeURIComponent(sess)}&recalculate=true`,
        { headers: buildInstructorApiHeaders() },
      );
      const data = await response.json();
      if (response.ok && data.grade) {
        const g = data.grade as Record<string, unknown>;
        setSelectedGrade((prev: any) =>
          prev
            ? {
                ...prev,
                total_score: g.total_score ?? prev.total_score,
                letter_grade: g.letter_grade ?? prev.letter_grade,
                quiz_score: g.quiz_score ?? prev.quiz_score,
                homework_score: g.homework_score ?? prev.homework_score,
                midterm_score: g.midterm_score ?? prev.midterm_score,
                final_score: g.final_score ?? prev.final_score,
                attendance_score: g.attendance_score ?? prev.attendance_score,
                project_score: g.project_score ?? prev.project_score,
                classroom_score: g.classroom_score ?? prev.classroom_score,
                engagement_credits: g.engagement_credits ?? prev.engagement_credits,
              }
            : null,
        );
        setBreakdownReloadToken((t) => t + 1);
        toast({ title: "Refreshed", description: "Scores recalculated from the latest activity." });
      } else {
        toast({
          title: "Error",
          description: (data as { error?: string }).error || "Could not refresh scores",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Error", description: "Could not refresh scores", variant: "destructive" });
    } finally {
      setDetailRefreshing(false);
    }
  };

  const handleBulkCalculate = async () => {
    setCalculating(true);
    try {
      const response = await studentApiFetch("/api/grades/bulk-calculate", {
        method: "POST",
        headers: {
          ...buildInstructorApiHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ session }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        toast({ title: "Success", description: data.message });
        await fetchGrades();
      } else {
        toast({ title: "Error", description: data.error || "Failed to calculate", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to calculate grades", variant: "destructive" });
    } finally {
      setCalculating(false);
    }
  };

  const handleEdit = (grade: any) => {
    setEditingGrade({
      ...grade,
      quizScore: grade.quiz_score ?? 0,
      homeworkScore: grade.homework_score ?? 0,
      midtermScore: grade.midterm_score ?? 0,
      finalScore: grade.final_score ?? 0,
      attendanceScore: grade.attendance_score ?? 0,
      projectScore: grade.project_score ?? 0,
      classroomScore: grade.classroom_score ?? 0,
      engagementCredits: grade.engagement_credits ?? 0,
    });
  };

  const resolveSessionForSave = (row: typeof editingGrade) => {
    if (!row) return "ALL";
    if (session && session !== "ALL") return session;
    return row.grade_session || row.section || "ALL";
  };

  const handleSave = async () => {
    if (!editingGrade) return;

    setSaving(true);
    try {
      const response = await studentApiFetch("/api/grades/update", {
        method: "POST",
        headers: {
          ...buildInstructorApiHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: editingGrade.student_id,
          session: resolveSessionForSave(editingGrade),
          quizScore: editingGrade.quizScore,
          homeworkScore: editingGrade.homeworkScore,
          midtermScore: editingGrade.midtermScore,
          finalScore: editingGrade.finalScore,
          attendanceScore: editingGrade.attendanceScore,
          projectScore: editingGrade.projectScore,
          classroomScore: editingGrade.classroomScore,
          engagementCredits: editingGrade.engagementCredits,
          notes: editingGrade.notes,
          isLocked: editingGrade.is_locked,
        }),
      });

      if (response.ok) {
        toast({ title: "Success", description: "Grade updated" });
        setEditingGrade(null);
        await fetchGrades();
      } else {
        const data = await response.json();
        toast({ title: "Error", description: data.error || "Failed to update", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update grade", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const formatScore = (v: number | null | undefined) =>
    v != null && !Number.isNaN(Number(v)) ? `${Number(v).toFixed(1)}%` : "—";

  if (!loading && grades.length === 0) {
    return (
      <Card className="border-slate-200/60 dark:border-white/[0.08] bg-white dark:bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Users className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            Manage Student Grades
          </CardTitle>
          <CardDescription className="text-slate-600 dark:text-slate-400">
            No students found in this section.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200/60 dark:border-white/[0.08] bg-white dark:bg-white/[0.03]">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Users className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              Manage Student Grades
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              View and edit student grades across all categories
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search students..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-48"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleBulkCalculate} disabled={calculating}>
              {calculating ? "..." : "Recalculate"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-12 text-center text-slate-500 dark:text-slate-400">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {grades.map((grade) => (
                <div
                  key={grade.student_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedGrade(grade)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedGrade(grade);
                    }
                  }}
                  className="text-left rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-4 transition hover:shadow-sm hover:border-slate-300 dark:hover:border-white/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {grade.full_name}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {grade.section || "—"}
                      </p>
                    </div>
                    <Badge variant="outline" className="font-mono shrink-0">
                      {grade.letter_grade || "—"}
                    </Badge>
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Total Score
                      </p>
                      <p className="text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                        {formatScore(grade.total_score)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleEdit(grade);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4">
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center sm:text-left">
                  {pagination.total} students
                </p>
                <div className="flex justify-center sm:justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={!!editingGrade} onOpenChange={(o) => !o && setEditingGrade(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Edit Grade</DialogTitle>
            <DialogDescription>
              Override category scores for {editingGrade?.full_name}. Total will be recalculated from weights.
            </DialogDescription>
          </DialogHeader>
          {editingGrade && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              {[
                { key: "quizScore", label: "Quiz %" },
                { key: "homeworkScore", label: "Homework %" },
                { key: "midtermScore", label: "Midterm %" },
                { key: "finalScore", label: "Final %" },
                { key: "attendanceScore", label: "Attendance %" },
                { key: "projectScore", label: "Project %" },
                { key: "classroomScore", label: "Classroom %" },
                { key: "engagementCredits", label: "Engagement" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={editingGrade[key] ?? ""}
                    onChange={(e) =>
                      setEditingGrade({ ...editingGrade, [key]: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGrade(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedGrade} onOpenChange={(o) => !o && setSelectedGrade(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-5xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Student Grade Details</DialogTitle>
            <DialogDescription>
              {selectedGrade?.full_name} {selectedGrade?.section ? `· ${selectedGrade.section}` : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedGrade && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-white/10 p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    {selectedGrade.letter_grade || "—"}
                  </Badge>
                  <span className="text-sm text-slate-600 dark:text-slate-400">Current total</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatScore(selectedGrade.total_score)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleRefreshStudentDetail}
                    disabled={detailRefreshing}
                    title="Recalculate this student from submissions and reload the breakdown"
                  >
                    <RefreshCw className={cn("h-4 w-4 mr-1", detailRefreshing && "animate-spin")} />
                    Refresh
                  </Button>
                  <Button size="sm" onClick={() => handleEdit(selectedGrade)}>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit Scores
                  </Button>
                </div>
              </div>

              <GradeBreakdown
                studentId={Number(selectedGrade.student_id)}
                session={String(resolveBreakdownSession(selectedGrade))}
                reloadToken={breakdownReloadToken}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
