"use client";

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Award,
  ClipboardList,
  Plus,
  Users,
  TrendingUp,
  Search,
  Download,
  Star,
  Trophy,
  Gift,
  History,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCheck,
  Loader2,
  AlertTriangle,
  Target,
  Copy,
  XCircle,
  Code,
  ChevronDown,
  ChevronUp,
  X,
  Pencil,
  Trash2,
  FileCode,
  Image as ImageIcon,
  Archive,
  PenLine,
} from "lucide-react";
import dynamic from "next/dynamic";

const LightCodeViewer = dynamic(
  () => import("@/components/light-code-viewer").then((m) => m.LightCodeViewer),
  { ssr: false },
);
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  classroomRawPointsToGradePoints10,
} from "@/lib/classroom-points-grade-scale";
import {
  formatClassroomPointsBoosterBadgeText,
  resolveClassroomDisplayPoints,
} from "@/lib/classroom-point-booster";
import { ClassroomPointBoosterBadge } from "@/components/classroom-point-booster-badge";
import { cn } from "@/lib/utils";
import { ClassroomPointsOverviewCharts } from "@/components/instructor-classroom-points-overview";
import { DashboardKpiCard } from "@/components/dashboard-v2/DashboardKpiCard";
import {
  PortalLeaderboardPodium,
  buildPortalPodiumEntries,
} from "@/components/dashboard-v2/PortalLeaderboardPodium";
import { buildInstructorApiHeaders, buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers";

async function parseInstructorJsonResponse<T>(response: Response): Promise<{
  ok: boolean
  data: T | null
  errorText: string | null
}> {
  const text = await response.text()
  if (!response.ok) {
    return { ok: false, data: null, errorText: text || response.statusText }
  }
  if (!text.trim()) return { ok: true, data: null, errorText: null }
  try {
    return { ok: true, data: JSON.parse(text) as T, errorText: null }
  } catch {
    return { ok: false, data: null, errorText: text }
  }
}
import {
  CLASSROOM_SUBMISSION_KIND_CODE,
  CLASSROOM_SUBMISSION_KIND_SOLUTION,
  isClassroomSolutionAssignment,
  parseClassroomSolutionQuestionConfig,
} from "@/lib/classroom-solution-submission";
import {
  ClassroomAssignmentFormFields,
  ClassroomAssignmentAvailabilityFields,
  classroomAssignmentFormToApiPayload,
  emptyClassroomAssignmentForm,
  type ClassroomAssignmentFormValues,
} from "@/components/classroom-assignment-editor";
import { ClassroomAssignmentEditDialog } from "@/components/classroom-assignment-edit-dialog";
import { ClassroomSolutionApprovalPreview } from "@/components/classroom-solution-approval-preview";
import { formatAssignmentDueLabel } from "@/lib/classroom-submission-availability";
import {
  buildClassroomPointsPortfolioPdfBuffer,
  sanitizeStudentPortfolioPdfFilename,
  type ClassroomPointExportRow,
} from "@/lib/classroom-points-export-pdf";
import { classroomPointsZipBasename } from "@/lib/classroom-points-export-naming";
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context";
import { useInstructorCoursePolicies } from "@/components/instructor/useInstructorCoursePolicies";
import { InstructorClassroomPointsRulesHub } from "@/components/instructor/InstructorClassroomPointsRulesHub";
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome";
import { portalListStripe } from "@/lib/portal-module-themes";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar";
import {
  CP_ACTION,
  CP_LABEL,
  CP_PANEL,
  CP_ROW,
  CP_ROW_INNER,
  CP_STATUS_PILL,
  CP_TILE,
  PORTAL_CTA,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/classroom-points/classroom-points-surface-classes";

interface Student {
  student_id: number;
  student_number: string;
  full_name: string;
  session: string;
  total_points: number;
  award_count: number;
  last_awarded: string | null;
}

interface ClassroomPoint {
  id: number;
  student_id: number;
  points: number;
  reason: string;
  category: string;
  status?: string;
  session?: string;
  awarded_at: string;
  created_at?: string;
  submission_id?: number | null;
  student_name: string;
  student_number: string;
  authenticity_score?: number | null;
  ai_likelihood?: number | null;
  authorship_reasoning?: string | null;
  flagged_features?: string[] | null;
  ai_suspicion?: boolean | null;
  isDuplicate?: boolean;
  duplicateOf?: number | null;
  highestInGroup?: boolean;
  highestScoreInGroup?: number;
  code?: string | null;
  plot_image?: string | null;
  solution_answer_json?: unknown;
  assignment_question_config?: unknown;
  submission_title?: string | null;
  point_booster?: number | null;
}

const CATEGORIES = [
  { value: "code_submission", label: "Code assignment", icon: "💻" },
  { value: "presentation", label: "Presentation", icon: "🎤" },
  { value: "participation", label: "Class Participation", icon: "🙋" },
  { value: "quiz_bonus", label: "Quiz Bonus", icon: "📝" },
  { value: "extra_credit", label: "Extra Credit", icon: "⭐" },
  { value: "other", label: "Other", icon: "🎁" }
];

function defaultApprovalPoints(point: ClassroomPoint): number {
  return resolveClassroomDisplayPoints(point.points, point.point_booster)
}

export type ClassroomPointsNavSection =
  | "overview"
  | "code-submissions"
  | "pending-approvals"
  | "recent-awards"
  | "students"
  | "configuration"

export function InstructorClassroomPoints({
  onRefreshRef,
  /** When set (dashboard), only that panel is shown. When omitted (legacy page), all panels stack on one page. */
  activeSection,
}: {
  onRefreshRef?: React.MutableRefObject<(() => void) | null>
  activeSection?: ClassroomPointsNavSection
}) {
  const sectionVisible = (s: ClassroomPointsNavSection) =>
    activeSection === undefined || activeSection === s
  const isTabbedLayout = activeSection !== undefined
  const { courseScopeVersion } = useInstructorDashboardV2()
  const { policies: coursePolicies } = useInstructorCoursePolicies()
  const classroomPointsForFullGrade = coursePolicies.rewards_policy.points_for_full_grade
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [recentAwards, setRecentAwards] = useState<ClassroomPoint[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ClassroomPoint[]>([]);
  const [pendingPracticePoints, setPendingPracticePoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<number | null>(null);
  const [sessionFilter, setSessionFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAwardDialog, setShowAwardDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [instructorId, setInstructorId] = useState<number | null>(null);
  const [expandedCode, setExpandedCode] = useState<Set<number>>(new Set());
  const [expandedSolution, setExpandedSolution] = useState<Set<number>>(new Set());
  const [approvalPoints, setApprovalPoints] = useState<Record<number, string>>({});

  // Award form state
  const [awardPoints, setAwardPoints] = useState("");
  const [awardReason, setAwardReason] = useState("");
  const [awardCategory, setAwardCategory] = useState("other");
  const [submitting, setSubmitting] = useState(false);

  const [editingAward, setEditingAward] = useState<ClassroomPoint | null>(null);
  const [editAwardPoints, setEditAwardPoints] = useState("");
  const [editAwardReason, setEditAwardReason] = useState("");
  const [editAwardCategory, setEditAwardCategory] = useState("other");
  const [savingAwardEdit, setSavingAwardEdit] = useState(false);

  // Submission creation state
  const [showCreateSubmission, setShowCreateSubmission] = useState(false);
  const [createFormValues, setCreateFormValues] = useState<ClassroomAssignmentFormValues>(
    emptyClassroomAssignmentForm(),
  );
  const [creatingSubmission, setCreatingSubmission] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [assignmentEditOpen, setAssignmentEditOpen] = useState(false);
  const [assignmentEditTarget, setAssignmentEditTarget] = useState<any | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [submissionToDelete, setSubmissionToDelete] = useState<{ id: number; title: string } | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [awardsPage, setAwardsPage] = useState(1);
  const [awardsPerPage, setAwardsPerPage] = useState(10);
  const [sessions, setSessions] = useState<string[]>(["all"]);
  const [submissionsPage, setSubmissionsPage] = useState(1);
  const [submissionsPerPage] = useState(5);
  const [exportZipBusy, setExportZipBusy] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/sessions", {
        headers: buildInstructorAuthorizedApiHeaders(),
      })
      if (!response.ok) throw new Error("Failed to fetch sessions")
      const data = await response.json()
      const sessionCodes = [
        ...new Set(
          (data.sessions?.map((s: { code?: string }) => s.code).filter(Boolean) as string[]) ?? [],
        ),
      ]
      setSessions(["all", ...sessionCodes])
    } catch (error) {
      console.error("[Classroom Points] Failed to fetch sessions:", error)
      setSessions(["all"])
    }
  }, [courseScopeVersion])

  const fetchSubmissions = useCallback(async () => {
    try {
      const params = new URLSearchParams({ manage: "1" });
      if (sessionFilter !== "all") params.set("session", sessionFilter);
      const response = await studentApiFetch(`/api/classroom-points/submissions?${params}`, {
        headers: buildInstructorAuthorizedApiHeaders(),
      });
      if (!response.ok) {
        const errBody = await response.text().catch(() => "")
        console.error("[Classroom Points] Failed to fetch submissions:", response.status, errBody)
        return
      }
      const data = await response.json()
      setSubmissions(data.submissions || []);
    } catch (error) {
      console.error("[Classroom Points] Error fetching submissions:", error);
    }
  }, [sessionFilter, courseScopeVersion]);

  useEffect(() => {
    setSessionFilter("all");
  }, [courseScopeVersion]);

  useEffect(() => {
    const totalPages =
      submissions.length === 0
        ? 1
        : Math.ceil(submissions.length / submissionsPerPage);
    if (submissionsPage > totalPages) {
      setSubmissionsPage(1);
    }
  }, [submissions, submissionsPerPage, submissionsPage]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const scopedHeaders = buildInstructorAuthorizedApiHeaders()
      if (!scopedHeaders["x-course-id"]) {
        setStudents([])
        setRecentAwards([])
        setPendingApprovals([])
        setPendingPracticePoints([])
        return
      }

      console.log("[Classroom Points] Fetching data for session:", sessionFilter);

      const summaryParams = new URLSearchParams()
      if (sessionFilter !== "all") summaryParams.set("session", sessionFilter)
      const summaryQs = summaryParams.toString()
      const summaryUrl = `/api/classroom-points/summary${summaryQs ? `?${summaryQs}` : ""}`

      console.log("[Classroom Points] Fetching from:", summaryUrl);
      const summaryResponse = await fetch(summaryUrl, { headers: scopedHeaders });
      const summaryParsed = await parseInstructorJsonResponse<{ summary?: Student[] }>(summaryResponse)
      if (!summaryParsed.ok) {
        console.error("[Classroom Points] Failed to fetch summary:", summaryParsed.errorText)
        return
      }
      const summaryData = summaryParsed.data ?? {}

      console.log("[Classroom Points] Students fetched:", summaryData.summary?.length || 0);
      console.log("[Classroom Points] Sample data:", summaryData.summary?.[0]);

      setStudents(summaryData.summary || []);

      // Fetch recent awards (only approved points, not pending)
      const awardsUrl = sessionFilter === "all"
        ? "/api/classroom-points?status=approved&limit=500"
        : `/api/classroom-points?session=${sessionFilter}&status=approved&limit=500`;

      const awardsResponse = await fetch(awardsUrl, { headers: scopedHeaders });
      const awardsParsed = await parseInstructorJsonResponse<{ points?: ClassroomPoint[] }>(awardsResponse)
      const awardsData = awardsParsed.ok ? awardsParsed.data ?? {} : {}
      setRecentAwards(awardsData.points || []);

      // Fetch pending approvals (only code_submission points)
      const pendingUrl = sessionFilter === "all"
        ? "/api/classroom-points?status=pending&limit=50"
        : `/api/classroom-points?status=pending&session=${sessionFilter}&limit=50`;

      console.log("[Classroom Points] 🔍 Fetching pending approvals from:", pendingUrl);
      const pendingResponse = await fetch(pendingUrl, { headers: scopedHeaders });
      const pendingParsed = await parseInstructorJsonResponse<{ points?: ClassroomPoint[] }>(pendingResponse)

      if (!pendingParsed.ok) {
        console.error(
          "[Classroom Points] ❌ Failed to fetch pending approvals:",
          pendingResponse.status,
          pendingResponse.statusText,
        )
        console.error("[Classroom Points] Error response:", pendingParsed.errorText)
      }

      const pendingData = pendingParsed.data ?? {}
      
      console.log("[Classroom Points] 📨 Pending data received:", {
        hasPoints: !!pendingData.points,
        pointsLength: pendingData.points?.length || 0,
        pointsArray: pendingData.points,
        fullResponse: pendingData
      });
      
      // Pending code + circuit/solution submissions (API returns both categories)
      const pendingSubmissions = (pendingData.points || []).filter((p: ClassroomPoint) =>
        p.category === "code_submission" || p.category === "solution_submission",
      );

      console.log("[Classroom Points] ✅ Pending submissions:", {
        count: pendingSubmissions.length,
        solutionCount: pendingSubmissions.filter((p: ClassroomPoint) => p.category === "solution_submission").length,
        sample: pendingSubmissions[0]
          ? {
              id: pendingSubmissions[0].id,
              student_name: pendingSubmissions[0].student_name,
              points: pendingSubmissions[0].points,
              category: pendingSubmissions[0].category,
              status: pendingSubmissions[0].status,
              reason: pendingSubmissions[0].reason?.substring(0, 100),
            }
          : null,
      });

      setPendingApprovals(pendingSubmissions);

      // Fetch pending practice points (includes daily challenges and practice problems)
      const practicePointsUrl = "/api/practice-points?status=pending&limit=50";
      console.log("[Classroom Points] 🔍 Fetching pending practice points from:", practicePointsUrl);
      const practicePointsResponse = await fetch(practicePointsUrl, { headers: scopedHeaders });
      const practiceParsed = await parseInstructorJsonResponse<{ points?: unknown[] }>(practicePointsResponse)

      if (!practiceParsed.ok) {
        console.error(
          "[Classroom Points] ❌ Failed to fetch pending practice points:",
          practicePointsResponse.status,
          practicePointsResponse.statusText,
        )
        console.error("[Classroom Points] Error response:", practiceParsed.errorText)
      }

      const practicePointsData = practiceParsed.data ?? {}
      
      console.log("[Classroom Points] 📨 Practice points data received:", {
        hasPoints: !!practicePointsData.points,
        pointsLength: practicePointsData.points?.length || 0,
        pointsArray: practicePointsData.points,
        fullResponse: practicePointsData
      });
      
      // Filter by session if needed
      let filteredPracticePoints = practicePointsData.points || [];
      if (sessionFilter !== "all") {
        // We need to get session from student data - will filter after fetching
        const studentIds = students.map(s => s.student_id);
        filteredPracticePoints = filteredPracticePoints.filter((pp: any) => 
          studentIds.includes(pp.student_id)
        );
      }
      
      console.log("[Classroom Points] ✅ Filtered practice points:", {
        count: filteredPracticePoints.length,
        sample: filteredPracticePoints[0] ? {
          id: filteredPracticePoints[0].id,
          student_name: filteredPracticePoints[0].student_name,
          points: filteredPracticePoints[0].points,
          reason: filteredPracticePoints[0].reason?.substring(0, 100),
          status: filteredPracticePoints[0].status
        } : null
      });
      
      setPendingPracticePoints(filteredPracticePoints);

      console.log("[Classroom Points] 📊 SUMMARY:", {
        recentAwards: awardsData.points?.length || 0,
        pendingApprovals: pendingSubmissions.length,
        pendingPracticePoints: filteredPracticePoints.length,
        totalPending: pendingSubmissions.length + filteredPracticePoints.length
      });
      
      // Final check - log what we're setting
      console.log("[Classroom Points] ✅ Setting state:", {
        pendingApprovalsCount: pendingSubmissions.length,
        pendingPracticePointsCount: filteredPracticePoints.length,
        pendingApprovalsSample: pendingSubmissions[0]
          ? {
              id: pendingSubmissions[0].id,
              student_name: pendingSubmissions[0].student_name,
              points: pendingSubmissions[0].points,
            }
          : null,
        practicePointsSample: filteredPracticePoints[0] ? {
          id: filteredPracticePoints[0].id,
          student_name: filteredPracticePoints[0].student_name,
          points: filteredPracticePoints[0].points
        } : null
      });

    } catch (error) {
      console.error("[Classroom Points] Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch classroom points data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [sessionFilter, toast, courseScopeVersion]);

  // Expose refresh function to parent component
  useEffect(() => {
    if (onRefreshRef) {
      onRefreshRef.current = async () => {
        await fetchData();
        await fetchSubmissions();
        toast({
          title: "Refreshed",
          description: "Classroom points data has been updated",
        });
      };
    }
  }, [onRefreshRef, fetchData, fetchSubmissions, toast]);

  useEffect(() => {
    const instructorSession = localStorage.getItem("instructorSession");
    if (instructorSession) {
      try {
        const data = JSON.parse(instructorSession);
        setInstructorId(data.id);
      } catch (error) {
        console.error("Error parsing instructor session:", error);
      }
    }
    fetchData();
    fetchSubmissions();
    void fetchSessions();
  }, [fetchData, fetchSubmissions, fetchSessions, courseScopeVersion]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
    setAwardsPage(1);
    fetchSubmissions();
  }, [sessionFilter, searchQuery, fetchSubmissions]);

  const canEditClassroomAward = (p: ClassroomPoint) =>
    p.category !== "code_submission" && (p.submission_id == null || p.submission_id === undefined);

  const openEditAward = (award: ClassroomPoint) => {
    setEditingAward(award);
    setEditAwardPoints(String(award.points ?? ""));
    setEditAwardReason(award.reason || "");
    setEditAwardCategory(award.category || "other");
  };

  const saveAwardEdit = async () => {
    if (!editingAward || instructorId == null) return;
    const pts = parseFloat(editAwardPoints);
    if (!Number.isFinite(pts) || pts <= 0) {
      toast({
        title: "Invalid points",
        description: "Enter a positive number.",
        variant: "destructive",
      });
      return;
    }
    if (!editAwardReason.trim()) {
      toast({
        title: "Reason required",
        description: "Please enter a reason.",
        variant: "destructive",
      });
      return;
    }
    setSavingAwardEdit(true);
    try {
      const res = await studentApiFetch(`/api/classroom-points/${editingAward.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-instructor-id": String(instructorId),
        },
        body: JSON.stringify({
          points: pts,
          reason: editAwardReason.trim(),
          category: editAwardCategory,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Update failed");
      }
      toast({ title: "Updated", description: "Classroom point entry saved." });
      setEditingAward(null);
      await fetchData();
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to update",
        variant: "destructive",
      });
    } finally {
      setSavingAwardEdit(false);
    }
  };

  const handleAwardPoints = async () => {
    if (!selectedStudent || !instructorId) return;

    const points = parseFloat(awardPoints);
    if (isNaN(points) || points <= 0) {
      toast({
        title: "Invalid Points",
        description: "Please enter a valid positive number",
        variant: "destructive",
      });
      return;
    }

    if (!awardReason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for awarding points",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      const response = await studentApiFetch("/api/classroom-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudent.student_id,
          points,
          reason: awardReason,
          category: awardCategory,
          awardedBy: instructorId,
          session: selectedStudent.session
        })
      });

      if (!response.ok) throw new Error("Failed to award points");

      toast({
        title: "Points Awarded!",
        description: `${points} points awarded to ${selectedStudent.full_name}`,
      });

      // Reset form
      setAwardPoints("");
      setAwardReason("");
      setAwardCategory("other");
      setShowAwardDialog(false);
      setSelectedStudent(null);

      // Refresh data
      fetchData();

    } catch (error) {
      console.error("Error awarding points:", error);
      toast({
        title: "Error",
        description: "Failed to award points",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveAll = async () => {
    try {
      setApproving(-1);
      const response = await studentApiFetch("/api/classroom-points/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approveAll: true }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to approve");
      }

      const data = await response.json();
      const description = data.duplicatesRejected > 0
        ? `${data.count} points approved (${data.duplicatesRejected} duplicate code submissions rejected)`
        : `${data.count} points approved`;
      toast({
        title: "Success",
        description: description,
      });

      // Refresh data to show updated points
      await fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve points",
        variant: "destructive",
      });
    } finally {
      setApproving(null);
    }
  };

  const handleVerifyAndApproveAll = async () => {
    try {
      setApproving(-3);
      const response = await studentApiFetch("/api/classroom-points/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verifyAndApproveAll: true }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to verify and approve");
      }

      const data = await response.json();
      const description = data.duplicatesRejected > 0
        ? `${data.count} points verified and approved with AI (${data.duplicatesRejected} duplicates rejected)`
        : `${data.count} points verified and approved with AI`;
      toast({
        title: "Success",
        description: description,
      });

      // Refresh data to show updated points
      await fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to verify and approve points",
        variant: "destructive",
      });
    } finally {
      setApproving(null);
    }
  };

  const handleApproveAllPractice = async () => {
    try {
      setApproving(-2);
      const response = await instructorApiFetch("/api/practice-points/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approveAll: true }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to approve practice points");
      }
      const data = await response.json();
      toast({
        title: "Success",
        description: `${data.count ?? 0} practice points approved`,
      });
      await fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve practice points",
        variant: "destructive",
      });
    } finally {
      setApproving(null);
    }
  };

  const handleApprove = async (id: number, customPoints?: number) => {
    try {
      setApproving(id);
      // Default to 2.5 points if no custom points specified
      const pointsToAward = customPoints || (approvalPoints[id] ? parseFloat(approvalPoints[id]) : 2.5);
      
      const response = await studentApiFetch("/api/classroom-points/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          id,
          points: pointsToAward 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to approve");
      }

      const data = await response.json();
      
      toast({
        title: "Success",
        description: data.message || `Point approved with ${pointsToAward} points`,
        variant: data.duplicateWarning ? "default" : "default",
      });
      
      if (data.duplicateWarning) {
        // Show additional warning if duplicate detected
        setTimeout(() => {
          toast({
            title: "Duplicate Warning",
            description: data.duplicateWarning,
            variant: "destructive",
          });
        }, 500);
      }

      // Clear approval points for this ID
      setApprovalPoints(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve point",
        variant: "destructive",
      });
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (id: number) => {
    try {
      setApproving(id);
      const response = await studentApiFetch(`/api/classroom-points/approve?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to reject");

      toast({
        title: "Success",
        description: "Point rejected",
      });

      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject point",
        variant: "destructive",
      });
    } finally {
      setApproving(null);
    }
  };

  const handleCreateSubmission = async () => {
    console.log("[Instructor Classroom Points] Starting submission creation...");

    if (!createFormValues.title.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter an assignment title",
        variant: "destructive",
      });
      return;
    }

    if (
      createFormValues.submissionKind === CLASSROOM_SUBMISSION_KIND_SOLUTION &&
      !createFormValues.questionConfig?.question_text?.trim()
    ) {
      toast({
        title: "Problem statement required",
        description: "Solution assignments need a problem statement for students.",
        variant: "destructive",
      });
      return;
    }

    if (!createFormValues.neverExpires && !createFormValues.dueAtLocal.trim()) {
      toast({
        title: "Due date required",
        description: "Set a due date or choose “No due date (never expires)”.",
        variant: "destructive",
      });
      return;
    }

    if (!instructorId) {
      toast({
        title: "Error",
        description: "Instructor ID not found",
        variant: "destructive",
      });
      return;
    }

    const requestBody = {
      ...classroomAssignmentFormToApiPayload(createFormValues),
      instructorId,
    };

    try {
      setCreatingSubmission(true);

      const response = await studentApiFetch("/api/classroom-points/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildInstructorAuthorizedApiHeaders(),
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorData: any = {};
        try {
          const responseText = await response.text();
          if (responseText) errorData = JSON.parse(responseText);
        } catch {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorData.error || errorData.details || "Failed to create submission");
      }

      toast({
        title: "Success",
        description: "Assignment created successfully. Students can submit from Classroom Points.",
      });

      setCreateFormValues(emptyClassroomAssignmentForm());
      setShowCreateSubmission(false);
      setSubmissionsPage(1);
      await fetchSubmissions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to create submission.",
        variant: "destructive",
      });
    } finally {
      setCreatingSubmission(false);
    }
  };

  const handleEditSubmission = (submission: any) => {
    setAssignmentEditTarget(submission);
    setAssignmentEditOpen(true);
  };

  const handleDeleteSubmission = async (submissionId: number) => {
    // Find the submission to get its title
    const submission = submissions.find(s => s.id === submissionId);
    if (submission) {
      setSubmissionToDelete({ id: submissionId, title: submission.title });
      setShowDeleteModal(true);
    }
  };

  const confirmDeleteSubmission = async () => {
    if (!submissionToDelete) return;

    try {
      console.log("[Instructor Classroom Points] Deleting submission:", submissionToDelete.id);
      const response = await studentApiFetch(`/api/classroom-points/submissions/${submissionToDelete.id}`, {
        method: "DELETE",
        headers: buildInstructorAuthorizedApiHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || errorData.details || "Failed to delete submission");
      }

      const data = await response.json();
      toast({
        title: "Success",
        description: data.message || `Submission deleted. ${data.revokedPoints || 0} points revoked.`,
      });

      setSubmissionsPage(1); // Reset to first page after deleting
      await fetchSubmissions();
      fetchData(); // Refresh points data
      
      // Close modal after successful deletion
      setShowDeleteModal(false);
      setSubmissionToDelete(null);
    } catch (error: any) {
      console.error("[Instructor Classroom Points] Error deleting submission:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to delete submission",
        variant: "destructive",
      });
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = searchQuery === "" || 
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.student_number.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const podiumStudents = useMemo(
    () => filteredStudents.filter((s) => Number(s.total_points || 0) > 0),
    [filteredStudents],
  );

  const podiumEntries = useMemo(
    () =>
      buildPortalPodiumEntries(podiumStudents, (student, rank) => ({
        rank,
        primaryLabel: student.full_name,
        secondaryLabel: student.student_number,
        score: classroomRawPointsToGradePoints10(
          Number(student.total_points || 0),
          classroomPointsForFullGrade,
        ),
        scoreUnit: "/ 10",
        scoreDetail: `${Number(student.total_points || 0).toFixed(1)} raw · ${student.award_count} awards`,
      })),
    [podiumStudents, classroomPointsForFullGrade],
  );

  const fetchExportRows = useCallback(async (): Promise<ClassroomPointExportRow[]> => {
    const params = new URLSearchParams();
    if (sessionFilter !== "all") params.set("session", sessionFilter);
    const res = await instructorApiFetch(`/api/instructor/classroom-points/export-data?${params}`, {
      headers: buildInstructorAuthorizedApiHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Could not load export data (${res.status})`);
    }
    const data = await res.json();
    return data.points || [];
  }, [sessionFilter]);

  const exportBasename = classroomPointsZipBasename(sessionFilter === "all" ? "all" : sessionFilter);

  const exportSummaryCsv = () => {
    const headers = ["#", "Student Name", "Raw points", "Grade (10 pts max)", "Awards Count"];
    const rows = filteredStudents.map((s, i) => [
      String(i + 1),
      s.full_name,
      Number(s.total_points || 0).toFixed(2),
      classroomRawPointsToGradePoints10(Number(s.total_points || 0), classroomPointsForFullGrade).toFixed(2),
      String(s.award_count),
    ]);
    
    const csv = "\ufeff" + [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportBasename}-summary.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast({
      title: "Export complete",
      description: "Summary CSV matches the student table (filtered list).",
    });
  };

  const exportDetailedCsv = async () => {
    if (filteredStudents.length === 0) return;
    try {
      const allRows = await fetchExportRows();
      const allowed = new Set(filteredStudents.map((s) => s.student_id));
      const rows = allRows.filter((r) => allowed.has(r.student_id));
      if (rows.length === 0) {
        toast({
          title: "Nothing to export",
          description: "No approved awards for students in this filtered list.",
          variant: "destructive",
        });
        return;
      }
      const headers = [
        "Student Name",
        "Student ID",
        "Section",
        "Submission Title",
        "Category",
        "Points",
        "Award Date",
        "Award ID",
        "Reason",
        "Has Code",
        "Has Plot",
      ];
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = [
        headers.join(","),
        ...rows.map((r) =>
          [
            esc(r.student_name),
            esc(r.student_number),
            esc(r.student_section ?? ""),
            esc(r.submission_title ?? ""),
            esc(r.category),
            esc(Number(r.points ?? 0).toFixed(2)),
            esc(r.awarded_at || r.created_at || ""),
            esc(r.id),
            esc(r.reason ?? ""),
            esc(r.code?.trim() ? "yes" : "no"),
            esc(r.plot_image?.trim() ? "yes" : "no"),
          ].join(","),
        ),
      ];
      const csv = "\ufeff" + lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportBasename}-awards-detail.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast({
        title: "Export complete",
        description: `${rows.length} award row(s) — full code is in each student’s PDF (ZIP export).`,
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Export failed",
        description: e instanceof Error ? e.message : "Could not build CSV.",
        variant: "destructive",
      });
    }
  };

  const exportPortfolioZip = async () => {
    if (filteredStudents.length === 0 || exportZipBusy) return;
    setExportZipBusy(true);
    try {
      const allRows = await fetchExportRows();
      const allowed = new Set(filteredStudents.map((s) => s.student_id));
      const rows = allRows.filter((r) => allowed.has(r.student_id));
      if (rows.length === 0) {
        toast({
          title: "Nothing to export",
          description: "No approved awards for students in this filtered list.",
          variant: "destructive",
        });
        return;
      }

      const byStudent = new Map<number, ClassroomPointExportRow[]>();
      for (const r of rows) {
        const list = byStudent.get(r.student_id);
        if (list) list.push(r);
        else byStudent.set(r.student_id, [r]);
      }

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const pdfs = zip.folder("pdfs");
      if (!pdfs) throw new Error("Could not create zip folder");

      const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
      const manifestLines = [
        ["Student Name", "Student ID", "Section", "PDF File", "Award Count", "Raw Points Total"].join(","),
      ];

      const sortedEntries = [...byStudent.entries()].sort((a, b) =>
        (a[1][0]?.student_name || "").localeCompare(b[1][0]?.student_name || "", undefined, {
          sensitivity: "base",
        }),
      );

      for (const [, list] of sortedEntries) {
        const buf = buildClassroomPointsPortfolioPdfBuffer(list);
        const fname = sanitizeStudentPortfolioPdfFilename(list[0].student_name, list[0].student_number);
        pdfs.file(fname, buf);
        const rawTotal = list.reduce((sum, x) => sum + Number(x.points || 0), 0);
        manifestLines.push(
          [
            esc(list[0].student_name),
            esc(String(list[0].student_number)),
            esc(list[0].student_section || ""),
            esc(`pdfs/${fname}`),
            String(list.length),
            rawTotal.toFixed(2),
          ].join(","),
        );
      }

      zip.file("manifest.csv", manifestLines.join("\n"));
      const blob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportBasename}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "ZIP downloaded",
        description: `${sortedEntries.length} student PDF(s) in pdfs/ + manifest.csv (${exportBasename}.zip).`,
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "ZIP export failed",
        description: e instanceof Error ? e.message : "Could not build archive.",
        variant: "destructive",
      });
    } finally {
      setExportZipBusy(false);
    }
  };

  // Calculate pagination
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

  const totalPoints = students.reduce((sum, s) => sum + Number(s.total_points || 0), 0);
  const avgPoints = students.length > 0 ? totalPoints / students.length : 0;
  const engagedStudents = students.filter((s) => Number(s.award_count || 0) > 0).length;
  const engagementPct = students.length > 0 ? Math.round((engagedStudents / students.length) * 100) : 0;

  const activeSubmissionsCount = submissions.filter((s) => s.is_active).length;
  const totalSubmissionsPages = Math.max(
    1,
    Math.ceil(submissions.length / submissionsPerPage),
  );
  const submissionsStartIndex = (submissionsPage - 1) * submissionsPerPage;
  const submissionsEndIndex = submissionsStartIndex + submissionsPerPage;
  const paginatedSubmissions = submissions.slice(submissionsStartIndex, submissionsEndIndex);

  // Pagination handlers for submissions
  const handleSubmissionsPrevPage = () => {
    setSubmissionsPage(Math.max(1, submissionsPage - 1));
  };

  const handleSubmissionsNextPage = () => {
    setSubmissionsPage(Math.min(totalSubmissionsPages, submissionsPage + 1));
  };

  const handleSubmissionsPageClick = (pageNum: number) => {
    setSubmissionsPage(pageNum);
  };

  const totalAwardsPages = Math.max(1, Math.ceil(recentAwards.length / awardsPerPage));
  const awardsStartIndex = (awardsPage - 1) * awardsPerPage;
  const awardsEndIndex = awardsStartIndex + awardsPerPage;
  const paginatedAwards = recentAwards.slice(awardsStartIndex, awardsEndIndex);

  useEffect(() => {
    if (awardsPage > totalAwardsPages) setAwardsPage(totalAwardsPages);
  }, [awardsPage, totalAwardsPages]);

  const chrome = facultyEmbedChrome("classroom-points");
  const fp = chrome.p;

  const sessionFilterControl = (
    <Select value={sessionFilter} onValueChange={setSessionFilter}>
      <SelectTrigger
        className={cn(
          facultyToolbarFilterButtonClass(sessionFilter !== "all"),
          "h-9 w-[148px] shadow-none",
        )}
      >
        <SelectValue placeholder="Session" />
      </SelectTrigger>
      <SelectContent>
        {sessions.map((s) => (
          <SelectItem key={s} value={s}>
            {s === "all" ? "All sessions" : s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const expiredSubmissionsCount = submissions.length - activeSubmissionsCount;

  const assignmentStatsControl = (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-xs font-semibold tabular-nums">
      <span className={cn("rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5", PORTAL_TEXT)}>
        {submissions.length} total
      </span>
      <span className="rounded-lg bg-[var(--cc-sem-success)]/10 px-2 py-1.5 text-[var(--cc-sem-success)]">
        {activeSubmissionsCount} active
      </span>
      <span className="rounded-lg bg-muted px-2 py-1.5 text-[var(--cc-text-muted)]">
        {expiredSubmissionsCount} expired
      </span>
    </div>
  );

  return (
    <div className="space-y-3" id="classroom-points-root">
      {sectionVisible("code-submissions") && (
      <>
      {isTabbedLayout && (
        <FacultyIntegratedToolbar
          moduleId="classroom-points"
          filters={
            <>
              {sessionFilterControl}
              {assignmentStatsControl}
            </>
          }
          trailing={
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCreateSubmission(!showCreateSubmission)}
              className={cn(
                "h-9 gap-2 rounded-lg",
                showCreateSubmission ? chrome.quiet : chrome.solid,
              )}
            >
              {showCreateSubmission ? (
                <X className="h-3.5 w-3.5" />
              ) : (
                <Plus className="h-3.5 w-3.5 !text-white" />
              )}
              <span className={cn("hidden sm:inline", !showCreateSubmission && "!text-white")}>
                {showCreateSubmission ? "Cancel" : "Create"}
              </span>
            </Button>
          }
        />
      )}
      {showCreateSubmission && (
        <div className={cn(CP_TILE, "space-y-4 p-4 sm:p-5")}>
          <ClassroomAssignmentFormFields values={createFormValues} onChange={setCreateFormValues} />
          <ClassroomAssignmentAvailabilityFields
            values={createFormValues}
            onChange={setCreateFormValues}
            sessions={sessions}
          />
          <Button
            onClick={handleCreateSubmission}
            disabled={creatingSubmission || !createFormValues.title.trim()}
            className={cn("gap-2", chrome.solid)}
          >
            {creatingSubmission ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Create assignment
              </>
            )}
          </Button>
        </div>
      )}
      {submissions.length === 0 && !showCreateSubmission ? (
        <div className={cn(chrome.card, "px-4 py-10 text-center")}>
          <div className={cn("mx-auto mb-3", chrome.iconBadge())}>
            <ClipboardList className="h-5 w-5 !text-white" />
          </div>
          <p className={cn("font-medium", PORTAL_TEXT)}>No assignments yet</p>
          <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>
            Create a code or solution assignment to start awarding classroom points.
          </p>
          <Button type="button" className={cn("mt-4", chrome.solid)} onClick={() => setShowCreateSubmission(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Create assignment
          </Button>
        </div>
      ) : null}
      {submissions.length > 0 && (
        <div className="space-y-3">
          {submissions.length > submissionsPerPage ? (
            <div className="flex justify-end">
              <p className={cn("text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
                Page {submissionsPage} of {totalSubmissionsPages}
              </p>
            </div>
          ) : null}
          <div className={cn(chrome.card, "divide-y divide-[var(--border)] overflow-hidden")}>
                {paginatedSubmissions.length === 0 ? (
                  <p className={cn("py-8 text-center text-sm", PORTAL_TEXT_MUTED)}>
                    No submissions match this filter
                  </p>
                ) : (
                  paginatedSubmissions.map((submission, index) => {
                    const stripe = portalListStripe(index, chrome.theme.family)
                    const KindIcon = isClassroomSolutionAssignment(submission.submission_kind) ? PenLine : FileCode
                    return (
                      <div key={submission.id} className={CP_ROW}>
                        <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl", stripe.iconBg)}>
                          <KindIcon className={cn("h-4 w-4", stripe.iconText)} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>{submission.title}</p>
                            <span
                              className={cn(
                                CP_STATUS_PILL,
                                isClassroomSolutionAssignment(submission.submission_kind)
                                  ? "bg-[var(--muted)]/60 text-[var(--cc-text-muted)]"
                                  : "bg-[var(--cc-accent)]/15 text-[var(--cc-accent-dark)]",
                              )}
                            >
                              {isClassroomSolutionAssignment(submission.submission_kind) ? "Solution" : "Code"}
                            </span>
                            <span
                              className={cn(
                                CP_STATUS_PILL,
                                submission.is_active
                                  ? "bg-[var(--cc-sem-success)]/15 text-[var(--cc-sem-success)]"
                                  : "bg-[var(--muted)]/60 text-[var(--cc-text-muted)]",
                              )}
                            >
                              {submission.is_active ? "Active" : "Expired"}
                            </span>
                          </div>
                          {isClassroomSolutionAssignment(submission.submission_kind) ? (
                            (() => {
                              const qc = parseClassroomSolutionQuestionConfig(submission.question_config);
                              return qc?.question_text ? (
                                <p className={cn("mt-1 line-clamp-2 text-xs", PORTAL_TEXT_MUTED)}>
                                  {qc.question_text}
                                </p>
                              ) : (
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                  No problem statement yet — click edit to add content.
                                </p>
                              );
                            })()
                          ) : submission.description ? (
                            <p className={cn("mt-1 line-clamp-2 text-xs", PORTAL_TEXT_MUTED)}>
                              {submission.description}
                            </p>
                          ) : null}
                          <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
                            Session: {submission.session ?? "All sections"}
                            {(() => {
                              const dueLabel = formatAssignmentDueLabel(submission.due_at, submission.expires_at);
                              return dueLabel ? ` · Due ${dueLabel}` : "";
                            })()}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Edit assignment"
                            onClick={() => handleEditSubmission(submission)}
                            className={CP_ACTION}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Delete assignment"
                            onClick={() => handleDeleteSubmission(submission.id)}
                            className="h-7 w-7 text-[var(--cc-text-muted)] hover:bg-[var(--cc-sem-danger)]/10 hover:text-[var(--cc-sem-danger)]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })
                  )}
                </div>
                
          {submissions.length > submissionsPerPage && (
            <div className="flex items-center justify-between gap-2 border-t border-[var(--border)]/60 pt-3">
              <Button variant="outline" size="sm" onClick={handleSubmissionsPrevPage} disabled={submissionsPage === 1} className={cn("h-8 gap-1", chrome.quiet)}>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className={cn("text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
                Page {submissionsPage} of {totalSubmissionsPages}
              </span>
              <Button variant="outline" size="sm" onClick={handleSubmissionsNextPage} disabled={submissionsPage === totalSubmissionsPages} className={cn("h-8 gap-1", chrome.quiet)}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      </>
      )}

      {sectionVisible("overview") && (
      <>
      <motion.div
        className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <DashboardKpiCard facultyModuleId="classroom-points" label="Students on roster" value={students.length} sub="Enrolled in this session view" icon={Users} />
        <DashboardKpiCard
          facultyModuleId="classroom-points"
          label="Pending review"
          value={pendingApprovals.length}
          sub={pendingApprovals.length ? "Submissions need approval" : "Queue is clear"}
          icon={Clock}
          semantic={pendingApprovals.length > 0 ? "warning" : undefined}
        />
        <DashboardKpiCard facultyModuleId="classroom-points" label="Open assignments" value={activeSubmissionsCount} sub={`${submissions.length} total configured`} icon={Target} />
        <DashboardKpiCard
          facultyModuleId="classroom-points"
          label="Class engagement"
          value={`${engagementPct}%`}
          sub={`${engagedStudents} of ${students.length} earned ≥1 award · avg ${avgPoints.toFixed(1)} raw pts`}
          icon={TrendingUp}
          semantic="success"
        />
      </motion.div>

      <ClassroomPointsOverviewCharts
        students={students}
        recentAwards={recentAwards}
        pendingApprovals={pendingApprovals}
        activeAssignmentCount={activeSubmissionsCount}
        loading={loading}
        pointsForFullGrade={classroomPointsForFullGrade}
      />
      </>
      )}

      {/* Combined Pending Approvals Section - All types in one container */}
      {sectionVisible("pending-approvals") && (
        <>
        <FacultyIntegratedToolbar
          moduleId="classroom-points"
          filters={sessionFilterControl}
          meta={
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
              {pendingApprovals.length + pendingPracticePoints.length} pending approval
              {pendingApprovals.length + pendingPracticePoints.length === 1 ? "" : "s"}
            </p>
          }
          trailing={
            pendingApprovals.length > 0 || pendingPracticePoints.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1">
                {pendingApprovals.length > 0 ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleApproveAll}
                      disabled={approving === -1 || approving === -3}
                      className={cn(facultyToolbarFilterButtonClass(), "text-[var(--cc-sem-success)]")}
                    >
                      {approving === -1 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">Approve all</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleVerifyAndApproveAll}
                      disabled={approving === -1 || approving === -3}
                      className={facultyToolbarFilterButtonClass()}
                    >
                      {approving === -3 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Target className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">Verify all</span>
                    </Button>
                  </>
                ) : null}
                {pendingPracticePoints.length > 0 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleApproveAllPractice}
                    disabled={approving === -2 || approving === -1 || approving === -3}
                    className={cn(facultyToolbarFilterButtonClass(), "text-[var(--cc-sem-success)]")}
                  >
                    {approving === -2 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">Approve practice</span>
                  </Button>
                ) : null}
              </div>
            ) : undefined
          }
        />
        <div className={cn(CP_TILE, "overflow-hidden")}>
          <div className="border-b border-[var(--border)]/60 px-4 py-3">
            <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Pending approvals</p>
            <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>
              Review submissions before points are awarded to students.
            </p>
          </div>
          <div className="divide-y divide-[var(--border)]">
              {/* Code Submission Approvals */}
              {pendingApprovals.map((point) => {
                const pointType =
                  point.category === "solution_submission"
                    ? "Solution assignment"
                    : point.category === "code_submission"
                      ? "Code assignment"
                      : "Assignment"
                const authenticityScore = point.authenticity_score ?? null
                const isAISuspicious = point.ai_suspicion === true || (authenticityScore !== null && authenticityScore < 50)
                const getAuthenticityLabel = (score: number | null) => {
                  if (score === null) return "Not analyzed"
                  if (score >= 80) return "Likely student-written"
                  if (score >= 50) return "Mixed / uncertain"
                  return "Likely AI-written"
                }
                const getAuthenticityColor = (score: number | null) => {
                  if (score === null) return "bg-[var(--muted)]/40 text-[var(--cc-text-muted)] border-[var(--border)]"
                  if (score >= 80) return "bg-[var(--cc-sem-success)]/15 text-[var(--cc-sem-success)] border-[var(--cc-sem-success)]/30"
                  if (score >= 50) return "bg-[var(--cc-sem-warning)]/15 text-[var(--cc-sem-warning)] border-[var(--cc-sem-warning)]/30"
                  return "bg-[var(--cc-sem-danger)]/15 text-[var(--cc-sem-danger)] border-[var(--cc-sem-danger)]/30"
                }
                
                return (
                  <div
                    key={point.id}
                    className={cn(
                      CP_ROW,
                      "flex-col items-stretch gap-3",
                      point.isDuplicate && "opacity-75 border-[var(--cc-sem-danger)]/30",
                      !point.isDuplicate && isAISuspicious && "border-[var(--cc-sem-danger)]/25",
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <ClassroomPointBoosterBadge
                            points={defaultApprovalPoints(point)}
                            pointBooster={point.point_booster}
                            variant="solid"
                          />
                          <Badge variant="outline" className={cn(CP_STATUS_PILL, "border-[var(--border)] bg-[var(--muted)]/40 text-[var(--cc-text-muted)]")}>
                            {pointType}
                          </Badge>
                          <span className={cn("font-semibold text-sm", PORTAL_TEXT)}>{point.student_name}</span>
                          <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>({point.student_number})</span>
                          <Badge variant="outline" className={cn(CP_STATUS_PILL, "border-[var(--border)]")}>{point.session || 'N/A'}</Badge>
                          {point.status === 'needs_review' && (
                            <span className={cn(CP_STATUS_PILL, "bg-[var(--cc-sem-warning)]/15 text-[var(--cc-sem-warning)]")}>
                              Needs review
                            </span>
                          )}
                          {point.isDuplicate && (
                            <span className={cn(CP_STATUS_PILL, "inline-flex items-center gap-1 bg-[var(--cc-sem-danger)]/15 text-[var(--cc-sem-danger)]")}>
                              <Copy className="h-3 w-3" />
                              Duplicate ({point.highestScoreInGroup} pts)
                            </span>
                          )}
                          {point.highestInGroup && point.duplicateOf === null && point.isDuplicate === false && (
                            <span className={cn(CP_STATUS_PILL, "inline-flex items-center gap-1 bg-[var(--cc-sem-success)]/15 text-[var(--cc-sem-success)]")}>
                              <CheckCheck className="h-3 w-3" />
                              Unique
                            </span>
                          )}
                        </div>
                        <p className={cn("mt-1 text-xs line-clamp-2", PORTAL_TEXT_MUTED)}>
                          {point.reason?.split('|')[0]?.trim() || point.reason}
                        </p>
                        {point.reason && point.reason.includes('AI:') && (
                          <div className={cn(CP_ROW_INNER, "mt-2")}>
                            <p className={cn("text-xs font-semibold mb-1", PORTAL_TEXT)}>AI validation</p>
                            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                              {point.reason.split('AI:')[1]?.trim() || 'No AI remark available'}
                            </p>
                          </div>
                        )}
                        
                        {/* Code Display */}
                        {point.code && (
                          <div className="mt-3 space-y-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setExpandedCode(prev => {
                                  const next = new Set(prev);
                                  if (next.has(point.id)) {
                                    next.delete(point.id);
                                  } else {
                                    next.add(point.id);
                                  }
                                  return next;
                                });
                              }}
                              className="flex items-center gap-2"
                            >
                              <Code className="h-4 w-4" />
                              {expandedCode.has(point.id) ? (
                                <>
                                  <ChevronUp className="h-4 w-4" />
                                  Hide Code
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-4 w-4" />
                                  View Code
                                </>
                              )}
                            </Button>
                            {expandedCode.has(point.id) && (
                              <div className="border-2 border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
                                <LightCodeViewer value={point.code} height="400px" />
                              </div>
                            )}
                          </div>
                        )}

                        {point.plot_image && (
                          <div className={cn(CP_ROW_INNER, "mt-3")}>
                            <p className={cn("text-xs font-semibold mb-2 flex items-center gap-1", PORTAL_TEXT)}>
                              <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                              Plot / figure
                            </p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={point.plot_image}
                              alt="Student plot submission"
                              className="max-w-full max-h-[min(420px,70vh)] object-contain rounded border border-[var(--border)] bg-[var(--background)]"
                            />
                          </div>
                        )}

                        {point.category === "solution_submission" && (
                          <div className="mt-3 space-y-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setExpandedSolution((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(point.id)) next.delete(point.id)
                                  else next.add(point.id)
                                  return next
                                })
                              }}
                              className="flex items-center gap-2"
                            >
                              <PenLine className="h-4 w-4" />
                              {expandedSolution.has(point.id) ? (
                                <>
                                  <ChevronUp className="h-4 w-4" />
                                  Hide Solution
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-4 w-4" />
                                  View Solution
                                </>
                              )}
                            </Button>
                            {expandedSolution.has(point.id) ? (
                              <div className={cn(CP_ROW_INNER, "p-4")}>
                                <ClassroomSolutionApprovalPreview
                                  assignmentQuestionConfig={point.assignment_question_config}
                                  solutionAnswerJson={point.solution_answer_json}
                                />
                              </div>
                            ) : null}
                          </div>
                        )}
                        
                        {/* Points Input for Approval */}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <label className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>
                            Award points
                          </label>
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            placeholder={defaultApprovalPoints(point).toString()}
                            value={
                              approvalPoints[point.id] ||
                              defaultApprovalPoints(point).toString()
                            }
                            onChange={(e) => {
                              setApprovalPoints(prev => ({
                                ...prev,
                                [point.id]: e.target.value
                              }));
                            }}
                            className="h-8 w-24"
                          />
                          <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                            default{" "}
                            {formatClassroomPointsBoosterBadgeText(
                              defaultApprovalPoints(point),
                              Math.max(1, Number(point.point_booster) || 1),
                            )}
                          </span>
                        </div>
                        
                        {point.isDuplicate && (
                          <Alert className="mt-2 border-red-300 bg-red-50 dark:bg-red-950/20">
                            <XCircle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-sm text-red-800 dark:text-red-300">
                              This is a duplicate submission within 24 hours. Only the highest score ({point.highestScoreInGroup} points) will be approved when using "Approve All".
                            </AlertDescription>
                          </Alert>
                        )}
                        {point.category && (
                          <span className={cn(CP_STATUS_PILL, "mt-1 bg-[var(--muted)]/40 text-[var(--cc-text-muted)]")}>
                            {CATEGORIES.find(c => c.value === point.category)?.label || point.category}
                          </span>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className={cn(CP_STATUS_PILL, "bg-[var(--cc-sem-warning)]/15 text-[var(--cc-sem-warning)]")}>
                            {point.status || 'pending'}
                          </span>
                          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                            {point.awarded_at ? new Date(point.awarded_at).toLocaleString() : 'Just submitted'}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const pointsValue = approvalPoints[point.id]
                              ? parseFloat(approvalPoints[point.id])
                              : defaultApprovalPoints(point);
                            handleApprove(point.id, pointsValue);
                          }}
                          disabled={approving === point.id || point.isDuplicate}
                          className={cn(facultyToolbarFilterButtonClass(), "text-[var(--cc-sem-success)]")}
                          title={
                            point.isDuplicate
                              ? "Cannot approve duplicate - higher score will be approved instead"
                              : `Will award ${defaultApprovalPoints(point)} points by default`
                          }
                        >
                          {approving === point.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <CheckCheck className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Approve</span>
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReject(point.id)}
                          disabled={approving === point.id}
                          className={cn(facultyToolbarFilterButtonClass(), "text-[var(--cc-sem-danger)]")}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Reject</span>
                        </Button>
                      </div>
                    </div>
                    
                    {/* AI Authorship Warning */}
                    {isAISuspicious && authenticityScore !== null && (
                      <Alert className={`border-2 ${getAuthenticityColor(authenticityScore)}`}>
                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <AlertDescription>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-red-800 dark:text-red-300">
                                ⚠️ AI Authorship Warning
                              </span>
                              <Badge className={getAuthenticityColor(authenticityScore)}>
                                Authenticity Score: {authenticityScore}/100 ({getAuthenticityLabel(authenticityScore)})
                              </Badge>
                            </div>
                            {point.authorship_reasoning && (
                              <p className="text-sm text-red-700 dark:text-red-400">
                                {point.authorship_reasoning}
                              </p>
                            )}
                            {point.flagged_features && point.flagged_features.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-semibold text-red-800 dark:text-red-300 mb-1">
                                  Flagged Features:
                                </p>
                                <ul className="list-disc list-inside text-xs text-red-700 dark:text-red-400 space-y-1">
                                  {point.flagged_features.map((feature: string, idx: number) => (
                                    <li key={idx}>• {feature}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <p className="text-xs text-red-600 dark:text-red-400 italic mt-2">
                              Recommendation: Review this submission carefully before approving points.
                            </p>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {/* Show authenticity score even if not suspicious (for transparency) */}
                    {!isAISuspicious && authenticityScore !== null && (
                      <div className="text-xs">
                        <Badge variant="outline" className={getAuthenticityColor(authenticityScore)}>
                          Authenticity Score: {authenticityScore}/100 ({getAuthenticityLabel(authenticityScore)})
                        </Badge>
                      </div>
                    )}
                  </div>
                )
              })}
              
              {/* Practice Points (Daily Challenges & Practice Problems) */}
              {pendingPracticePoints.map((point: any) => {
                const isDailyChallenge = !!point.daily_challenge_submission_id
                const pointType = isDailyChallenge ? "Daily Challenge" : "Practice Problem"
                
                return (
                  <div
                    key={point.id}
                    className={cn(CP_ROW, "flex-col items-stretch gap-3 sm:flex-row sm:items-start")}
                  >
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn(CP_STATUS_PILL, "bg-[var(--cc-accent)]/15 text-[var(--cc-accent-dark)]")}>{point.points} pts</span>
                          <span className={cn(CP_STATUS_PILL, "bg-[var(--muted)]/40 text-[var(--cc-text-muted)]")}>
                            {pointType}
                          </span>
                          <span className={cn("text-sm font-semibold", PORTAL_TEXT)}>{point.student_name}</span>
                          <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>({point.student_number})</span>
                          <Badge variant="outline" className={cn(CP_STATUS_PILL, "border-[var(--border)]")}>{point.session || 'N/A'}</Badge>
                        </div>
                        <p className={cn("mt-1 text-xs line-clamp-2", PORTAL_TEXT_MUTED)}>
                          {point.reason}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className={cn(CP_STATUS_PILL, "bg-[var(--cc-sem-warning)]/15 text-[var(--cc-sem-warning)]")}>
                            {point.status || 'pending'}
                          </span>
                          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                            {point.created_at ? new Date(point.created_at).toLocaleString() : 'Just submitted'}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            setApproving(point.id)
                            try {
                              const response = await instructorApiFetch("/api/practice-points/approve", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ id: point.id }),
                              })
                              if (response.ok) {
                                toast({
                                  title: "Success",
                                  description: "Practice point approved",
                                })
                                fetchData()
                              } else {
                                throw new Error("Failed to approve")
                              }
                            } catch (error) {
                              toast({
                                title: "Error",
                                description: "Failed to approve practice point",
                                variant: "destructive",
                              })
                            } finally {
                              setApproving(null)
                            }
                          }}
                          disabled={approving === point.id}
                          className={cn(facultyToolbarFilterButtonClass(), "text-[var(--cc-sem-success)]")}
                        >
                          {approving === point.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <CheckCheck className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Approve</span>
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            setApproving(point.id)
                            try {
                              const response = await instructorApiFetch(`/api/practice-points/approve?id=${point.id}`, {
                                method: "DELETE",
                              })
                              if (response.ok) {
                                toast({
                                  title: "Success",
                                  description: "Practice point rejected",
                                })
                                fetchData()
                              } else {
                                throw new Error("Failed to reject")
                              }
                            } catch (error) {
                              toast({
                                title: "Error",
                                description: "Failed to reject practice point",
                                variant: "destructive",
                              })
                            } finally {
                              setApproving(null)
                            }
                          }}
                          disabled={approving === point.id}
                          className={cn(facultyToolbarFilterButtonClass(), "text-[var(--cc-sem-danger)]")}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Reject</span>
                        </Button>
                      </div>
                  </div>
                )
              })}
            {pendingApprovals.length === 0 && pendingPracticePoints.length === 0 && (
              <div className="px-4 py-10 text-center">
                <div className={cn("mx-auto mb-3", chrome.iconBadge())}>
                  <Clock className="h-5 w-5 !text-white" />
                </div>
                <p className={cn("text-sm font-medium", PORTAL_TEXT)}>No pending approvals</p>
                <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
                  Student submissions will appear here for review
                </p>
              </div>
            )}
          </div>
        </div>
        </>
      )}

      {sectionVisible("students") && (
      <>
      <FacultyIntegratedToolbar
        moduleId="classroom-points"
        search={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by name or ID…"
        filters={sessionFilterControl}
        meta={
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {filteredStudents.length} student{filteredStudents.length === 1 ? "" : "s"}
            {searchQuery ? " matching search" : ""}
          </p>
        }
        trailing={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={loading || students.length === 0 || filteredStudents.length === 0}
                className={facultyToolbarFilterButtonClass()}
              >
                {exportZipBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Export</span>
                <ChevronDown className="h-3 w-3 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[min(100vw-2rem,17rem)]">
              <DropdownMenuItem onClick={exportSummaryCsv} className="cursor-pointer">
                Summary CSV (table totals)
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                disabled={exportZipBusy}
                onClick={() => void exportDetailedCsv()}
              >
                Detailed CSV (each award)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                disabled={exportZipBusy}
                onClick={() => void exportPortfolioZip()}
              >
                <Archive className="h-4 w-4 mr-2 shrink-0 opacity-80" />
                ZIP — one PDF per student
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {!loading && podiumEntries.length > 0 ? (
        <PortalLeaderboardPodium
          entries={podiumEntries}
          heading="Top students"
          className="mb-4 sm:mb-5"
        />
      ) : null}

      {/* Students Table */}
      {loading ? (
        <div className="space-y-2 py-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-2/3" />
        </div>
      ) : students.length === 0 ? (
        <div className={cn(CP_PANEL, "text-center py-10")}>
          <div className={cn("mx-auto mb-3", chrome.iconBadge())}>
            <Users className="h-5 w-5 !text-white" />
          </div>
          <p className={cn("text-sm font-medium", PORTAL_TEXT)}>No students found</p>
          <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
            {sessionFilter !== "all"
              ? `No students in session ${sessionFilter}. Try all sessions.`
              : "Students appear here once they register."}
          </p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className={cn(CP_PANEL, "text-center py-10")}>
          <Search className="mx-auto mb-3 h-10 w-10 opacity-40 text-[var(--cc-text-muted)]" />
          <p className={cn("text-sm font-medium", PORTAL_TEXT)}>No matches</p>
          <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
            No students matching &ldquo;{searchQuery}&rdquo;
          </p>
        </div>
      ) : (
        <Card className={cn(CP_TILE, "overflow-hidden border-[var(--border)]")}>
          <CardContent className="p-0">
            {/* Simple Clean Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                               <thead className="border-b border-[var(--border)]/60 bg-[var(--muted)]/20">
                  <tr>
                    <th className={cn("text-left px-4 py-3 text-xs font-semibold w-14", PORTAL_TEXT_MUTED)}>
                      #
                    </th>
                    <th className={cn("text-left px-4 py-3 text-xs font-semibold", PORTAL_TEXT_MUTED)}>
                      Full Name
                    </th>
                    <th className={cn("text-left px-4 py-3 text-xs font-semibold", PORTAL_TEXT_MUTED)}>
                      <div className="flex flex-col gap-0.5 items-start">
                        <span className="flex items-center gap-2">
                          <Star className={cn("h-3.5 w-3.5", chrome.accentIcon)} />
                          Raw points
                        </span>
                        <span className={cn("text-[10px] font-normal", PORTAL_TEXT_MUTED)}>
                          ({classroomPointsForFullGrade} = full)
                        </span>
                      </div>
                    </th>
                    <th className={cn("text-left px-4 py-3 text-xs font-semibold", PORTAL_TEXT_MUTED)}>
                      <div className="flex flex-col gap-0.5 items-start">
                        <span>Grade slice</span>
                        <span className={cn("text-[10px] font-normal", PORTAL_TEXT_MUTED)}>
                          of 10 pts
                        </span>
                      </div>
                    </th>
                    <th className={cn("text-left px-4 py-3 text-xs font-semibold", PORTAL_TEXT_MUTED)}>
                      <div className="flex items-center gap-2">
                        <Trophy className={cn("h-3.5 w-3.5", chrome.accentIcon)} />
                        Awards
                      </div>
                    </th>
                    <th className={cn("text-left px-4 py-3 text-xs font-semibold", PORTAL_TEXT_MUTED)}>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/60">
                  {paginatedStudents.map((student, idx) => {
                    const hasPoints = Number(student.total_points || 0) > 0;
                    const globalIdx = startIndex + idx;
                    
                    return (
                      <tr 
                        key={student.student_id}
                        className="transition-colors hover:bg-[var(--muted)]/15"
                      >
                        <td className={cn("px-4 py-3 text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
                          {globalIdx + 1}
                        </td>
                        <td className={cn("px-4 py-3 text-sm font-medium", PORTAL_TEXT)}>
                          {student.full_name}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {hasPoints ? (
                              <span className={cn(CP_STATUS_PILL, "inline-flex items-center gap-1 bg-[var(--cc-accent)]/15 text-[var(--cc-accent-dark)]")}>
                                <Star className="h-3 w-3 fill-current opacity-80" />
                                {Number(student.total_points || 0).toFixed(1)} pts
                              </span>
                            ) : (
                              <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>0.0 pts</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-sm font-medium tabular-nums", PORTAL_TEXT)}>
                            {classroomRawPointsToGradePoints10(Number(student.total_points || 0), classroomPointsForFullGrade).toFixed(2)}
                            <span className={cn("font-normal", PORTAL_TEXT_MUTED)}> / 10</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Trophy className={cn("h-3.5 w-3.5", student.award_count > 0 ? chrome.accentIcon : "text-[var(--cc-text-muted)] opacity-40")} />
                            <span className={cn("text-sm font-medium tabular-nums", PORTAL_TEXT)}>
                              {student.award_count}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Dialog open={showAwardDialog && selectedStudent?.student_id === student.student_id} onOpenChange={(open) => {
                            setShowAwardDialog(open);
                            if (!open) setSelectedStudent(null);
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                onClick={() => setSelectedStudent(student)}
                                className={cn("h-8 gap-1", fp.cta)}
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Award
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg dark:bg-slate-950 dark:border-white/10">
                              <DialogHeader>
                                <DialogTitle className="text-xl">Award classroom points</DialogTitle>
                                <DialogDescription>
                                  Award points to <span className={cn("font-semibold", PORTAL_TEXT)}>{student.full_name}</span> ({student.student_number})
                                </DialogDescription>
                              </DialogHeader>

                              <div className="space-y-5 py-4">
                                <div className="space-y-2">
                                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Points Amount</label>
                                  <Input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    placeholder="Enter points (e.g., 5)"
                                    value={awardPoints}
                                    onChange={(e) => setAwardPoints(e.target.value)}
                                    className="text-lg h-12"
                                  />
                                  <p className="text-xs text-slate-500 dark:text-slate-400">Enter any positive number (decimals allowed)</p>
                                </div>

                                <div className="space-y-2">
                                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Category</label>
                                  <Select value={awardCategory} onValueChange={setAwardCategory}>
                                    <SelectTrigger className="h-12">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="dark:bg-slate-900 dark:border-slate-700">
                                      {CATEGORIES.map(cat => (
                                        <SelectItem key={cat.value} value={cat.value} className="text-base">
                                          <span className="flex items-center gap-2">
                                            <span className="text-xl">{cat.icon}</span>
                                            <span>{cat.label}</span>
                                          </span>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-2">
                                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Reason</label>
                                  <Textarea
                                    placeholder="Why are you awarding these points? (e.g., 'Excellent code submission on binary search')"
                                    value={awardReason}
                                    onChange={(e) => setAwardReason(e.target.value)}
                                    rows={4}
                                    className="resize-none"
                                  />
                                </div>

                                <Button
                                  onClick={handleAwardPoints}
                                  disabled={submitting}
                                  size="lg"
                                  className={cn("w-full h-12 text-base font-semibold", fp.cta)}
                                >
                                  {submitting ? (
                                    <>
                                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                                      Awarding...
                                    </>
                                  ) : (
                                    <>
                                      <Gift className="h-5 w-5 mr-2" />
                                      Award Points
                                    </>
                                  )}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredStudents.length)} of {filteredStudents.length} students
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNumber;
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
                      key={pageNumber}
                      variant={currentPage === pageNumber ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNumber)}
                      className={`h-8 w-8 p-0 ${
                        currentPage === pageNumber ? fp.cta : ""
                      }`}
                    >
                      {pageNumber}
                    </Button>
                  );
                })}
                
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <>
                    <span className="text-slate-400">...</span>
                    <Button
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
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                
                <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(Number(v))}>
<SelectTrigger className="h-8 w-[100px] ml-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-900 dark:border-slate-700">
                    <SelectItem value="5">5 / page</SelectItem>
                    <SelectItem value="10">10 / page</SelectItem>
                    <SelectItem value="20">20 / page</SelectItem>
                    <SelectItem value="50">50 / page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      </>
      )}

      {sectionVisible("recent-awards") && (
        <>
        <FacultyIntegratedToolbar
          moduleId="classroom-points"
          filters={sessionFilterControl}
          meta={
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
              {recentAwards.length} award{recentAwards.length === 1 ? "" : "s"}
            </p>
          }
        />
        <div className={cn(CP_TILE, "overflow-hidden")}>
          <div className="border-b border-[var(--border)]/60 px-4 py-3">
            <p className={cn("text-sm font-semibold flex items-center gap-2", PORTAL_TEXT)}>
              <History className="h-4 w-4 opacity-70" />
              Recent awards
            </p>
            <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>Latest classroom points awarded</p>
          </div>
          <div className="p-4">
            {recentAwards.length === 0 ? (
              <div className="py-10 text-center">
                <div className={cn("mx-auto mb-3", chrome.iconBadge())}>
                  <History className="h-5 w-5 !text-white" />
                </div>
                <p className={cn("text-sm font-medium", PORTAL_TEXT)}>No awards yet</p>
                <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
                  Approved points will show here for the selected session.
                </p>
              </div>
            ) : (
            <>
            <div className="divide-y divide-[var(--border)]">
              {paginatedAwards.map((award, idx) => {
                const stripe = portalListStripe(idx, chrome.theme.family)
                return (
                <div
                  key={award.id}
                  className={CP_ROW}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl text-sm", stripe.iconBg, stripe.iconText)}>
                      {CATEGORIES.find(c => c.value === award.category)?.icon || "🎁"}
                    </div>
                    <div className="min-w-0">
                      <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{award.student_name}</p>
                      <p className={cn("text-xs line-clamp-2 mt-0.5", PORTAL_TEXT_MUTED)}>{award.reason}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={cn("text-sm font-semibold tabular-nums text-[var(--cc-accent-dark)]")}>
                      +{Number(award.points).toFixed(1)} pts
                    </span>
                    <p className={cn("text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
                      {new Date(award.awarded_at).toLocaleDateString()}
                    </p>
                    {canEditClassroomAward(award) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className={cn("h-7 text-xs", CP_ACTION, "w-auto px-2")}
                        onClick={() => openEditAward(award)}
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Button>
                    ) : (
                      <span className={cn("max-w-[7rem] text-right text-[10px] leading-tight", PORTAL_TEXT_MUTED)}>
                        Code-linked: use approvals
                      </span>
                    )}
                  </div>
                </div>
                )
              })}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 mt-4 border-t border-[var(--border)]/60">
              <div className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                {awardsStartIndex + 1}–{Math.min(awardsEndIndex, recentAwards.length)} of{" "}
                {recentAwards.length}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAwardsPage((p) => Math.max(1, p - 1))}
                  disabled={awardsPage <= 1}
                  className={cn("h-8 gap-1", chrome.quiet)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <span className={cn("text-xs tabular-nums px-1", PORTAL_TEXT_MUTED)}>
                  Page {awardsPage} of {totalAwardsPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAwardsPage((p) => Math.min(totalAwardsPages, p + 1))}
                  disabled={awardsPage >= totalAwardsPages}
                  className={cn("h-8 gap-1", chrome.quiet)}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Select
                  value={awardsPerPage.toString()}
                  onValueChange={(v) => {
                    setAwardsPerPage(Number(v));
                    setAwardsPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[110px]">
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
            </>
            )}
          </div>
        </div>
        </>
      )}

      <Dialog
        open={editingAward !== null}
        onOpenChange={(open) => {
          if (!open) setEditingAward(null);
        }}
      >
        <DialogContent className="max-w-md dark:bg-slate-950 dark:border-white/10">
          <DialogHeader>
            <DialogTitle>Edit classroom points</DialogTitle>
            <DialogDescription>
              {editingAward
                ? `${editingAward.student_name} — adjust points, reason, or category.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {editingAward && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Points</label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={editAwardPoints}
                  onChange={(e) => setEditAwardPoints(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Category</label>
                <Select value={editAwardCategory} onValueChange={setEditAwardCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-700">
                    {CATEGORIES.filter((c) => c.value !== "code_submission").map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <span className="flex items-center gap-2">
                          <span>{cat.icon}</span>
                          <span>{cat.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Reason</label>
                <Textarea
                  value={editAwardReason}
                  onChange={(e) => setEditAwardReason(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
              <Button
                type="button"
                className={cn("w-full", fp.cta)}
                disabled={savingAwardEdit}
                onClick={() => void saveAwardEdit()}
              >
                {savingAwardEdit ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && submissionToDelete && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
              onClick={() => {
                setShowDeleteModal(false);
                setSubmissionToDelete(null);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none"
            >
              <div 
                className={cn(chrome.card, "max-w-md w-full p-6 pointer-events-auto")}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className={cn("flex size-14 items-center justify-center rounded-2xl", chrome.danger)}>
                    <AlertTriangle className="h-7 w-7 !text-white" />
                  </div>
                  <div>
                    <h3 className={cn("mb-2 text-lg font-semibold", PORTAL_TEXT)}>
                      Delete assignment?
                    </h3>
                    <p className={cn("mb-2 text-sm", PORTAL_TEXT_MUTED)}>
                      Delete <strong className={PORTAL_TEXT}>"{submissionToDelete.title}"</strong>?
                    </p>
                    <p className="text-sm font-medium text-[var(--cc-sem-danger)]">
                      This cannot be undone. Student submissions and points for this assignment will be revoked.
                    </p>
                  </div>
                  <div className="flex gap-3 w-full mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowDeleteModal(false);
                        setSubmissionToDelete(null);
                      }}
                      className={cn("flex-1", chrome.quiet)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={confirmDeleteSubmission}
                      className={cn("flex-1", chrome.danger)}
                    >
                      Delete assignment
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ClassroomAssignmentEditDialog
        open={assignmentEditOpen}
        onOpenChange={setAssignmentEditOpen}
        submission={assignmentEditTarget}
        sessions={sessions}
        onSaved={fetchSubmissions}
      />

      {sectionVisible("configuration") && (
        <InstructorClassroomPointsRulesHub embedded />
      )}
    </div>
  );
}

