"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Award,
  TrendingUp,
  Trophy,
  Star,
  Calendar,
  Gift,
  Medal,
  Crown,
  Sparkles,
  Zap,
  Code,
  Send,
  Loader2,
  CheckCircle2,
  FileCode,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  AlertTriangle,
  Flame,
  BarChart3,
  PenLine,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { motion, AnimatePresence } from "@/components/student/dashboard-v2/light-motion"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/use-toast"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { AiFeedbackMarkdown } from "@/components/ai-feedback-markdown"
import { ClassroomPointBoosterBadge } from "@/components/classroom-point-booster-badge"
import { ClassroomProvisionalScoreBadge } from "@/components/classroom-provisional-score-badge"
import { resolveClassroomDisplayPoints } from "@/lib/classroom-point-booster"
import { classroomPointsLeaderboardForCurrentOffering } from "@/lib/classroom-points-leaderboard-scope"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import dynamic from "next/dynamic"
import { CardWrapper } from "./CardWrapper"
import {
  SignatureListCard,
  signatureListStyles,
} from "@/components/student/dashboard-v2/SignatureListCard"
import {
  ClassroomPointsBrowseNav,
  type ClassroomPointsBrowseId,
} from "@/components/student/dashboard-v2/ClassroomPointsBrowseNav"
import { ClassroomPointsOverviewPanel } from "@/components/student/dashboard-v2/ClassroomPointsOverviewPanel"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { StudentModuleHubLayout } from "@/components/student/dashboard-v2/StudentModuleHubLayout"
import {
  PortalLeaderboardPodium,
  buildPortalPodiumEntries,
} from "@/components/dashboard-v2/PortalLeaderboardPodium"
import { cn } from "@/lib/utils"
import { solidListThumb } from "@/lib/student-color-hunt-theme"
import { ClassroomPointHistoryCard } from "@/components/classroom-point-history-card"
import {
  classroomPointHistoryTitle,
  type ClassroomPointHistoryRow,
} from "@/components/classroom-point-history-detail"
import { classroomPointIsProvisional } from "@/lib/classroom-points-ai-feedback.shared"
import { getStudentModuleTheme, studentModuleSpinnerClass } from "@/lib/student-module-themes"
import { portalOutlineButtonClass } from "@/lib/portal-module-themes"
import {
  PORTAL_CARD,
  PORTAL_CTA,
  PORTAL_OUTLINE_BTN,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/appearance/portal-nav-classes"
import { CC_MODAL_SCRIM, CC_MODAL_SURFACE } from "@/lib/appearance/modal-ui"
import { PointBoosterModal } from "@/components/point-booster-modal"
import { PlotUpload } from "@/components/plot-upload"
import { ClassroomSolutionSubmissionPanel } from "@/components/classroom-solution-submission-panel"
import { parseClassroomSolutionQuestionConfig } from "@/lib/classroom-solution-submission"
import {
  CLASSROOM_POINTS_FOR_FULL_GRADE,
  classroomRawPointsToGradePoints10,
} from "@/lib/classroom-points-grade-scale"
import { ClassroomAssignmentAccessNotice } from "@/components/classroom-assignment-access-notice"
import { isClassroomAssignmentPastDue } from "@/lib/classroom-assignment-access"
import {
  buildClassroomSubmissionsSnapshot,
  getClassroomAccessLockExplanation,
  resolveActiveAssignmentId,
} from "@/lib/classroom-assignment-access"
import { useClassroomSubmissionAccessMonitor } from "@/hooks/use-classroom-submission-access-monitor"
import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false })

function assignmentSuggestsPlot(title: string, description: string): boolean {
  const t = `${title || ""} ${description || ""}`.toLowerCase()
  return (
    /\b(plot|plotting|fplot|figure|figures|graph|graphs|subplot|legend|mesh|surf|contour|stem|stairs|histogram|fft|bode|nyquist|visualize|visualization|gnuplot|matplotlib|matlab|array\s*plot|discrete)\b/.test(
      t,
    ) ||
    /\b(code\s*write\s*plot|writeplot|code\s*\+\s*plot|plot\s*upload)\b/.test(t) ||
    t.includes("chapter 13")
  )
}

interface ClassroomPoint extends ClassroomPointHistoryRow {
  id: number
  points: number
  reason: string
  category: string
  awarded_at: string
  instructor_name: string
}

interface LeaderboardEntry {
  rank: number
  student_id?: number
  student_number?: string
  full_name?: string
  session?: string
  total_points?: number
  award_count?: number
  is_current_user?: boolean
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string; lucide: LucideIcon }> = {
  code_submission: { label: "Code assignment", icon: "💻", lucide: Code },
  solution_submission: { label: "Solution assignment", icon: "📐", lucide: PenLine },
  presentation: { label: "Presentation", icon: "🎤", lucide: Sparkles },
  participation: { label: "Participation", icon: "🙋", lucide: Zap },
  quiz_bonus: { label: "Quiz Bonus", icon: "📝", lucide: Award },
  extra_credit: { label: "Extra Credit", icon: "⭐", lucide: Star },
  other: { label: "Other", icon: "🎁", lucide: Gift },
}

const DEFAULT_CODE = `#include <iostream>

using namespace std;

int main() {
    // Your code goes here...
    
    return 0;
}`

export function ClassroomPointsV2({
  studentId,
  studentSession,
  embedInDashboard = false,
}: {
  studentId: number
  studentSession?: string
  embedInDashboard?: boolean
}) {
  const theme = getStudentModuleTheme("classroom-points")
  const cardVariant = embedInDashboard ? ("inner" as const) : ("default" as const)
  const pageTheme = theme.page
  const iconWellMd = cn("border shrink-0", pageTheme.iconBg, pageTheme.border)
  const iconAccent = pageTheme.iconText
  const softPanel = cn("border", pageTheme.softBg, pageTheme.border)
  const outlineBtn = cn(
    "shrink-0 rounded-xl w-full sm:w-auto min-h-[44px] sm:min-h-0 touch-manipulation font-medium",
    portalOutlineButtonClass(theme),
  )
  const { toast } = useToast()
  const [points, setPoints] = useState<ClassroomPoint[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [totalPoints, setTotalPoints] = useState(0)
  const [awardCount, setAwardCount] = useState(0)
  const [myRank, setMyRank] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const session = studentSession || (typeof window !== "undefined" ? sessionStorage.getItem("studentSection") : null)

  // Code submission state
  const [showCodeSubmission, setShowCodeSubmission] = useState(false)
  const [showSolutionSubmission, setShowSolutionSubmission] = useState(false)
  const [selectedSolutionSubmissionId, setSelectedSolutionSubmissionId] = useState<string>("")
  const [selectedSolutionPendingId, setSelectedSolutionPendingId] = useState<string>("")
  const [selectedSolutionMissingId, setSelectedSolutionMissingId] = useState<string>("")
  const [solutionDescription, setSolutionDescription] = useState("")
  const [code, setCode] = useState(DEFAULT_CODE)
  const [plotImage, setPlotImage] = useState<string | null>(null)
  const [description, setDescription] = useState("")
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>("")
  const [availableSubmissions, setAvailableSubmissions] = useState<any[]>([])
  const [missingSubmissions, setMissingSubmissions] = useState<any[]>([])
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([])
  const [selectedMissingId, setSelectedMissingId] = useState<string>("")
  const [selectedPendingId, setSelectedPendingId] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionSuccess, setSubmissionSuccess] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successModalData, setSuccessModalData] = useState<{
    pointBooster?: number
    pointsAwarded?: number
    boosterLabel?: string
    autoApproved?: boolean
    instructorFeedback?: string | null
  }>({})
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [pointsHistoryPage, setPointsHistoryPage] = useState(1)
  const pointsPerPage = 5
  const [blurLeaderboardPeers, setBlurLeaderboardPeers] = useState(true)
  const [browseView, setBrowseView] = useState<ClassroomPointsBrowseId>("overview")
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null)
  const [showCodeAssignmentsBlock, setShowCodeAssignmentsBlock] = useState(true)
  const [showSolutionAssignmentsBlock, setShowSolutionAssignmentsBlock] = useState(true)
  const [pointsForFullGrade, setPointsForFullGrade] = useState(CLASSROOM_POINTS_FOR_FULL_GRADE)

  const getClassroomSelection = useCallback(
    () => ({
      codeActiveId: selectedSubmissionId,
      codeMissingId: selectedMissingId,
      solutionActiveId: selectedSolutionSubmissionId,
      solutionMissingId: selectedSolutionMissingId,
    }),
    [
      selectedSubmissionId,
      selectedMissingId,
      selectedSolutionSubmissionId,
      selectedSolutionMissingId,
    ],
  )

  const {
    codeNotice,
    solutionNotice,
    clearCodeNotice,
    clearSolutionNotice,
    markChannelSubmittable,
    handleSubmissionsRefresh,
  } = useClassroomSubmissionAccessMonitor(toast, getClassroomSelection, {
    setCodeActiveId: setSelectedSubmissionId,
    setCodeMissingId: setSelectedMissingId,
    setCodePendingId: setSelectedPendingId,
    setSolutionActiveId: setSelectedSolutionSubmissionId,
    setSolutionMissingId: setSelectedSolutionMissingId,
    setSolutionPendingId: setSelectedSolutionPendingId,
  })

  useEffect(() => {
    fetchData()
    fetchSubmissions()

    const interval = setInterval(() => {
      if (!showSuccessModal) {
        fetchSubmissions()
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [studentId, session, showSuccessModal])

  const isSolutionAssignment = (sub: { submission_kind?: string }) =>
    String(sub?.submission_kind ?? "code").toLowerCase() === "solution"

  const codeAvailableSubmissions = availableSubmissions.filter((s) => !isSolutionAssignment(s))
  const solutionAvailableSubmissions = availableSubmissions.filter((s) => isSolutionAssignment(s))
  const solutionPendingSubmissions = pendingSubmissions.filter((s) => isSolutionAssignment(s))
  const solutionMissingSubmissions = missingSubmissions.filter((s) => isSolutionAssignment(s))

  const effectiveSolutionAssignmentId =
    selectedSolutionSubmissionId || selectedSolutionMissingId || selectedSolutionPendingId

  const selectedSolutionIsPending = effectiveSolutionAssignmentId
    ? solutionPendingSubmissions.some((s) => s.id.toString() === effectiveSolutionAssignmentId)
    : false

  const selectedSolutionAssignment =
    solutionAvailableSubmissions.find(
      (s) => s.id.toString() === (selectedSolutionSubmissionId || selectedSolutionMissingId),
    ) ||
    solutionPendingSubmissions.find((s) => s.id.toString() === selectedSolutionPendingId) ||
    solutionMissingSubmissions.find((s) => s.id.toString() === selectedSolutionMissingId)

  const selectedSolutionConfig = selectedSolutionAssignment
    ? parseClassroomSolutionQuestionConfig(selectedSolutionAssignment.question_config)
    : null

  const submissionsSnapshot = useMemo(
    () =>
      buildClassroomSubmissionsSnapshot({
        submissions: availableSubmissions,
        pendingSubmissions,
        missingSubmissions,
      }),
    [availableSubmissions, pendingSubmissions, missingSubmissions],
  )

  const isAssignmentPastDue = isClassroomAssignmentPastDue

  const effectiveCodeNotice =
    codeNotice ??
    (() => {
      const id = resolveActiveAssignmentId(
        selectedSubmissionId,
        selectedMissingId || selectedPendingId,
      )
      if (!id) return null

      if (pendingSubmissions.some((s) => s.id === id)) {
        return getClassroomAccessLockExplanation(id, submissionsSnapshot, "code")
      }

      if (selectedSubmissionId) return null
      const row =
        missingSubmissions.find((s) => s.id === id) ||
        availableSubmissions.find((s) => s.id === id)
      if (!row || !isAssignmentPastDue(row)) return null
      return getClassroomAccessLockExplanation(id, submissionsSnapshot, "code")
    })()

  const effectiveCodeAssignmentId = selectedSubmissionId || selectedMissingId || selectedPendingId
  const selectedCodeIsPending = effectiveCodeAssignmentId
    ? pendingSubmissions.some((s) => s.id.toString() === effectiveCodeAssignmentId)
    : false

  const effectiveSolutionNotice =
    solutionNotice ??
    (() => {
      const id = resolveActiveAssignmentId(
        selectedSolutionSubmissionId,
        selectedSolutionMissingId || selectedSolutionPendingId,
      )
      if (!id) return null

      if (solutionPendingSubmissions.some((s) => s.id === id)) {
        return getClassroomAccessLockExplanation(id, submissionsSnapshot, "solution")
      }

      if (selectedSolutionSubmissionId) return null
      const row =
        solutionMissingSubmissions.find((s) => s.id === id) ||
        solutionAvailableSubmissions.find((s) => s.id === id)
      if (!row || !isAssignmentPastDue(row)) return null
      return getClassroomAccessLockExplanation(id, submissionsSnapshot, "solution")
    })()

  const fetchSubmissions = async () => {
    try {
      const response = await studentApiFetch(`/api/classroom-points/submissions?session=${session || ""}&studentId=${studentId}`, {
        headers: getStudentAuthHeaders(),
      })
      const data = await response.json()

      const snapshot = handleSubmissionsRefresh(data)
      setAvailableSubmissions(snapshot.available)
      setPendingSubmissions(snapshot.pending)
      setMissingSubmissions(snapshot.missing)
    } catch (error) {
      console.error("[ClassroomPointsV2] Error fetching submissions:", error)
    }
  }

  const fetchData = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true)
      }

      const pointsUrl =
        session && session !== "ALL"
          ? `/api/classroom-points?studentId=${encodeURIComponent(String(studentId))}&session=${encodeURIComponent(session)}`
          : `/api/classroom-points?studentId=${encodeURIComponent(String(studentId))}`
      const pointsResponse = await studentApiFetch(pointsUrl, { headers: getStudentAuthHeaders() })
      const pointsData = await pointsResponse.json()

      const pointsArray = pointsData.points || []
      const rawTotal = pointsData.summary?.total_points
      const rawCount = pointsData.summary?.award_count

      let parsedTotal = 0
      let parsedCount = 0

      if (rawTotal !== undefined && rawTotal !== null) {
        parsedTotal = parseFloat(String(rawTotal))
      } else {
        parsedTotal = pointsArray.reduce((sum: number, point: ClassroomPoint) => {
          const value = Number(point.points)
          return sum + (Number.isFinite(value) ? value : 0)
        }, 0)
      }

      if (rawCount !== undefined && rawCount !== null) {
        parsedCount = parseInt(String(rawCount), 10)
      } else {
        parsedCount = pointsArray.length
      }

      setPoints(pointsArray)
      setTotalPoints(parsedTotal)
      setAwardCount(parsedCount)

      const policyCap = Number(pointsData.rewardsPolicy?.points_for_full_grade)
      if (Number.isFinite(policyCap) && policyCap > 0) {
        setPointsForFullGrade(policyCap)
      }

      const leaderboardUrl = session
        ? `/api/classroom-points/leaderboard?session=${session}&studentId=${studentId}`
        : `/api/classroom-points/leaderboard?studentId=${studentId}`

      const leaderboardResponse = await studentApiFetch(leaderboardUrl, { headers: getStudentAuthHeaders() })
      const leaderboardData = await leaderboardResponse.json()
      const leaderboardArray = classroomPointsLeaderboardForCurrentOffering(
        leaderboardData.leaderboard || [],
        { section: session },
      )
      setLeaderboard(leaderboardArray)
      setBlurLeaderboardPeers(
        leaderboardData.leaderboardPrivacy?.blurPeerNames ??
          leaderboardData.privacyMode ??
          true,
      )
      setShowCodeAssignmentsBlock(leaderboardData.studentSubmissionBlocks?.showCodeAssignments ?? true)
      setShowSolutionAssignmentsBlock(
        leaderboardData.studentSubmissionBlocks?.showSolutionAssignments ?? true,
      )

      const myEntry = leaderboardArray.find((entry: LeaderboardEntry) => entry.student_id === studentId)
      if (myEntry) {
        setMyRank(myEntry.rank)
      } else {
        setMyRank(null)
      }
    } catch (error) {
      console.error("[ClassroomPointsV2] Error fetching data:", error)
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date()
    const expires = new Date(expiresAt)
    const diff = expires.getTime() - now.getTime()

    if (diff <= 0) return "Expired"

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days} day${days > 1 ? "s" : ""} left`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m left`
    } else {
      return `${minutes}m left`
    }
  }

  const formatMissingAssignmentLabel = (submission: { is_active?: boolean; expires_at?: string | null }) =>
    isAssignmentPastDue(submission)
      ? "Past due — not submitted"
      : `Expires: ${formatTimeRemaining(submission.expires_at ?? "")}`

  const normalizeCode = (code: string): string => {
    return code
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n")
      .replace(/\s+/g, " ")
      .trim()
  }

  const isDefaultTemplate = (submittedCode: string): boolean => {
    if (!submittedCode || !submittedCode.trim()) {
      return true
    }

    const removeComments = (code: string): string => {
      return code
        .replace(/\/\/.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .trim()
    }

    const codeWithoutComments = removeComments(submittedCode)
    const templateWithoutComments = removeComments(DEFAULT_CODE)

    const normalizedSubmitted = normalizeCode(codeWithoutComments)
    const normalizedTemplate = normalizeCode(templateWithoutComments)

    if (normalizedSubmitted === normalizedTemplate) {
      return true
    }

    const templateKeywords = [
      "#include <iostream>",
      "using namespace std",
      "int main()",
      "int main(void)",
      "return 0",
      "return0",
      "{",
      "}",
    ]

    const lines = codeWithoutComments
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    const nonTemplateLines = lines.filter((line) => {
      const lowerLine = line.toLowerCase().replace(/\s+/g, "")

      if (lowerLine === "" || lowerLine === "{" || lowerLine === "}") {
        return false
      }

      const isTemplateLine = templateKeywords.some((keyword) => {
        const normalizedKeyword = keyword.toLowerCase().replace(/\s+/g, "")
        return lowerLine === normalizedKeyword || (lowerLine.includes(normalizedKeyword) && lowerLine.length <= normalizedKeyword.length + 2)
      })

      return !isTemplateLine
    })

    if (nonTemplateLines.length < 1) {
      return true
    }

    const meaningfulCode = nonTemplateLines.join(" ").trim()
    if (meaningfulCode.length < 15) {
      return true
    }

    const executablePatterns = [
      /cout/i,
      /cin/i,
      /printf/i,
      /scanf/i,
      /if\s*\(/i,
      /for\s*\(/i,
      /while\s*\(/i,
      /=\s*[^=]/,
      /\+|\-|\*|\//,
      /<<|>>/,
      /[a-zA-Z_][a-zA-Z0-9_]*\s*\(/,
    ]

    const hasExecutableCode = executablePatterns.some((pattern) => pattern.test(meaningfulCode))

    if (hasExecutableCode) {
      return false
    }

    return false
  }

  const handleCodeSubmit = async () => {
    if (!code || code.trim().length < 10) {
      toast({
        title: "Invalid Code",
        description: "Please write some code before submitting",
        variant: "destructive",
      })
      return
    }

    if (isDefaultTemplate(code)) {
      setShowTemplateModal(true)
      return
    }

    if (!selectedSubmissionId) {
      toast({
        title: "Assignment Required",
        description: "Please select an assignment from the dropdown",
        variant: "destructive",
      })
      return
    }

    const selectedSubmission = availableSubmissions.find((s) => s.id.toString() === selectedSubmissionId)
    if (selectedSubmission?.attempted) {
      toast({
        title: "Already Submitted",
        description: "You have already submitted code for this assignment",
        variant: "destructive",
      })
      return
    }

    if (selectedSubmission && new Date(selectedSubmission.expires_at) < new Date()) {
      toast({
        title: "Deadline passed — submission closed",
        description:
          "This assignment's deadline has passed. Unsaved code in the editor was not submitted. Contact your instructor if you need an extension.",
        variant: "destructive",
        duration: 12000,
      })
      return
    }

    setIsSubmitting(true)
    setSubmissionSuccess(false)

    try {
      const response = await studentApiFetch("/api/classroom-points/submit-code", {
        method: "POST",
        headers: { ...getStudentAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          studentId,
          description: description.trim() || undefined,
          submissionId: parseInt(selectedSubmissionId),
          plotImage: plotImage || undefined,
        }),
      })

      if (!response.ok) {
        let errorData
        try {
          const text = await response.text()
          errorData = text ? JSON.parse(text) : { error: `HTTP ${response.status}: ${response.statusText}` }
        } catch (parseError) {
          errorData = { error: `HTTP ${response.status}: ${response.statusText || "Unknown error"}` }
        }

        toast({
          title: "Submission Failed",
          description: errorData.error || `Failed to submit code (${response.status}). Please try again.`,
          variant: "destructive",
        })
        return
      }

      const data = await response.json()

      if (data.success) {
        setSubmissionSuccess(true)
        setCode(DEFAULT_CODE)
        setPlotImage(null)
        setDescription("")
        setSelectedSubmissionId("")
        setSelectedMissingId("")
        setSelectedPendingId("")
        setSuccessModalData({
          pointBooster: data.pointBooster ?? 1,
          pointsAwarded: data.pointsAwarded ?? 2.5,
          boosterLabel: data.boosterLabel ?? "x1",
          autoApproved: data.autoApproved ?? false,
          instructorFeedback: data.instructorFeedback ?? null,
        })
        setShowSuccessModal(true)

        await fetchSubmissions()
      } else {
        toast({
          title: "Submission Failed",
          description: data.error || "Failed to submit code",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[ClassroomPointsV2] Error submitting code:", error)
      toast({
        title: "Error",
        description: "Failed to submit code. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
      setTimeout(() => setSubmissionSuccess(false), 3000)
    }
  }

  const maxClassroomPoints = pointsForFullGrade
  const classroomGradePoints = classroomRawPointsToGradePoints10(totalPoints, pointsForFullGrade).toFixed(1)

  const totalPages = Math.ceil(points.length / pointsPerPage)
  const startIndex = (pointsHistoryPage - 1) * pointsPerPage
  const endIndex = startIndex + pointsPerPage
  const paginatedPoints = points.slice(startIndex, endIndex)

  useEffect(() => {
    if (browseView === "code") setShowCodeSubmission(true)
    if (browseView === "solutions") setShowSolutionSubmission(true)
    if (browseView === "history" && points.length > 0) {
      setSelectedHistoryId((prev) =>
        prev != null && points.some((p) => p.id === prev) ? prev : points[0].id,
      )
    }
  }, [browseView, points])

  const selectedHistoryPoint =
    selectedHistoryId != null ? points.find((p) => p.id === selectedHistoryId) ?? null : null

  const podiumEntries = useMemo(
    () =>
      buildPortalPodiumEntries(
        leaderboard.slice(0, 3).map((e) => ({
          ...e,
          score: Number(e.total_points) || 0,
        })),
        (row, rank) => {
          const isMe = Boolean(row.is_current_user || row.student_id === studentId)
          const hidePeer = blurLeaderboardPeers && !isMe
          return {
            rank,
            primaryLabel: hidePeer
              ? "Student"
              : row.full_name || (isMe ? "You" : "Student"),
            secondaryLabel: hidePeer
              ? "Details hidden"
              : `Section ${row.session} · ${row.award_count} awards${isMe ? " · You" : ""}`,
            score: Number(row.total_points) || 0,
            scoreUnit: "pts",
          }
        },
      ),
    [leaderboard, studentId, blurLeaderboardPeers],
  )

  const classroomMenuItems = useMemo(() => {
    const items = [
      { id: "overview" as const, label: "Overview", icon: LayoutDashboard },
      ...(showCodeAssignmentsBlock
        ? [
            {
              id: "code" as const,
              label: "Code assignments",
              icon: Code,
              badge:
                codeAvailableSubmissions.length +
                  missingSubmissions.filter((s) => !isSolutionAssignment(s)).length || undefined,
            },
          ]
        : []),
      ...(showSolutionAssignmentsBlock
        ? [
            {
              id: "solutions" as const,
              label: "Solution assignments",
              icon: PenLine,
              badge: solutionAvailableSubmissions.length + solutionMissingSubmissions.length || undefined,
            },
          ]
        : []),
      {
        id: "history" as const,
        label: "Points history",
        icon: Award,
        badge: points.length || undefined,
      },
      { id: "leaderboard" as const, label: "Leaderboard", icon: Trophy },
    ]
    return items
  }, [
    showCodeAssignmentsBlock,
    showSolutionAssignmentsBlock,
    codeAvailableSubmissions.length,
    missingSubmissions,
    solutionAvailableSubmissions.length,
    solutionMissingSubmissions.length,
    points.length,
  ])

  if (loading && !embedInDashboard) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className={cn("animate-spin rounded-full h-10 w-10 border-2 border-[var(--border)]", studentModuleSpinnerClass("classroom-points"))} />
      </div>
    )
  }

  const hubMetaLine = loading ? (
    <span className="inline-block h-4 w-52 animate-pulse rounded bg-[var(--muted)]" />
  ) : (
    <>
      {totalPoints} pts · {classroomGradePoints}/10 grade
      {myRank != null ? ` · rank #${myRank}` : ""}
      {session ? ` · section ${session}` : ""}
    </>
  )

  const pointsPanel = (
    <div className="min-w-0 space-y-4 sm:space-y-5">
      {browseView === "overview" ? (
        <ClassroomPointsOverviewPanel
          totalPoints={totalPoints}
          maxPoints={maxClassroomPoints}
          awardCount={awardCount}
          myRank={myRank}
          gradePoints={classroomGradePoints}
          points={points}
          leaderboard={leaderboard.map((e) => ({
            rank: e.rank,
            student_id: e.student_id,
            total_points: Number(e.total_points),
          }))}
          studentId={studentId}
          openCodeCount={
            codeAvailableSubmissions.length +
            missingSubmissions.filter((s) => !isSolutionAssignment(s)).length
          }
          openSolutionsCount={solutionAvailableSubmissions.length + solutionMissingSubmissions.length}
          pendingReviewCount={pendingSubmissions.length}
          cardVariant={cardVariant}
          onNavigate={setBrowseView}
        />
      ) : null}

      {/* Code assignments */}
      {browseView === "code" && showCodeAssignmentsBlock ? (
      <CardWrapper variant={cardVariant} delay={0.25}>
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2.5 sm:p-3 rounded-xl bg-[var(--cc-accent-soft)] border border-[var(--cc-accent-border)] shrink-0">
                <Code className="h-5 w-5 sm:h-6 sm:w-6 text-[var(--cc-accent-dark)]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg sm:text-xl font-semibold text-[var(--cc-text)]">Code Assignments</h3>
                <p className="text-xs sm:text-sm text-[var(--cc-text-muted)] mt-0.5">
                  Submit programming assignments from CodeBench or the editor below
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => setShowCodeSubmission(!showCodeSubmission)}
              className={outlineBtn}
            >
              {showCodeSubmission ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-2" />
                  Hide
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Show
                </>
              )}
            </Button>
          </div>

          <AnimatePresence>
            {showCodeSubmission && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Instructions */}
                <Alert className="bg-[var(--muted)] border border-[var(--border)]">
                  <Lightbulb className="h-5 w-5 text-[var(--cc-accent-dark)]" />
                  <AlertDescription className="text-sm text-[var(--cc-text)]">
                    <div className="space-y-2">
                      <p className="font-semibold text-[var(--cc-text)]">
                        How Code Assignments Work:
                      </p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Select an assignment from the dropdown below</li>
                        <li>Write your code solution in the editor</li>
                        <li>
                          If the assignment asks for a plot or figure, upload a screenshot below (optional for other
                          assignments)
                        </li>
                        <li>Submit for instructor review</li>
                        <li>
                          <strong className="text-[var(--cc-accent-dark)]">
                            Each submission is worth 2.5 points
                          </strong>{" "}
                          (default) - your instructor may adjust this
                        </li>
                        <li>
                          You can only submit <strong>once per assignment</strong>
                        </li>
                        <li>
                          <strong>Assignments have limited time</strong> - check the expiration time shown for each assignment
                        </li>
                        <li>Your code will be reviewed and points will be awarded after approval</li>
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>

                {/* Assignment Selects */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                  {/* Available Assignments */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-[var(--cc-text)] flex items-center gap-2">
                      <div className="p-1 rounded bg-[var(--cc-accent-soft)]">
                        <FileCode className="h-4 w-4 text-[var(--cc-accent-dark)]" />
                      </div>
                      Assignment <span className="text-red-500 font-bold">*</span>
                    </label>
                    <Select
                      value={selectedSubmissionId}
                      onValueChange={(value) => {
                        setSelectedSubmissionId(value)
                        setSelectedMissingId("")
                        setSelectedPendingId("")
                        clearCodeNotice()
                        markChannelSubmittable("code", Number.parseInt(value, 10))
                        const selected = availableSubmissions.find((s) => s.id.toString() === value)
                        setDescription(selected?.title || "")
                      }}
                    >
                      <SelectTrigger className="w-full rounded-2xl min-h-[44px] touch-manipulation">
                        <SelectValue placeholder="Select an assignment..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {availableSubmissions.length === 0 ? (
                          <SelectItem value="none" disabled>
                            No active assignments
                          </SelectItem>
                        ) : (
                          availableSubmissions
                            .filter((submission) => {
                              if (isSolutionAssignment(submission)) return false
                              const isExpired = new Date(submission.expires_at) < new Date()
                              const isAttempted = submission.attempted
                              return !isExpired && !isAttempted
                            })
                            .map((submission) => (
                              <SelectItem key={submission.id} value={submission.id.toString()}>
                                <div className="flex flex-col">
                                  <span>{submission.title}</span>
                                  <span className="text-xs text-[var(--cc-text-muted)]">Expires: {formatTimeRemaining(submission.expires_at)}</span>
                                </div>
                              </SelectItem>
                            ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Pending Submissions */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-[var(--cc-text)] flex items-center gap-2">
                      <div className="p-1 rounded bg-amber-500/10 dark:bg-amber-500/15">
                        <FileCode className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      Pending Submissions
                    </label>
                    <Select
                      value={selectedPendingId}
                      onValueChange={(value) => {
                        setSelectedPendingId(value)
                        setSelectedSubmissionId("")
                        setSelectedMissingId("")
                        const selected = pendingSubmissions.find((s) => s.id.toString() === value)
                        setDescription(selected?.title || "")
                      }}
                    >
                      <SelectTrigger className="w-full rounded-2xl min-h-[44px] touch-manipulation">
                        <SelectValue placeholder="Awaiting review..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {pendingSubmissions.length === 0 ? (
                          <SelectItem value="none" disabled>
                            No pending submissions
                          </SelectItem>
                        ) : (
                          pendingSubmissions.map((submission) => (
                              <SelectItem key={submission.id} value={submission.id.toString()}>
                                <div className="flex flex-col">
                                  <span>{submission.title}</span>
                                  <span className="text-xs text-[var(--cc-text-muted)]">
                                    {submission.is_active === false || new Date(submission.expires_at) <= new Date()
                                      ? "Closed — awaiting review"
                                      : `Expires: ${formatTimeRemaining(submission.expires_at)}`}
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Missing Submissions */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-[var(--cc-text)] flex items-center gap-2">
                      <div className="p-1 rounded bg-red-500/10 dark:bg-red-500/15">
                        <FileCode className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </div>
                      Missing Submissions
                    </label>
                    <Select
                      value={selectedMissingId}
                      onValueChange={(value) => {
                        setSelectedMissingId(value)
                        setSelectedSubmissionId("")
                        setSelectedPendingId("")
                        clearCodeNotice()
                        const selected = missingSubmissions.find((s) => s.id.toString() === value)
                        setDescription(selected?.title || "")
                      }}
                    >
                      <SelectTrigger className="w-full rounded-2xl min-h-[44px] touch-manipulation">
                        <SelectValue placeholder="Not submitted..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {missingSubmissions.length === 0 ? (
                          <SelectItem value="none" disabled>
                            All assignments submitted
                          </SelectItem>
                        ) : (
                          missingSubmissions.map((submission) => (
                              <SelectItem key={submission.id} value={submission.id.toString()}>
                                <div className="flex flex-col">
                                  <span>{submission.title}</span>
                                  <span className="text-xs text-[var(--cc-text-muted)]">
                                    {formatMissingAssignmentLabel(submission)}
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <ClassroomAssignmentAccessNotice notice={effectiveCodeNotice} />

                {(selectedSubmissionId || selectedMissingId || selectedPendingId) && (() => {
                  const selectedSubmission =
                    availableSubmissions.find((s) => s.id.toString() === (selectedSubmissionId || selectedMissingId)) ||
                    pendingSubmissions.find((s) => s.id.toString() === selectedPendingId) ||
                    missingSubmissions.find((s) => s.id.toString() === selectedMissingId)
                  return (
                    <>
                      <div className="p-3 bg-[var(--cc-accent-soft)] border border-[var(--cc-accent-border)]">
                        <p className="text-xs sm:text-sm text-[var(--cc-text)] break-words">
                          <span className="font-semibold text-[var(--cc-text)]">Selected:</span> {description}
                          {selectedCodeIsPending || selectedPendingId ? (
                            <span className="ml-1 sm:ml-2 text-amber-600 dark:text-amber-500 font-medium block sm:inline">
                              (Pending Review)
                            </span>
                          ) : null}
                          {selectedMissingId && !selectedCodeIsPending ? (
                            <span className="ml-1 sm:ml-2 text-red-600 dark:text-red-500 font-medium block sm:inline">(Not Submitted)</span>
                          ) : null}
                        </p>
                        {selectedCodeIsPending || selectedPendingId ? (() => {
                          const pending = pendingSubmissions.find(
                            (s) =>
                              s.id.toString() === (selectedPendingId || effectiveCodeAssignmentId),
                          )
                          const feedback = pending?.classroomPoint?.instructorFeedback
                          const pendingBooster = pending?.classroomPoint?.pointBooster
                          const pendingPoints = pending?.classroomPoint?.points
                          return (
                            <div className="mt-3 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <ClassroomProvisionalScoreBadge />
                                {pendingPoints != null ? (
                                  <ClassroomPointBoosterBadge
                                    points={resolveClassroomDisplayPoints(pendingPoints, pendingBooster)}
                                    pointBooster={pendingBooster ?? 1}
                                  />
                                ) : null}
                              </div>
                              <p className="text-[11px] text-amber-800/90 dark:text-amber-200/90">
                                AI score is provisional. Your instructor will confirm final points.
                              </p>
                              {feedback ? (
                                <div className="rounded-xl border border-[var(--cc-accent-border)] bg-[var(--card)] p-3">
                                  <p className="text-xs font-semibold text-[var(--cc-accent-dark)] mb-1">AI feedback on your submission</p>
                                  <AiFeedbackMarkdown
                                    text={feedback}
                                    className="text-xs sm:text-sm text-[var(--cc-text)] leading-relaxed break-words [&_.prose]:text-xs sm:[&_.prose]:text-sm"
                                  />
                                </div>
                              ) : null}
                            </div>
                          )
                        })() : null}
                      </div>

                      {selectedSubmission?.description && (
                        <div className="p-4 bg-[var(--muted)] rounded-xl border border-[var(--border)]">
                          <div className="flex items-start gap-3">
                            <FileCode className="h-5 w-5 text-[var(--cc-accent-dark)] mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <h4 className="font-semibold text-[var(--cc-text)] mb-2">Assignment Description:</h4>
                              <div className="text-sm text-[var(--cc-text)] leading-relaxed [&_.prose]:text-sm">
                                <QuestionTextRenderer text={selectedSubmission.description} />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}

                {/* Plot upload — visible whenever panel is open (not hidden below the editor) */}
                <div className="space-y-3 rounded-2xl border-2 border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)] p-4 sm:p-5">
                  {(() => {
                    const sel =
                      selectedSubmissionId || selectedMissingId || selectedPendingId
                        ? availableSubmissions.find((s) => s.id.toString() === (selectedSubmissionId || selectedMissingId)) ||
                          pendingSubmissions.find((s) => s.id.toString() === selectedPendingId) ||
                          missingSubmissions.find((s) => s.id.toString() === selectedMissingId)
                        : null
                    const suggestPlot = sel ? assignmentSuggestsPlot(sel.title || "", sel.description || "") : false
                    return (
                      <>
                        {!sel && (
                          <p className="text-xs text-[var(--cc-text-muted)]">
                            <strong className="text-[var(--cc-text)]">Plot with your code:</strong> Select an
                            assignment above, then attach a screenshot when the task asks for a figure (same as code +
                            plot on quizzes).
                          </p>
                        )}
                        {suggestPlot && !plotImage && (
                          <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/20">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-sm text-amber-900 dark:text-amber-100">
                              This assignment looks like it expects a <strong>plot or figure</strong>. Upload a screenshot
                              of your figure so your instructor can review it with your code.
                            </AlertDescription>
                          </Alert>
                        )}
                      </>
                    )
                  })()}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-[var(--cc-text)] flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-[var(--cc-accent-dark)] shrink-0" />
                      Upload plot or figure (optional unless the assignment requires it)
                    </label>
                    <p className="text-xs text-[var(--cc-text-muted)]">
                      PNG or JPEG, max 5MB. Stored with your code for instructor review.
                    </p>
                    <PlotUpload
                      variant="classroom"
                      uploadedImage={plotImage}
                      onUpload={(_file, base64) => setPlotImage(base64)}
                      onRemove={() => setPlotImage(null)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Code Editor */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[var(--cc-text)] flex items-center gap-2">
                    <Code className="h-4 w-4 text-[var(--cc-accent-dark)] shrink-0" />
                    Your Solution Code
                  </label>
                  <div className="border-2 border-[var(--border)] rounded-2xl overflow-hidden shadow-sm hover:border-[var(--cc-accent-border)] transition-colors min-h-[280px] sm:min-h-[350px]">
                    <MonacoEditor
                      height="clamp(280px, 60vh, 450px)"
                      language="cpp"
                      value={code}
                      onChange={(value) => setCode(value || "")}
                      theme="vs-dark"
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                        lineNumbers: "on",
                        wordWrap: "on",
                        bracketPairColorization: { enabled: true },
                        cursorBlinking: "smooth",
                        padding: { top: 16, bottom: 16 },
                      }}
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  onClick={handleCodeSubmit}
                  disabled={isSubmitting || !code.trim() || code.trim().length < 10}
                  variant="ghost"
                  className={cn("w-full rounded-xl font-semibold py-6 sm:py-7 text-base sm:text-lg min-h-[48px] sm:min-h-[52px] touch-manipulation disabled:opacity-60 disabled:cursor-not-allowed", PORTAL_CTA)}
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Submitting Code...
                    </>
                  ) : submissionSuccess ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Code Submitted Successfully!
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5 mr-2" />
                      Submit Assignment
                    </>
                  )}
                </Button>

                <Alert className="bg-[var(--muted)] border border-[var(--border)]">
                  <Sparkles className="h-5 w-5 text-[var(--cc-accent-dark)]" />
                  <AlertDescription className="text-sm text-[var(--cc-text)]">
                    Your code will be reviewed by your instructor. Points will be awarded after grading and approval.
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardWrapper>
      ) : null}

      {/* Solution assignments (worked solutions — circuits, problem sets) */}
      {browseView === "solutions" && showSolutionAssignmentsBlock ? (
      <CardWrapper variant={cardVariant} delay={0.28}>
          <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2.5 sm:p-3 rounded-xl bg-[var(--cc-accent-soft)] border border-[var(--cc-accent-border)] shrink-0">
                  <PenLine className="h-5 w-5 sm:h-6 sm:w-6 text-[var(--cc-accent-dark)]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-semibold text-[var(--cc-text)]">
                    Solution Assignments
                  </h3>
                  <p className="text-xs sm:text-sm text-[var(--cc-text-muted)] mt-0.5">
                    Upload PDF or photos, or use the ink workspace — same as circuit homework submissions
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={() => setShowSolutionSubmission(!showSolutionSubmission)}
                className={outlineBtn}
              >
                {showSolutionSubmission ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-2" />
                    Hide
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Show
                  </>
                )}
              </Button>
            </div>

            <AnimatePresence>
              {showSolutionSubmission ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <Alert className="bg-[var(--muted)] border border-[var(--border)]">
                    <Lightbulb className="h-5 w-5 text-[var(--cc-accent-dark)]" />
                    <AlertDescription className="text-sm text-[var(--cc-text)]">
                      <div className="space-y-2">
                        <p className="font-semibold text-[var(--cc-text)]">
                          How Solution Assignments Work:
                        </p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>Select an assignment from the dropdown below</li>
                          <li>Upload PDF or photos of your worked solution, or draw in the ink workspace</li>
                          <li>Submit for instructor review</li>
                          <li>
                            <strong className="text-[var(--cc-accent-dark)]">
                              Each submission is worth 2.5 points
                            </strong>{" "}
                            (default) - your instructor may adjust this
                          </li>
                          <li>
                            You can only submit <strong>once per assignment</strong>
                          </li>
                          <li>
                            <strong>Assignments have limited time</strong> - check the expiration time shown for each
                            assignment
                          </li>
                          <li>Your work will be reviewed and points will be awarded after approval</li>
                        </ul>
                      </div>
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-[var(--cc-text)] flex items-center gap-2">
                        <div className="p-1 rounded bg-[var(--cc-accent-soft)]">
                          <PenLine className="h-4 w-4 text-[var(--cc-accent-dark)]" />
                        </div>
                        Assignment <span className="text-red-500 font-bold">*</span>
                      </label>
                      <Select
                        value={selectedSolutionSubmissionId}
                        onValueChange={(value) => {
                          setSelectedSolutionSubmissionId(value)
                          setSelectedSolutionMissingId("")
                          setSelectedSolutionPendingId("")
                          clearSolutionNotice()
                          markChannelSubmittable("solution", Number.parseInt(value, 10))
                          const selected = solutionAvailableSubmissions.find((s) => s.id.toString() === value)
                          setSolutionDescription(selected?.title || "")
                        }}
                      >
                        <SelectTrigger className="w-full rounded-2xl min-h-[44px] touch-manipulation">
                          <SelectValue placeholder="Select an assignment..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          {solutionAvailableSubmissions.length === 0 ? (
                            <SelectItem value="none" disabled>
                              No active assignments
                            </SelectItem>
                          ) : (
                            solutionAvailableSubmissions
                              .filter((submission) => {
                                const isExpired = new Date(submission.expires_at) < new Date()
                                const isAttempted = submission.attempted
                                return !isExpired && !isAttempted
                              })
                              .map((submission) => (
                                <SelectItem key={submission.id} value={submission.id.toString()}>
                                  <div className="flex flex-col">
                                    <span>{submission.title}</span>
                                    <span className="text-xs text-[var(--cc-text-muted)]">
                                      Expires: {formatTimeRemaining(submission.expires_at)}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-[var(--cc-text)] flex items-center gap-2">
                        <div className="p-1 rounded bg-amber-500/10 dark:bg-amber-500/15">
                          <PenLine className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        Pending Submissions
                      </label>
                      <Select
                        value={selectedSolutionPendingId}
                        onValueChange={(value) => {
                          setSelectedSolutionPendingId(value)
                          setSelectedSolutionSubmissionId("")
                          setSelectedSolutionMissingId("")
                          const selected = solutionPendingSubmissions.find((s) => s.id.toString() === value)
                          setSolutionDescription(selected?.title || "")
                        }}
                      >
                        <SelectTrigger className="w-full rounded-2xl min-h-[44px] touch-manipulation">
                          <SelectValue placeholder="Awaiting review..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          {solutionPendingSubmissions.length === 0 ? (
                            <SelectItem value="none" disabled>
                              No pending submissions
                            </SelectItem>
                          ) : (
                            solutionPendingSubmissions.map((submission) => (
                                <SelectItem key={submission.id} value={submission.id.toString()}>
                                  <div className="flex flex-col">
                                    <span>{submission.title}</span>
                                    <span className="text-xs text-[var(--cc-text-muted)]">
                                      {submission.is_active === false || new Date(submission.expires_at) <= new Date()
                                        ? "Closed — awaiting review"
                                        : `Expires: ${formatTimeRemaining(submission.expires_at)}`}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-[var(--cc-text)] flex items-center gap-2">
                        <div className="p-1 rounded bg-red-500/10 dark:bg-red-500/15">
                          <PenLine className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                        Missing Submissions
                      </label>
                      <Select
                        value={selectedSolutionMissingId}
                        onValueChange={(value) => {
                          setSelectedSolutionMissingId(value)
                          setSelectedSolutionSubmissionId("")
                          setSelectedSolutionPendingId("")
                          clearSolutionNotice()
                          const selected = solutionMissingSubmissions.find((s) => s.id.toString() === value)
                          setSolutionDescription(selected?.title || "")
                        }}
                      >
                        <SelectTrigger className="w-full rounded-2xl min-h-[44px] touch-manipulation">
                          <SelectValue placeholder="Not submitted..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          {solutionMissingSubmissions.length === 0 ? (
                            <SelectItem value="none" disabled>
                              All assignments submitted
                            </SelectItem>
                          ) : (
                            solutionMissingSubmissions.map((submission) => (
                                <SelectItem key={submission.id} value={submission.id.toString()}>
                                  <div className="flex flex-col">
                                    <span>{submission.title}</span>
                                    <span className="text-xs text-[var(--cc-text-muted)]">
                                      {formatMissingAssignmentLabel(submission)}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <ClassroomAssignmentAccessNotice notice={effectiveSolutionNotice} />

                  {effectiveSolutionAssignmentId ? (
                    <>
                      <div className="p-3 bg-[var(--cc-accent-soft)] border border-[var(--cc-accent-border)]">
                        <p className="text-xs sm:text-sm text-[var(--cc-text)] break-words">
                          <span className="font-semibold text-[var(--cc-text)]">Selected:</span>{" "}
                          {solutionDescription}
                          {selectedSolutionIsPending || selectedSolutionPendingId ? (
                            <span className="ml-1 sm:ml-2 text-amber-600 dark:text-amber-500 font-medium block sm:inline">
                              (Pending Review)
                            </span>
                          ) : null}
                          {selectedSolutionMissingId && !selectedSolutionIsPending ? (
                            <span className="ml-1 sm:ml-2 text-red-600 dark:text-red-500 font-medium block sm:inline">
                              (Not Submitted)
                            </span>
                          ) : null}
                        </p>
                      </div>

                      {selectedSolutionAssignment?.description ? (
                        <div className="p-4 bg-[var(--muted)] rounded-xl border border-[var(--border)]">
                          <div className="flex items-start gap-3">
                            <PenLine className="h-5 w-5 text-[var(--cc-accent-dark)] mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <h4 className="font-semibold text-[var(--cc-text)] mb-2">
                                Assignment Description:
                              </h4>
                              <div className="text-sm text-[var(--cc-text)] leading-relaxed [&_.prose]:text-sm">
                                <QuestionTextRenderer text={selectedSolutionAssignment.description} />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {selectedSolutionIsPending || selectedSolutionPendingId ? (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <ClassroomProvisionalScoreBadge />
                            {selectedSolutionAssignment?.classroomPoint?.points != null ? (
                              <ClassroomPointBoosterBadge
                                points={resolveClassroomDisplayPoints(
                                  selectedSolutionAssignment.classroomPoint.points,
                                  selectedSolutionAssignment.classroomPoint.pointBooster,
                                )}
                                pointBooster={selectedSolutionAssignment.classroomPoint.pointBooster ?? 1}
                              />
                            ) : null}
                          </div>
                          <Alert className="bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-sm text-amber-900 dark:text-amber-100">
                              This assignment is awaiting instructor review. You cannot submit again until it has been
                              graded.
                            </AlertDescription>
                          </Alert>
                          {selectedSolutionAssignment?.classroomPoint?.instructorFeedback ? (
                            <div className="rounded-xl border border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)] p-3">
                              <p className="text-xs font-semibold text-[var(--cc-accent-dark)] mb-1">
                                AI feedback on your submission
                              </p>
                              <AiFeedbackMarkdown
                                text={selectedSolutionAssignment.classroomPoint.instructorFeedback}
                                className="text-xs sm:text-sm text-[var(--cc-text)] leading-relaxed break-words [&_.prose]:text-xs sm:[&_.prose]:text-sm"
                              />
                            </div>
                          ) : null}
                        </>
                      ) : null}

                      {selectedSolutionConfig &&
                      !selectedSolutionIsPending &&
                      !selectedSolutionPendingId &&
                      !isAssignmentPastDue(selectedSolutionAssignment ?? {}) ? (
                        <ClassroomSolutionSubmissionPanel
                          assignmentId={Number.parseInt(
                            selectedSolutionSubmissionId || selectedSolutionMissingId,
                            10,
                          )}
                          studentId={studentId}
                          studentDatabaseId={studentId}
                          questionConfig={selectedSolutionConfig}
                          onSubmitted={() => {
                            setSelectedSolutionSubmissionId("")
                            setSelectedSolutionPendingId("")
                            setSelectedSolutionMissingId("")
                            setSolutionDescription("")
                            void fetchSubmissions()
                            void fetchData(false)
                          }}
                        />
                      ) : null}
                    </>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </CardWrapper>
      ) : null}

      {/* Points History */}
      {browseView === "history" ? (
      <div className="space-y-4 sm:space-y-5 px-1 sm:px-2 lg:px-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-0.5">
          <div className="min-w-0">
            <h3 className={cn("text-lg sm:text-xl font-semibold", PORTAL_TEXT)}>Points history</h3>
            <p className={cn("text-xs sm:text-sm", PORTAL_TEXT_MUTED)}>Recent points you've earned</p>
          </div>
          {session && (
            <Badge variant="outline" className="text-xs sm:text-sm border-[var(--border)] text-[var(--cc-text-muted)] w-fit self-start sm:self-auto">
              Section {session}
            </Badge>
          )}
        </div>

        {points.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex p-4 rounded-full bg-[var(--cc-accent-soft)] mb-4">
              <Gift className="h-8 w-8 text-[var(--cc-accent-dark)]" />
            </div>
            <p className="text-[var(--cc-text-muted)] font-medium">
              No points awarded yet. Keep participating in class to earn points!
            </p>
          </div>
        ) : (
          <>
            <div className={cn(signatureListStyles.list, "rounded-2xl border border-[var(--border)] bg-[var(--muted)]/15 p-3 sm:p-4")}>
              {paginatedPoints.map((point, idx) => {
                const categoryInfo = CATEGORY_LABELS[point.category] || CATEGORY_LABELS.other
                const displayPts =
                  point.category === "code_submission" || point.category === "solution_submission"
                    ? resolveClassroomDisplayPoints(
                        Number(point.points) || 0,
                        Math.max(1, Number(point.point_booster) || 1),
                      )
                    : Number(point.points) || 0
                const provisional = classroomPointIsProvisional(point)
                const absoluteIdx = startIndex + idx
                return (
                  <SignatureListCard
                    key={point.id}
                    title={classroomPointHistoryTitle(point)}
                    subtitle={categoryInfo.label}
                    meta={new Date(point.awarded_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    trailingValue={`+${Number(displayPts).toFixed(1)}`}
                    statusLabel={provisional ? "Provisional" : undefined}
                    statusPositive={!provisional}
                    icon={categoryInfo.lucide}
                    thumb={solidListThumb(absoluteIdx)}
                    onClick={() => setSelectedHistoryId(point.id)}
                    className={cn(
                      selectedHistoryId === point.id && "ring-2 ring-[var(--cc-accent)] border-[var(--cc-accent-border)]",
                    )}
                  />
                )
              })}
            </div>

            {selectedHistoryPoint ? (
              <ClassroomPointHistoryCard
                point={selectedHistoryPoint}
                categoryInfo={CATEGORY_LABELS[selectedHistoryPoint.category] || CATEGORY_LABELS.other}
                animationDelay={0}
                embedInDashboard={embedInDashboard}
              />
            ) : (
              <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Select an award to view details.</p>
            )}

            {points.length > pointsPerPage && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-[var(--border)]">
                <div className="text-xs sm:text-sm text-[var(--cc-text-muted)] text-center sm:text-left">
                  Showing {startIndex + 1}-{Math.min(endIndex, points.length)} of {points.length} points
                </div>
                <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPointsHistoryPage((prev) => Math.max(1, prev - 1))}
                    disabled={pointsHistoryPage === 1}
                    className={cn("gap-1 rounded-xl min-h-[44px] touch-manipulation", PORTAL_OUTLINE_BTN)}
                  >
                    <ChevronLeft className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">Previous</span>
                    <span className="sm:hidden">Prev</span>
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNum
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (pointsHistoryPage <= 3) {
                        pageNum = i + 1
                      } else if (pointsHistoryPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = pointsHistoryPage - 2 + i
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant="ghost"
                          size="sm"
                          onClick={() => setPointsHistoryPage(pageNum)}
                          className={cn(
                            "min-w-[2.5rem] min-h-[44px] rounded-xl touch-manipulation",
                            pointsHistoryPage === pageNum ? PORTAL_CTA : PORTAL_OUTLINE_BTN,
                          )}
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPointsHistoryPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={pointsHistoryPage === totalPages}
                    className={cn("gap-1 rounded-xl min-h-[44px] touch-manipulation", PORTAL_OUTLINE_BTN)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      ) : null}

      {/* Leaderboard */}
      {browseView === "leaderboard" ? (
      <CardWrapper variant={cardVariant} delay={0.35}>
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-[var(--cc-accent-soft)] shrink-0">
                <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-[var(--cc-accent-dark)]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg sm:text-xl font-semibold text-[var(--cc-text)]">
                  {session ? `Section ${session} Leaderboard` : "Class Leaderboard"}
                </h3>
                <p className="text-xs sm:text-sm text-[var(--cc-text-muted)]">
                  {blurLeaderboardPeers
                    ? session
                      ? `Your rank in section ${session} — other students hidden for privacy`
                      : "Your rank — other students hidden for privacy"
                    : session
                      ? `Section ${session} rankings — names and points visible to the class`
                      : "Class rankings — names and points visible to the class"}
                </p>
              </div>
            </div>
            {session && (
              <Badge variant="outline" className={cn("text-xs sm:text-sm w-fit self-start sm:self-auto", pageTheme.border, pageTheme.softBg, pageTheme.iconText)}>
                Section {session}
              </Badge>
            )}
          </div>

          {leaderboard.length === 0 ? (
            <p className="text-sm text-[var(--cc-text-muted)] text-center py-10">
              Rankings appear once classmates start earning classroom points this term.
            </p>
          ) : podiumEntries.length > 0 ? (
            <PortalLeaderboardPodium
              entries={podiumEntries}
              heading={session ? `Section ${session} podium` : "Class podium"}
              className="mb-5 sm:mb-6"
            />
          ) : null}

          <div className="space-y-3">
            {leaderboard.slice(0, 10).map((entry, idx) => {
              const isMe = entry.is_current_user || entry.student_id === studentId
              const isTopThree = entry.rank <= 3
              return (
                <motion.div
                  key={`rank-${entry.rank}-${idx}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "p-5 rounded-xl border transition-all",
                    isMe
                      ? cn("ring-2 ring-[var(--cc-accent-border)]", pageTheme.softBg, pageTheme.border)
                      : cn(PORTAL_CARD, "hover:shadow-md"),
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                      <div
                        className={cn(
                          "w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-bold text-base sm:text-lg shrink-0",
                          entry.rank === 1
                            ? "bg-amber-500 dark:bg-amber-600 text-amber-950 dark:text-white"
                            : entry.rank === 2
                              ? "bg-slate-400 dark:bg-slate-500 text-white"
                              : entry.rank === 3
                                ? "bg-amber-700 dark:bg-amber-800 text-amber-100"
                                : cn(pageTheme.iconBg, iconAccent)
                        )}
                      >
                        {isTopThree && entry.rank === 1 && <Crown className="h-6 w-6" />}
                        {isTopThree && entry.rank !== 1 && <Medal className="h-6 w-6" />}
                        {!isTopThree && entry.rank}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={cn("font-bold text-base sm:text-lg break-words", isMe ? iconAccent : PORTAL_TEXT)}>
                          {blurLeaderboardPeers && !isMe
                            ? "Student"
                            : entry.full_name || (isMe ? "You" : "Student")}{" "}
                          {isMe && <span className={cn("text-xs sm:text-sm", iconAccent)}>(You)</span>}
                        </p>
                        <p
                          className={cn(
                            "text-xs mt-0.5",
                            PORTAL_TEXT_MUTED,
                            blurLeaderboardPeers && !isMe && "blur-[6px] select-none",
                          )}
                        >
                          {blurLeaderboardPeers && !isMe
                            ? "Details hidden"
                            : `Section ${entry.session} • ${entry.award_count} awards`}
                        </p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                      {isMe || !blurLeaderboardPeers ? (
                      <div className="inline-flex items-center gap-1 sm:gap-1.5 bg-[var(--card)] border border-[var(--border)] px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl shadow-sm">
                        <Star className="h-5 w-5 sm:h-6 sm:w-6 fill-[var(--cc-accent)] text-[var(--cc-accent)] shrink-0" />
                        <span className={cn("text-xl sm:text-2xl font-bold tabular-nums", PORTAL_TEXT)}>{Number(entry.total_points).toFixed(1)}</span>
                      </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 bg-[var(--muted)] px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl blur-[6px] select-none">
                          <span className="text-xl sm:text-2xl font-bold text-[var(--cc-text-muted)]">•••</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </CardWrapper>
      ) : null}
        </div>
  )

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0 overflow-x-hidden">
      {embedInDashboard ? (
        <StudentModuleHubLayout
          moduleId="classroom-points"
          title="Classroom Points"
          metaLine={hubMetaLine}
          metaSuffix="submit assignments and climb the leaderboard"
          menuView={browseView}
          onMenuSelect={(id) => setBrowseView(id as ClassroomPointsBrowseId)}
          menuItems={classroomMenuItems}
          loading={loading}
          loadingRows={8}
        >
          {pointsPanel}
        </StudentModuleHubLayout>
      ) : (
        <FacultyModuleSplitLayout
          className="gap-2 sm:gap-3 lg:min-h-[min(640px,72vh)] lg:gap-4"
          menuWidthClass="lg:w-52"
          menu={
            <ClassroomPointsBrowseNav
              activeId={browseView}
              onSelect={setBrowseView}
              showCode={showCodeAssignmentsBlock}
              showSolutions={showSolutionAssignmentsBlock}
              counts={{
                history: points.length || undefined,
                code:
                  codeAvailableSubmissions.length +
                    missingSubmissions.filter((s) => !isSolutionAssignment(s)).length ||
                  undefined,
                solutions:
                  solutionAvailableSubmissions.length + solutionMissingSubmissions.length || undefined,
              }}
            />
          }
        >
          {pointsPanel}
        </FacultyModuleSplitLayout>
      )}

      {/* Template Warning Modal */}
      <AnimatePresence>
        {showTemplateModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn("z-[200]", CC_MODAL_SCRIM)}
              onClick={() => setShowTemplateModal(false)}
            />
            <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 z-[201] flex items-center justify-center p-4 sm:p-6 pointer-events-none overflow-y-auto"
            >
              <div
                className={cn("rounded-2xl shadow-2xl max-w-md w-full p-4 sm:p-6 md:p-8 border pointer-events-auto my-auto cc-modal-surface", PORTAL_CARD, "border-amber-300/80 dark:border-amber-600/80")}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-amber-500 dark:bg-amber-600 flex items-center justify-center shadow-lg">
                    <AlertTriangle className="h-12 w-12 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-[var(--cc-text)] mb-2">Template Code Detected</h3>
                    <p className="text-base sm:text-lg text-[var(--cc-text-muted)] mb-2">
                      You cannot submit the default template code.
                    </p>
                    <p className="text-sm text-[var(--cc-text-muted)]">
                      Please <strong>edit and write your own code solution</strong> in the editor.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => setShowTemplateModal(false)}
                    className={cn("w-full rounded-2xl shadow-md hover:shadow-lg transition-all min-h-[48px] touch-manipulation", PORTAL_CTA)}
                  >
                    I Understand
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Point Booster Success Modal */}
      <PointBoosterModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false)
          setTimeout(() => {
            fetchData(false)
            fetchSubmissions()
            setPointsHistoryPage(1)
          }, 300)
        }}
        pointBooster={successModalData.pointBooster}
        pointsAwarded={successModalData.pointsAwarded}
        boosterLabel={successModalData.boosterLabel}
        autoApproved={successModalData.autoApproved}
        instructorFeedback={successModalData.instructorFeedback}
      />
    </div>
  )
}
