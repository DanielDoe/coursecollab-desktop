"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useState, useEffect, useMemo, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/components/ui/use-toast"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Gamepad2,
  Play,
  Square,
  Users,
  Trophy,
  BarChart3,
  Settings,
  Search,
  CheckCircle2,
  Clock,
  Target,
  TrendingUp,
  AlertCircle,
  Loader,
  RefreshCw,
  Trash2,
  FileText,
  Plus,
  ArrowLeft,
  X,
  ChevronDown,
  Filter,
  Sparkles,
  ChevronUp,
  ListOrdered,
  Pencil,
  Copy,
  KeyRound,
  RotateCcw,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { stripHtmlToPlain } from "@/lib/direct-messages/html"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { STUDENT_DATA_DELETE_CONFIRM_PHRASE } from "@/lib/student-data-delete-confirm"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers"
import { PlaygroundSessionCard } from "@/components/instructor/playground/playground-session-card"
import { PlaygroundQuestionCard } from "@/components/instructor/playground/playground-question-card"
import { PlaygroundPasscodeBanner } from "@/components/instructor/playground/playground-passcode-banner"
import { InstructorPlaygroundLeaderboardTab } from "@/components/instructor/playground/InstructorPlaygroundLeaderboardTab"
import { InstructorPlaygroundPoliciesPanel } from "@/components/instructor/InstructorPlaygroundPoliciesPanel"
import { InstructorAdminQuickLink } from "@/components/instructor/InstructorPolicySurfaceCard"
import { useInstructorPlaygroundPolicy } from "@/components/instructor/useInstructorPlaygroundPolicy"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import type { PlaygroundPolicy } from "@/lib/playground-policy-settings"
import {
  InstructorPlaygroundPerformanceTab,
  type PerformanceRecentSession,
} from "@/components/instructor/playground/InstructorPlaygroundPerformanceTab"
import { playgroundLeaderboardFingerprint, playgroundLeaderboardShouldPoll } from "@/lib/playground-leaderboard-utils"

interface Question {
  id: number
  questionText: string
  questionType: string
  difficulty: string
  topic: string
  options: any[]
  correctAnswer: any
  hint: string | null
  optionCount: number
}

interface Session {
  id: number
  session_code: string
  mode: string
  duration_sec: number
  is_active: boolean
  game_started?: boolean
  join_passcode?: string | null
  selected_topics: string[] | null
  question_count: number
  current_question_index: number
  created_at: string
  ended_at: string | null
  participant_count: number
  waiting_count?: number
  question_count_actual: number
  allowed_sessions: number[] | null
}

interface PerformanceData {
  resultId: number
  studentId: string
  studentName: string
  displayName: string
  score: number
  questionsAnswered: number
  correctAnswers: number
  accuracyPercentage: number
  completedAt: string
  sessionCode: string
}

interface QuestionStat {
  questionOrder: number
  questionText: string
  questionType: string
  totalAnswers: number
  correctAnswers: number
  avgResponseTimeMs: number
  accuracyPercentage: number
}

interface SessionQuestion {
  id: number
  bankQuestionId: number
  questionOrder: number
  questionText: string
  questionType: string
  difficulty: string
  topic: string
  options: string[]
  correctAnswer: unknown
  explanation: string | null
}

function getSessionDisplayLabel(session: Session): string {
  const topics = session.selected_topics ?? []
  const label = topics.find((t) => t.includes("—") || t.toLowerCase().includes("lecture"))
  return label ?? topics[0] ?? session.session_code
}

function formatQuestionType(type: string): string {
  if (type === "mcq") return "MCQ"
  if (type === "true_false") return "True/False"
  return type.replace(/_/g, " ")
}

type MenuTab = "sessions" | "questions" | "performance" | "leaderboard" | "configuration"

interface LeaderboardSessionMeta {
  id: number
  sessionCode: string
  label: string
  questionCount: number
  isActive: boolean
  gameStarted: boolean
  createdAt: string
}

interface LeaderboardEntry {
  rank: number | null
  resultId: number
  studentId: string
  studentName: string
  displayName: string
  nickname: string | null
  score: number
  questionsAnswered: number
  correctAnswers: number
  accuracyPercentage: number
  completedAt: string | null
  sessionCode: string | null
  sessionsPlayed: number
  status: "waiting" | "playing" | "completed"
}

interface LeaderboardStats {
  totalSessions: number
  uniqueStudents: number
  totalAttempts: number
  activeParticipants: number
  waitingParticipants: number
  avgScore: number
  maxScore: number
  avgAccuracy: number
}

const SESSIONS_PER_PAGE = 6
const QUESTIONS_PER_PAGE = 20

export function InstructorPlaygroundManagement({ embedInDashboard }: { embedInDashboard?: boolean } = {}) {
  const chrome = facultyEmbedChrome("playground")
  const fp = chrome.p
  const cardBase = PORTAL_CARD
  const { toast } = useToast()
  const { courseScopeVersion, setPageBreadcrumbTail } = useInstructorDashboardV2()
  const { policy: playgroundPolicy, loading: playgroundPolicyLoading } = useInstructorPlaygroundPolicy()
  const [activeTab, setActiveTab] = useState<MenuTab>("sessions")
  const [loading, setLoading] = useState(false)

  // Sessions state
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedPerformanceSessionId, setSelectedPerformanceSessionId] = useState<string>("all")
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [clearConfirmPhrase, setClearConfirmPhrase] = useState("")
  const [clearingSessions, setClearingSessions] = useState(false)
  const [sessionsPage, setSessionsPage] = useState(1)
  const [questionsPage, setQuestionsPage] = useState(1)
  const [sessionSearch, setSessionSearch] = useState("")
  const [sessionViewMode, setSessionViewMode] = useState<"grid" | "list">("grid")
  const [openedSessionId, setOpenedSessionId] = useState<number | null>(null)

  const filteredSessions = useMemo(() => {
    const q = sessionSearch.trim().toLowerCase()
    if (!q) return sessions
    return sessions.filter((session) => {
      const label = getSessionDisplayLabel(session).toLowerCase()
      const topics = (session.selected_topics ?? []).join(" ").toLowerCase()
      return session.session_code.toLowerCase().includes(q) || label.includes(q) || topics.includes(q)
    })
  }, [sessions, sessionSearch])

  const openedSession = useMemo(
    () => (openedSessionId == null ? null : sessions.find((session) => session.id === openedSessionId) ?? null),
    [openedSessionId, sessions],
  )

  useEffect(() => {
    if (!embedInDashboard) return
    setPageBreadcrumbTail(
      openedSession && activeTab === "sessions" ? getSessionDisplayLabel(openedSession) : null,
    )
    return () => setPageBreadcrumbTail(null)
  }, [embedInDashboard, openedSession, activeTab, setPageBreadcrumbTail])

  useEffect(() => {
    const closeNested = () => setOpenedSessionId(null)
    window.addEventListener("instructor-breadcrumb-module-home", closeNested)
    return () => window.removeEventListener("instructor-breadcrumb-module-home", closeNested)
  }, [])

  const totalSessionsPages = Math.max(1, Math.ceil(filteredSessions.length / SESSIONS_PER_PAGE))
  const paginatedSessions = useMemo(() => {
    const start = (sessionsPage - 1) * SESSIONS_PER_PAGE
    return filteredSessions.slice(start, start + SESSIONS_PER_PAGE)
  }, [filteredSessions, sessionsPage])

  useEffect(() => {
    if (sessionsPage > totalSessionsPages) {
      setSessionsPage(totalSessionsPages)
    }
  }, [sessionsPage, totalSessionsPages])

  useEffect(() => {
    if (openedSessionId != null && !sessions.some((session) => session.id === openedSessionId)) {
      setOpenedSessionId(null)
    }
  }, [openedSessionId, sessions])

  // Session question editor
  const [editorSession, setEditorSession] = useState<Session | null>(null)
  const [editorQuestions, setEditorQuestions] = useState<SessionQuestion[]>([])
  const [editorDurationSec, setEditorDurationSec] = useState(10)
  const [editorLoading, setEditorLoading] = useState(false)
  const [editorSaving, setEditorSaving] = useState(false)
  const [editorAddSearch, setEditorAddSearch] = useState("")
  const [snapshotEditor, setSnapshotEditor] = useState<SessionQuestion | null>(null)
  const [snapshotDraft, setSnapshotDraft] = useState({
    questionText: "",
    topic: "",
    options: [] as string[],
    correctAnswer: "",
    explanation: "",
  })
  const [snapshotError, setSnapshotError] = useState("")
  const [showDeleteSessionDialog, setShowDeleteSessionDialog] = useState(false)
  const [deleteConfirmPhrase, setDeleteConfirmPhrase] = useState("")
  const [deletingSession, setDeletingSession] = useState(false)

  // Question selection state
  const [questions, setQuestions] = useState<Question[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [availableQuestionTypes, setAvailableQuestionTypes] = useState<string[]>([])
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([])
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<string[]>(["mcq", "true_false"])
  const [questionCount, setQuestionCount] = useState(10)
  const [durationSec, setDurationSec] = useState(10)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all")
  const [questionTypePopoverOpen, setQuestionTypePopoverOpen] = useState(false)
  
  // Class session access state
  const [availableClassSessions, setAvailableClassSessions] = useState<Array<{id: number, code: string, description: string}>>([])
  const [selectedClassSessions, setSelectedClassSessions] = useState<number[]>([]) // Array of session IDs

  // Performance state
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([])
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
  const [overallStats, setOverallStats] = useState<any>(null)
  const [recentPerformanceSessions, setRecentPerformanceSessions] = useState<PerformanceRecentSession[]>([])
  const [loadingPerformance, setLoadingPerformance] = useState(false)
  const [accumulatedScore, setAccumulatedScore] = useState<number>(0)
  const [avgScore, setAvgScore] = useState<number>(0)
  const [avgResponseTimeMs, setAvgResponseTimeMs] = useState<number>(0)

  // Leaderboard state
  const [selectedLeaderboardSession, setSelectedLeaderboardSession] = useState<string>("")
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)
  const [pollLeaderboard, setPollLeaderboard] = useState(false)
  const leaderboardFingerprintRef = useRef("")
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([])
  const [leaderboardStats, setLeaderboardStats] = useState<LeaderboardStats | null>(null)
  const [leaderboardSessionMeta, setLeaderboardSessionMeta] = useState<LeaderboardSessionMeta | null>(null)

  const openSessionLeaderboard = (session: Session) => {
    setSelectedLeaderboardSession(session.id.toString())
    setActiveTab("leaderboard")
  }

  const fetchClassSessions = async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/sessions", {
        headers: getInstructorScopeHeaders(),
      })
      if (!response.ok) return
      const data = await response.json()
      const sessions = (data.sessions ?? []).map((s: { id: number; code: string; description?: string }) => ({
        id: s.id,
        code: s.code,
        description: s.description ?? "",
      }))
      setAvailableClassSessions(sessions)

      try {
        const raw = localStorage.getItem("instructorSession")
        if (raw) {
          const parsed = JSON.parse(raw) as { selectedSessionId?: unknown }
          const sid = Number(parsed.selectedSessionId)
          if (Number.isFinite(sid) && sid > 0 && sessions.some((s: { id: number }) => s.id === sid)) {
            setSelectedClassSessions((prev) => (prev.length > 0 ? prev : [sid]))
          }
        }
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
  }

  const applyPlaygroundPolicyDefaults = (policy: PlaygroundPolicy) => {
    setQuestionCount(policy.default_question_count)
    setDurationSec(policy.default_duration_sec)
    setEditorDurationSec(policy.default_duration_sec)
    if (policy.default_allowed_session_ids.length > 0) {
      setSelectedClassSessions([...policy.default_allowed_session_ids])
    }
  }

  // Fetch sessions
  const fetchSessions = async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/playground/sessions", { headers: getInstructorScopeHeaders() })
      if (!response.ok) throw new Error("Failed to fetch sessions")
      const data = await response.json()
      setSessions(data.sessions || [])
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch playground sessions",
        variant: "destructive",
      })
    }
  }

  // Fetch topics from question bank
  const fetchTopics = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedQuestionTypes.length > 0) {
        params.append("questionTypes", selectedQuestionTypes.join(","))
      }
      const response = await instructorApiFetch(`/api/instructor/playground/topics?${params}`, { headers: getInstructorScopeHeaders() })
      if (!response.ok) throw new Error("Failed to fetch topics")
      const data = await response.json()
      setTopics(data.topics?.map((t: any) => t.name) || [])
    } catch (error) {
      // Error fetching topics
    }
  }

  // Fetch questions from question bank
  const fetchQuestions = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedDifficulty && selectedDifficulty !== "all") params.append("difficulty", selectedDifficulty)
      if (searchTerm) params.append("search", searchTerm)
      if (selectedQuestionTypes.length > 0) {
        params.append("questionTypes", selectedQuestionTypes.join(","))
      }

      const response = await instructorApiFetch(`/api/instructor/playground/questions?${params}`, { headers: getInstructorScopeHeaders() })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || `Failed to fetch questions: ${response.status} ${response.statusText}`)
      }
      const data = await response.json()
      setQuestions(data.questions || [])
      setTopics(data.topics || [])
      if (data.questionTypes) {
        setAvailableQuestionTypes(data.questionTypes)
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch questions",
        variant: "destructive",
      })
      // Set empty data on error to prevent UI issues
      setQuestions([])
      setTopics([])
    }
  }

  // Fetch performance data
  const fetchPerformance = async (sessionId?: number) => {
    setLoadingPerformance(true)
    try {
      const timestamp = new Date().getTime()
      const url = sessionId
        ? `/api/instructor/playground/performance?sessionId=${sessionId}&_t=${timestamp}`
        : `/api/instructor/playground/performance?_t=${timestamp}`
      const response = await fetch(url, { headers: getInstructorScopeHeaders() })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || `Failed to fetch performance: ${response.status}`)
      }
      const data = await response.json()

      if (sessionId) {
        setPerformanceData(data.performance || [])
        setQuestionStats(data.questionStats || [])
        setAccumulatedScore(data.accumulatedScore || 0)
        setAvgScore(data.avgScore || 0)
        setAvgResponseTimeMs(data.avgResponseTimeMs || 0)
      } else {
        setOverallStats(data.overallStats || null)
        setRecentPerformanceSessions(data.recentSessions || [])
        setPerformanceData([])
        setQuestionStats([])
        setAccumulatedScore(0)
        setAvgScore(0)
        setAvgResponseTimeMs(0)
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch performance data",
        variant: "destructive",
      })
      setPerformanceData([])
      setQuestionStats([])
    } finally {
      setLoadingPerformance(false)
    }
  }

  // Fetch leaderboard data
  const fetchLeaderboard = async (options?: { silent?: boolean }) => {
    if (!selectedLeaderboardSession) {
      leaderboardFingerprintRef.current = ""
      setLeaderboardData([])
      setLeaderboardStats(null)
      setLeaderboardSessionMeta(null)
      return []
    }

    const silent = options?.silent ?? false
    if (!silent) setLoadingLeaderboard(true)

    try {
      const params = new URLSearchParams()
      if (selectedLeaderboardSession) {
        params.append("sessionId", selectedLeaderboardSession)
      }

      const response = await instructorApiFetch(`/api/instructor/playground/leaderboard?${params}`, {
        headers: getInstructorScopeHeaders(),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || `Failed to fetch leaderboard: ${response.status} ${response.statusText}`)
      }
      const data = await response.json()
      const nextEntries = data.leaderboard || []
      const nextStats = data.stats || null
      const nextSessionMeta = data.session || null
      const shouldPoll = playgroundLeaderboardShouldPoll(nextEntries, nextStats, nextSessionMeta)
      setPollLeaderboard(shouldPoll)
      if (nextSessionMeta) setLeaderboardSessionMeta(nextSessionMeta)
      const fingerprint = playgroundLeaderboardFingerprint(nextEntries, nextStats)
      if (fingerprint !== leaderboardFingerprintRef.current) {
        leaderboardFingerprintRef.current = fingerprint
        setLeaderboardData(nextEntries)
        setLeaderboardStats(nextStats)
      }
      return nextEntries
    } catch (error: any) {
      if (!silent) {
        leaderboardFingerprintRef.current = ""
        toast({
          title: "Error",
          description: error.message || "Failed to fetch leaderboard data",
          variant: "destructive",
        })
        setLeaderboardData([])
        setLeaderboardStats(null)
        setLeaderboardSessionMeta(null)
        setPollLeaderboard(false)
      }
      return []
    } finally {
      if (!silent) setLoadingLeaderboard(false)
    }
  }

  // Clear all sessions
  const handleClearSessions = async (activeOnly: boolean = false) => {
    setClearingSessions(true)
    try {
      const response = await instructorApiFetch("/api/instructor/playground/clear-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(getInstructorScopeHeaders() as Record<string, string>) },
        body: JSON.stringify({ clearActiveOnly: activeOnly, confirmPhrase: clearConfirmPhrase }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || `Failed to clear sessions: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      // Immediately clear sessions from state to update UI
      setSessions([])
      
      toast({
        title: "Sessions Cleared",
        description: data.message || `Successfully cleared ${data.clearedCount || 0} session(s)`,
      })

      setShowClearDialog(false)
      setClearConfirmPhrase("")
      
      // Refresh sessions and leaderboard to ensure consistency
      await Promise.all([
        fetchSessions(),
        fetchLeaderboard()
      ])
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to clear sessions",
        variant: "destructive",
      })
    } finally {
      setClearingSessions(false)
    }
  }

  // Start a new session
  const handleStartSession = async () => {
    if (selectedTopics.length === 0 && selectedQuestionIds.length === 0) {
      toast({
        title: "Selection Required",
        description: "Please select at least one topic or individual questions",
        variant: "destructive",
      })
      return
    }

    if (questionCount < 1 || questionCount > playgroundPolicy.max_questions_per_session) {
      toast({
        title: "Invalid Question Count",
        description: `Question count must be between 1 and ${playgroundPolicy.max_questions_per_session}`,
        variant: "destructive",
      })
      return
    }

    if (
      durationSec < playgroundPolicy.min_duration_sec ||
      durationSec > playgroundPolicy.max_duration_sec
    ) {
      toast({
        title: "Invalid Duration",
        description: `Duration must be between ${playgroundPolicy.min_duration_sec} and ${playgroundPolicy.max_duration_sec} seconds`,
        variant: "destructive",
      })
      return
    }

    if (playgroundPolicy.require_session_restriction && selectedClassSessions.length === 0) {
      toast({
        title: "Section Required",
        description: "Select at least one class section for this playground session.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await instructorApiFetch("/api/instructor/playground/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(getInstructorScopeHeaders() as Record<string, string>) },
        body: JSON.stringify({
          action: "start",
          topics: selectedTopics.length > 0 ? selectedTopics : undefined,
          questionIds: selectedQuestionIds.length > 0 ? selectedQuestionIds : undefined,
          questionCount: selectedQuestionIds.length > 0 ? selectedQuestionIds.length : questionCount,
          durationSec,
          allowedSessions: selectedClassSessions.length > 0 ? selectedClassSessions : null, // null means all sessions
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to start session")
      }

      const data = await response.json()
      toast({
        title: "Lobby Opened",
        description: data.joinPasscode
          ? `Passcode: ${data.joinPasscode} — students can join the waiting room`
          : `Session ${data.sessionCode} opened with ${data.questionCount || selectedQuestionIds.length} questions`,
      })

      // Reset form
      setSelectedTopics([])
      setSelectedQuestionIds([])
      applyPlaygroundPolicyDefaults(playgroundPolicy)

      // Refresh sessions
      await fetchSessions()
      setActiveTab("sessions")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start session",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenLobby = async (session: Session) => {
    setLoading(true)
    try {
      const response = await instructorApiFetch("/api/instructor/playground/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getInstructorScopeHeaders() as Record<string, string>),
        },
        body: JSON.stringify({ action: "open-lobby", sessionId: session.id }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to open lobby")

      setSessions((prev) =>
        prev.map((s) =>
          s.id === session.id
            ? {
                ...s,
                is_active: true,
                game_started: false,
                join_passcode: data.joinPasscode,
                ended_at: null,
              }
            : s.is_active
              ? { ...s, is_active: false, game_started: false }
              : s,
        ),
      )

      toast({
        title: "Lobby Opened",
        description: `Share passcode ${data.joinPasscode} with students`,
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to open lobby",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleStartGame = async (sessionId: number) => {
    setLoading(true)
    try {
      const response = await instructorApiFetch("/api/instructor/playground/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getInstructorScopeHeaders() as Record<string, string>),
        },
        body: JSON.stringify({ action: "start-game", sessionId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to start game")

      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, game_started: true, current_question_index: 0 } : s)),
      )

      leaderboardFingerprintRef.current = ""
      setLeaderboardData([])
      setLeaderboardStats(null)
      setPollLeaderboard(false)

      const clearedAttempts = Boolean(data.reset?.clearedAttempts)
      toast({
        title: "Game started",
        description: clearedAttempts
          ? "Previous scores were cleared and questions are now live for students in the lobby."
          : "Questions are now live for all students in the lobby.",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start game",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const copyPasscode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      toast({ title: "Copied", description: "Passcode copied to clipboard" })
    } catch {
      toast({ title: "Passcode", description: code })
    }
  }

  const handleResetAttempts = async (sessionId: number) => {
    setLoading(true)
    try {
      const response = await instructorApiFetch("/api/instructor/playground/reset-attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(getInstructorScopeHeaders() as Record<string, string>) },
        body: JSON.stringify({ sessionId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to reset session")

      leaderboardFingerprintRef.current = ""
      setLeaderboardData([])
      setLeaderboardStats(null)
      setPollLeaderboard(false)
      toast({
        title: "Session reset",
        description: "Scores, attempts, and the leaderboard were cleared.",
      })
      await fetchSessions()
      if (selectedLeaderboardSession === String(sessionId)) {
        await fetchLeaderboard()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reset session",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Stop a session
  const handleStopSession = async (sessionId: number) => {
    setLoading(true)
    try {
      const response = await instructorApiFetch("/api/instructor/playground/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(getInstructorScopeHeaders() as Record<string, string>) },
        body: JSON.stringify({
          action: "stop",
          sessionId,
        }),
      })

      if (!response.ok) throw new Error("Failed to stop session")

      // Immediately update local state for instant UI feedback
      setSessions(prevSessions => 
        prevSessions.map(s => 
          s.id === sessionId 
            ? { ...s, is_active: false, game_started: false, ended_at: new Date().toISOString() }
            : s
        )
      )

      toast({
        title: "Session Stopped",
        description: "The playground session has been stopped",
      })

      // Don't refetch - optimistic update is sufficient since API succeeded
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to stop session",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const openSessionEditor = async (session: Session) => {
    setEditorSession(session)
    setEditorDurationSec(session.duration_sec)
    setEditorAddSearch("")
    setEditorLoading(true)
    try {
      const response = await instructorApiFetch(`/api/instructor/playground/sessions/${session.id}/questions`, {
        headers: getInstructorScopeHeaders(),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || "Failed to load session questions")
      }
      const data = await response.json()
      setEditorQuestions(data.questions || [])
      if (data.session?.durationSec) {
        setEditorDurationSec(data.session.durationSec)
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load session questions",
        variant: "destructive",
      })
      setEditorSession(null)
    } finally {
      setEditorLoading(false)
    }
  }

  const closeSessionEditor = () => {
    setEditorSession(null)
    setEditorQuestions([])
    setEditorAddSearch("")
    setShowDeleteSessionDialog(false)
    setSnapshotEditor(null)
    setSnapshotError("")
  }

  function openSnapshotEditor(question: SessionQuestion) {
    const options = Array.isArray(question.options)
      ? question.options.map((item) => (typeof item === "string" ? item : String(item ?? "")))
      : []
    setSnapshotEditor(question)
    setSnapshotDraft({
      questionText: question.questionText ?? "",
      topic: question.topic ?? "",
      options,
      correctAnswer: question.correctAnswer == null ? "" : String(question.correctAnswer),
      explanation: question.explanation ?? "",
    })
    setSnapshotError("")
  }

  function applySnapshotEditor() {
    if (!snapshotEditor) return
    const questionText = snapshotDraft.questionText.trim()
    if (!questionText) {
      setSnapshotError("Question text is required.")
      return
    }
    const options = snapshotDraft.options.map((item) => item.trim()).filter(Boolean)
    const usesOptions = !snapshotEditor.questionType || snapshotEditor.questionType === "mcq" || snapshotEditor.questionType === "true_false"
    if (usesOptions && options.length < 2) {
      setSnapshotError("Add at least two answer choices.")
      return
    }
    const correctAnswer = snapshotDraft.correctAnswer.trim()
    if (usesOptions && !options.includes(correctAnswer)) {
      setSnapshotError("The correct answer must match one of the choices.")
      return
    }
    setEditorQuestions((prev) =>
      prev.map((item) =>
        item.bankQuestionId === snapshotEditor.bankQuestionId
          ? {
              ...item,
              questionText,
              topic: snapshotDraft.topic.trim() || item.topic,
              options: usesOptions ? options : item.options,
              correctAnswer,
              explanation: snapshotDraft.explanation.trim() || null,
            }
          : item,
      ),
    )
    setSnapshotEditor(null)
    setSnapshotError("")
  }

  const moveEditorQuestion = (index: number, direction: -1 | 1) => {
    setEditorQuestions((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next.map((q, i) => ({ ...q, questionOrder: i + 1 }))
    })
  }

  const removeEditorQuestion = (bankQuestionId: number) => {
    setEditorQuestions((prev) =>
      prev
        .filter((q) => q.bankQuestionId !== bankQuestionId)
        .map((q, i) => ({ ...q, questionOrder: i + 1 })),
    )
  }

  const addEditorQuestions = (bankQuestionIds: number[]) => {
    const existing = new Set(editorQuestions.map((q) => q.bankQuestionId))
    const toAdd = bankQuestionIds.filter((id) => !existing.has(id))
    if (toAdd.length === 0) return

    const newItems: SessionQuestion[] = toAdd.map((id) => {
      const bank = questions.find((q) => q.id === id)
      return {
        id: 0,
        bankQuestionId: id,
        questionOrder: 0,
        questionText: bank?.questionText ?? `Question #${id}`,
        questionType: bank?.questionType ?? "mcq",
        difficulty: bank?.difficulty ?? "medium",
        topic: bank?.topic ?? "",
        options: Array.isArray(bank?.options) ? bank.options : [],
        correctAnswer: bank?.correctAnswer ?? null,
        explanation: null,
      }
    })

    setEditorQuestions((prev) =>
      [...prev, ...newItems].map((q, i) => ({ ...q, questionOrder: i + 1 })),
    )
  }

  const saveSessionEditor = async () => {
    if (!editorSession) return
    if (editorQuestions.length === 0) {
      toast({
        title: "No questions",
        description: "Add at least one question before saving",
        variant: "destructive",
      })
      return
    }

    setEditorSaving(true)
    try {
      const response = await fetch(
        `/api/instructor/playground/sessions/${editorSession.id}/questions`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(getInstructorScopeHeaders() as Record<string, string>),
          },
          body: JSON.stringify({
            questionIds: editorQuestions.map((q) => q.bankQuestionId),
            durationSec: editorDurationSec,
            questions: editorQuestions.map((q) => ({
              id: q.id,
              bankQuestionId: q.bankQuestionId,
              questionOrder: q.questionOrder,
              questionText: q.questionText,
              questionType: q.questionType,
              difficulty: q.difficulty,
              topic: q.topic,
              options: q.options,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation,
            })),
          }),
        },
      )
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to save session questions")
      }

      toast({
        title: "Session updated",
        description: `Saved ${data.questionCount} questions (${data.durationSec}s per question)`,
      })

      closeSessionEditor()
      await fetchSessions()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save session",
        variant: "destructive",
      })
    } finally {
      setEditorSaving(false)
    }
  }

  const handleDeleteSession = async () => {
    if (!editorSession) return
    setDeletingSession(true)
    try {
      const response = await instructorApiFetch("/api/instructor/playground/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getInstructorScopeHeaders() as Record<string, string>),
        },
        body: JSON.stringify({
          action: "delete",
          sessionId: editorSession.id,
          confirmPhrase: deleteConfirmPhrase,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete session")
      }

      toast({
        title: "Session deleted",
        description: `${editorSession.session_code} has been removed`,
      })

      closeSessionEditor()
      await fetchSessions()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete session",
        variant: "destructive",
      })
    } finally {
      setDeletingSession(false)
      setShowDeleteSessionDialog(false)
      setDeleteConfirmPhrase("")
    }
  }

  // Toggle topic selection
  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    )
  }

  // Toggle question selection
  const toggleQuestion = (questionId: number) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(questionId) ? prev.filter((id) => id !== questionId) : [...prev, questionId]
    )
  }

  // Select all filtered questions
  const selectAllQuestions = () => {
    const allIds = filteredQuestions.map((q) => q.id)
    setSelectedQuestionIds(allIds)
  }

  // Deselect all questions
  const deselectAllQuestions = () => {
    setSelectedQuestionIds([])
  }

  // Filtered questions based on search and selected topics
  const filteredQuestions = useMemo(
    () =>
      questions.filter((q) => {
        const matchesSearch = !searchTerm || q.questionText.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesTopic = selectedTopics.length === 0 || selectedTopics.includes(q.topic)
        return matchesSearch && matchesTopic
      }),
    [questions, searchTerm, selectedTopics],
  )

  const totalQuestionsPages = Math.max(1, Math.ceil(filteredQuestions.length / QUESTIONS_PER_PAGE))
  const paginatedQuestions = useMemo(() => {
    const start = (questionsPage - 1) * QUESTIONS_PER_PAGE
    return filteredQuestions.slice(start, start + QUESTIONS_PER_PAGE)
  }, [filteredQuestions, questionsPage])

  useEffect(() => {
    setQuestionsPage(1)
  }, [searchTerm, selectedTopics, selectedDifficulty, selectedQuestionTypes])

  useEffect(() => {
    if (questionsPage > totalQuestionsPages) {
      setQuestionsPage(totalQuestionsPages)
    }
  }, [questionsPage, totalQuestionsPages])

  const editorBankQuestions = questions.filter((q) => {
    if (!editorAddSearch.trim()) return true
    const term = editorAddSearch.toLowerCase()
    return (
      q.questionText.toLowerCase().includes(term) ||
      q.topic.toLowerCase().includes(term) ||
      formatQuestionType(q.questionType).toLowerCase().includes(term)
    )
  })

  const editorExistingBankIds = new Set(editorQuestions.map((q) => q.bankQuestionId))

  const menuItems = [
    { id: "sessions" as MenuTab, label: "Sessions", icon: Gamepad2 },
    { id: "questions" as MenuTab, label: "Questions", icon: FileText },
    { id: "performance" as MenuTab, label: "Performance", icon: BarChart3 },
    { id: "leaderboard" as MenuTab, label: "Leaderboard", icon: Trophy },
    { id: "configuration" as MenuTab, label: "Policies & Setup", icon: Settings },
  ]

  useEffect(() => {
    fetchSessions()
    fetchQuestions()
    fetchLeaderboard()
    fetchClassSessions()
  }, [courseScopeVersion])

  useEffect(() => {
    if (playgroundPolicyLoading) return
    applyPlaygroundPolicyDefaults(playgroundPolicy)
  }, [playgroundPolicyLoading, courseScopeVersion])

  useEffect(() => {
    if (activeTab !== "performance") return
    if (selectedPerformanceSessionId === "all") {
      fetchPerformance()
    } else {
      const id = Number.parseInt(selectedPerformanceSessionId, 10)
      if (!Number.isNaN(id)) fetchPerformance(id)
    }
  }, [activeTab, selectedPerformanceSessionId, courseScopeVersion])

  useEffect(() => {
    fetchQuestions()
    fetchTopics()
  }, [selectedDifficulty, searchTerm, selectedQuestionTypes, courseScopeVersion])

  useEffect(() => {
    fetchTopics()
  }, [selectedQuestionTypes, courseScopeVersion])

  useEffect(() => {
    if (sessions.length === 0) return
    if (!selectedLeaderboardSession || !sessions.some((s) => s.id.toString() === selectedLeaderboardSession)) {
      setSelectedLeaderboardSession(sessions[0].id.toString())
    }
  }, [sessions, selectedLeaderboardSession])

  useEffect(() => {
    fetchLeaderboard()
  }, [selectedLeaderboardSession, sessions, courseScopeVersion])

  const selectedLeaderboardSessionRow = sessions.find(
    (s) => s.id.toString() === selectedLeaderboardSession,
  )
  const leaderboardSessionIsLive = pollLeaderboard

  useEffect(() => {
    if (activeTab !== "leaderboard" || !pollLeaderboard || !selectedLeaderboardSession) return
    const interval = setInterval(() => {
      fetchLeaderboard({ silent: true })
    }, 8000)
    return () => clearInterval(interval)
  }, [activeTab, pollLeaderboard, selectedLeaderboardSession, courseScopeVersion])

  const hasOpenLobby = sessions.some((s) => s.is_active && !s.game_started)
  const activePasscodeSessions = sessions.filter((s) => s.is_active && s.join_passcode)
  useEffect(() => {
    if (!hasOpenLobby) return
    const interval = setInterval(() => {
      fetchSessions()
    }, 3000)
    return () => clearInterval(interval)
  }, [hasOpenLobby, courseScopeVersion])

  return (
    <div
      className={
        embedInDashboard
          ? "flex min-h-0 w-full min-w-0 flex-1 flex-col"
          : "w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6"
      }
    >
      {!embedInDashboard && (
        <div className="flex justify-end mb-4">
          <Link href="/instructor/dashboard">
            <Button variant="outline" className="gap-2 rounded-xl border-slate-200 dark:border-white/10">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      )}

      <FacultyModuleSplitLayout
        scrollMode={embedInDashboard ? "panel" : "page"}
        className={embedInDashboard ? "min-h-0 flex-1" : undefined}
        menu={
          openedSession && activeTab === "sessions" ? null : (
          <FacultyModuleSideMenu
            moduleId="playground"
            title="Playground"
            activeId={activeTab}
            onSelect={(id) => {
              setOpenedSessionId(null)
              setActiveTab(id as MenuTab)
            }}
            items={menuItems}
          />
          )
        }
      >
        {/* Main Content */}
        <div
          className={
            embedInDashboard
              ? "flex min-h-0 min-w-0 flex-1 flex-col gap-4 sm:gap-6"
              : "min-w-0 flex-1 space-y-4 sm:space-y-6"
          }
        >
          {activePasscodeSessions.length > 0 && !(openedSession && activeTab === "sessions") && (
            <div className={cn("space-y-2", embedInDashboard && "shrink-0")}>
              {activePasscodeSessions.map((session) => (
                <PlaygroundPasscodeBanner
                  key={session.id}
                  sessionCode={session.session_code}
                  label={getSessionDisplayLabel(session)}
                  passcode={session.join_passcode!}
                  gameStarted={session.game_started}
                  onCopy={() => copyPasscode(session.join_passcode!)}
                  onOpen={() => {
                    setActiveTab("sessions")
                    setOpenedSessionId(session.id)
                  }}
                />
              ))}
            </div>
          )}
          {activeTab === "sessions" && openedSession ? (
            <div className="space-y-4">
              <section className={cn(cardBase, "space-y-5 p-4 sm:p-5")}>
                <div className="flex items-start gap-3">
                  <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", fp.softBg)}>
                    <Gamepad2 className={cn("h-5 w-5", fp.iconText)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className={cn("text-lg font-semibold", PORTAL_TEXT)}>{getSessionDisplayLabel(openedSession)}</h2>
                    <p className={cn("mt-0.5 font-mono text-sm", PORTAL_TEXT_MUTED)}>{openedSession.session_code}</p>
                    <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>
                      {openedSession.question_count_actual} questions · {openedSession.duration_sec}s ·{" "}
                      {openedSession.waiting_count ?? openedSession.participant_count} in lobby
                    </p>
                    <div className="mt-2">
                      {openedSession.is_active && openedSession.game_started ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                          Live
                        </span>
                      ) : openedSession.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                          Waiting
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          Closed
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {openedSession.is_active && openedSession.join_passcode ? (
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-2 rounded-xl border p-3",
                      openedSession.game_started
                        ? "border-emerald-200/80 bg-emerald-50/80 dark:border-emerald-800/40 dark:bg-emerald-950/20"
                        : "border-amber-200/80 bg-amber-50/80 dark:border-amber-800/40 dark:bg-amber-950/20",
                    )}
                  >
                    <KeyRound
                      className={cn(
                        "h-4 w-4 shrink-0",
                        openedSession.game_started ? "text-emerald-600" : "text-amber-600",
                      )}
                    />
                    <span className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>Student passcode</span>
                    <span className="font-mono text-lg font-bold tracking-widest text-[var(--cc-text)]">
                      {openedSession.join_passcode}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="ml-auto h-7"
                      onClick={() => copyPasscode(openedSession.join_passcode!)}
                    >
                      <Copy className="mr-1 h-3.5 w-3.5" />
                      Copy
                    </Button>
                  </div>
                ) : null}

                {openedSession.selected_topics && openedSession.selected_topics.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {openedSession.selected_topics.map((topic) => (
                      <Badge key={topic} variant="outline" className="max-w-full whitespace-normal text-left">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>Class access</span>
                  {openedSession.allowed_sessions != null &&
                  Array.isArray(openedSession.allowed_sessions) &&
                  openedSession.allowed_sessions.length > 0 ? (
                    openedSession.allowed_sessions.map((sessionId) => {
                      const classSession = availableClassSessions.find((s) => s.id === sessionId)
                      return classSession ? (
                        <Badge key={sessionId} variant="secondary" className={cn("text-xs", fp.badge)}>
                          {classSession.code}
                        </Badge>
                      ) : null
                    })
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      All sessions
                    </Badge>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { label: "Leaderboard", icon: Trophy, onClick: () => openSessionLeaderboard(openedSession) },
                    { label: "Manage questions", icon: ListOrdered, onClick: () => void openSessionEditor(openedSession) },
                  ].map((action) => {
                    const ActionIcon = action.icon
                    return (
                      <Button
                        key={action.label}
                        type="button"
                        variant="outline"
                        className="h-10 justify-start gap-2 rounded-xl"
                        disabled={loading}
                        onClick={action.onClick}
                      >
                        <ActionIcon className={cn("h-4 w-4", fp.iconText)} />
                        {action.label}
                      </Button>
                    )
                  })}
                  {openedSession.is_active && !openedSession.game_started ? (
                    <>
                      <Button
                        type="button"
                        className={cn("h-10 justify-start gap-2 rounded-xl", chrome.cta)}
                        disabled={loading || (openedSession.waiting_count ?? 0) === 0}
                        onClick={() => handleStartGame(openedSession.id)}
                      >
                        <Play className="h-4 w-4" />
                        Start game
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="h-10 justify-start gap-2 rounded-xl"
                        disabled={loading}
                        onClick={() => handleStopSession(openedSession.id)}
                      >
                        <Square className="h-4 w-4" />
                        Close lobby
                      </Button>
                      {(openedSession.waiting_count ?? 0) > 0 || (openedSession.participant_count ?? 0) > 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 justify-start gap-2 rounded-xl"
                          disabled={loading}
                          onClick={() => handleResetAttempts(openedSession.id)}
                        >
                          <RotateCcw className={cn("h-4 w-4", fp.iconText)} />
                          Reset lobby
                        </Button>
                      ) : null}
                    </>
                  ) : openedSession.is_active && openedSession.game_started ? (
                    <>
                      {(openedSession.waiting_count ?? 0) > 0 || (openedSession.participant_count ?? 0) > 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 justify-start gap-2 rounded-xl"
                          disabled={loading}
                          onClick={() => handleResetAttempts(openedSession.id)}
                        >
                          <RotateCcw className={cn("h-4 w-4", fp.iconText)} />
                          Reset session
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="destructive"
                        className="h-10 justify-start gap-2 rounded-xl"
                        disabled={loading}
                        onClick={() => handleStopSession(openedSession.id)}
                      >
                        <Square className="h-4 w-4" />
                        Stop session
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className={cn("h-10 justify-start gap-2 rounded-xl", chrome.outline)}
                      disabled={loading}
                      onClick={() => handleOpenLobby(openedSession)}
                    >
                      <KeyRound className={cn("h-4 w-4", fp.iconText)} />
                      Open lobby
                    </Button>
                  )}
                </div>
              </section>
            </div>
          ) : activeTab === "sessions" ? (
            <div className={embedInDashboard ? "flex min-h-0 flex-1 flex-col gap-4" : "space-y-4"}>
              <div className={embedInDashboard ? "shrink-0" : undefined}>
              <FacultyIntegratedToolbar
                moduleId="playground"
                search={sessionSearch}
                onSearchChange={setSessionSearch}
                onSearchClear={() => setSessionSearch("")}
                searchPlaceholder="Search sessions…"
                viewMode={sessionViewMode}
                onViewModeChange={setSessionViewMode}
                meta={
                  <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                    {filteredSessions.length} session{filteredSessions.length === 1 ? "" : "s"}
                  </p>
                }
                trailing={
                  <>
                    <Button variant="outline" size="sm" onClick={fetchSessions} className="h-9 gap-1.5 rounded-lg">
                      <RefreshCw className="h-3.5 w-3.5" />
                      Refresh
                    </Button>
                    {sessions.length > 0 ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowClearDialog(true)}
                        disabled={clearingSessions}
                        className="h-9 gap-1.5 rounded-lg"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Clear all
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      className={cn("h-9 shrink-0 gap-1.5", chrome.cta)}
                      onClick={() => setActiveTab("questions")}
                    >
                      <Plus className="h-4 w-4" />
                      New session
                    </Button>
                  </>
                }
              />
              </div>

              <div className={embedInDashboard ? "flex min-h-0 flex-1 flex-col" : undefined}>
              {filteredSessions.length === 0 ? (
                <div
                  className={cn(
                    cardBase,
                    embedInDashboard
                      ? "flex min-h-0 flex-1 flex-col items-center justify-center border-dashed px-4 py-10 text-center"
                      : "p-8 text-center sm:p-10",
                  )}
                >
                  <Gamepad2 className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
                  <h4 className={cn("mb-1 font-semibold", PORTAL_TEXT)}>
                    {sessionSearch.trim() ? "No sessions found" : "No playground sessions"}
                  </h4>
                  <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
                    {sessionSearch.trim()
                      ? "Try a different search"
                      : "Start a new session from Questions"}
                  </p>
                  {!sessionSearch.trim() ? (
                    <Button
                      size="sm"
                      className={cn("mt-4 gap-1.5", chrome.cta)}
                      onClick={() => setActiveTab("questions")}
                    >
                      <Plus className="h-4 w-4" />
                      New session
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className={embedInDashboard ? "flex min-h-0 flex-1 flex-col gap-4" : "space-y-4"}>
                <div
                  className={cn(
                    embedInDashboard && "min-h-0 flex-1 overflow-y-auto pr-1 sm:pr-2",
                    sessionViewMode === "grid"
                      ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
                      : "space-y-3",
                  )}
                >
                  {paginatedSessions.map((session) => (
                    <PlaygroundSessionCard
                      key={session.id}
                      id={session.id}
                      sessionCode={session.session_code}
                      label={getSessionDisplayLabel(session)}
                      isActive={session.is_active}
                      gameStarted={session.game_started}
                      questionCount={session.question_count_actual}
                      durationSec={session.duration_sec}
                      lobbyCount={session.waiting_count ?? session.participant_count}
                      createdAt={session.created_at}
                      topics={session.selected_topics}
                      onSelect={() => setOpenedSessionId(session.id)}
                    />
                  ))}
                </div>

              {totalSessionsPages > 1 && (
                <div className={cn("flex flex-col items-center justify-between gap-4 pt-2 sm:flex-row", embedInDashboard && "shrink-0")}>
                  <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
                    Showing {(sessionsPage - 1) * SESSIONS_PER_PAGE + 1}-
                    {Math.min(sessionsPage * SESSIONS_PER_PAGE, filteredSessions.length)} of {filteredSessions.length}{" "}
                    sessions
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            if (sessionsPage > 1) setSessionsPage(sessionsPage - 1)
                          }}
                          className={sessionsPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          aria-disabled={sessionsPage <= 1}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalSessionsPages }, (_, i) => i + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault()
                              setSessionsPage(page)
                            }}
                            isActive={sessionsPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            if (sessionsPage < totalSessionsPages) setSessionsPage(sessionsPage + 1)
                          }}
                          className={
                            sessionsPage >= totalSessionsPages ? "pointer-events-none opacity-50" : "cursor-pointer"
                          }
                          aria-disabled={sessionsPage >= totalSessionsPages}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
                </div>
              )}
              </div>
            </div>
          ) : null}

          {/* Questions Tab */}
          {activeTab === "questions" && (
            <div className="space-y-4">
              <FacultyIntegratedToolbar
                moduleId="playground"
                search={searchTerm}
                onSearchChange={setSearchTerm}
                onSearchClear={() => setSearchTerm("")}
                searchPlaceholder="Search questions…"
                filters={
                  <>
                    <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                      <SelectTrigger
                        className={cn(
                          facultyToolbarFilterButtonClass(selectedDifficulty !== "all"),
                          "h-9 w-[132px] shadow-none",
                        )}
                      >
                        <SelectValue placeholder="Difficulty" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All difficulties</SelectItem>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                    <Popover open={questionTypePopoverOpen} onOpenChange={setQuestionTypePopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          className={facultyToolbarFilterButtonClass(selectedQuestionTypes.length > 0)}
                        >
                          {selectedQuestionTypes.length === 0
                            ? "Question type"
                            : selectedQuestionTypes.length === availableQuestionTypes.length
                              ? "All types"
                              : `${selectedQuestionTypes.length} types`}
                          <ChevronDown className="ml-1 h-4 w-4 shrink-0 opacity-60" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[min(300px,calc(100vw-2rem))] p-3" align="start">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm font-semibold">Question types</Label>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => {
                                if (selectedQuestionTypes.length === availableQuestionTypes.length) {
                                  setSelectedQuestionTypes([])
                                } else {
                                  setSelectedQuestionTypes([...availableQuestionTypes])
                                }
                              }}
                            >
                              {selectedQuestionTypes.length === availableQuestionTypes.length
                                ? "Deselect all"
                                : "Select all"}
                            </Button>
                          </div>
                          <div className="space-y-1.5 max-h-64 overflow-y-auto">
                            {availableQuestionTypes.map((type) => (
                              <div
                                key={type}
                                className="flex cursor-pointer items-center space-x-2 rounded-md p-2 hover:bg-[var(--cc-accent-soft)]/45"
                                onClick={() => {
                                  if (selectedQuestionTypes.includes(type)) {
                                    setSelectedQuestionTypes(selectedQuestionTypes.filter((t) => t !== type))
                                  } else {
                                    setSelectedQuestionTypes([...selectedQuestionTypes, type])
                                  }
                                }}
                              >
                                <Checkbox
                                  checked={selectedQuestionTypes.includes(type)}
                                  onCheckedChange={() => {
                                    if (selectedQuestionTypes.includes(type)) {
                                      setSelectedQuestionTypes(selectedQuestionTypes.filter((t) => t !== type))
                                    } else {
                                      setSelectedQuestionTypes([...selectedQuestionTypes, type])
                                    }
                                  }}
                                />
                                <Label className="text-sm font-normal cursor-pointer flex-1">
                                  {type === "mcq"
                                    ? "Multiple Choice"
                                    : type === "true_false"
                                      ? "True/False"
                                      : type
                                          .split("_")
                                          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                                          .join(" ")}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </>
                }
                meta={
                  <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                    {filteredQuestions.length} available · {selectedQuestionIds.length} selected
                    {selectedTopics.length > 0 ? ` · ${selectedTopics.length} topics` : ""}
                  </p>
                }
                trailing={
                  filteredQuestions.length > 0 ? (
                    <>
                      <Button variant="outline" size="sm" onClick={selectAllQuestions} className="h-9 gap-1.5 rounded-lg">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Select all
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={deselectAllQuestions}
                        disabled={selectedQuestionIds.length === 0}
                        className="h-9 gap-1.5 rounded-lg"
                      >
                        <X className="h-3.5 w-3.5" />
                        Clear
                      </Button>
                    </>
                  ) : null
                }
              />

              {topics.length > 0 ? (
                <section className={cn(cardBase, "space-y-3 p-4 sm:p-5")}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", fp.softBg)}>
                        <Sparkles className={cn("h-4 w-4", fp.iconText)} />
                      </div>
                      <div>
                        <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>Topics</h3>
                        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                          {selectedTopics.length} of {topics.length} selected
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedTopics([...topics])}
                        disabled={selectedTopics.length === topics.length}
                        className="h-8 text-xs"
                      >
                        All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedTopics([])}
                        disabled={selectedTopics.length === 0}
                        className="h-8 text-xs"
                      >
                        None
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {topics.map((topic) => {
                      const selected = selectedTopics.includes(topic)
                      return (
                        <button
                          key={topic}
                          type="button"
                          onClick={() => toggleTopic(topic)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-left text-xs transition-colors sm:text-sm",
                            selected
                              ? cn(fp.softBg, fp.border, fp.iconText)
                              : "border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)] hover:bg-[var(--cc-accent-soft)]/45",
                          )}
                        >
                          {topic}
                        </button>
                      )
                    })}
                  </div>
                </section>
              ) : null}

              {selectedQuestionIds.length > 0 || selectedTopics.length > 0 ? (
                <section className={cn(cardBase, "space-y-3 p-4 sm:p-5")}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", fp.softBg)}>
                        <CheckCircle2 className={cn("h-5 w-5", fp.iconText)} />
                      </div>
                      <div>
                        <p className={cn("font-semibold", PORTAL_TEXT)}>Ready to start</p>
                        <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
                          {selectedQuestionIds.length} questions
                          {selectedTopics.length > 0 ? ` · ${selectedTopics.length} topics` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedQuestionIds([])
                          setSelectedTopics([])
                        }}
                        className={chrome.outline}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Clear
                      </Button>
                      <Button
                        onClick={handleStartSession}
                        disabled={
                          loading ||
                          (selectedTopics.length === 0 && selectedQuestionIds.length === 0) ||
                          questionCount < 1 ||
                          durationSec < 5
                        }
                        className={chrome.cta}
                        size="sm"
                      >
                        {loading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                        Start session
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    {selectedTopics.length > 0 && selectedQuestionIds.length === 0 ? (
                      <div className="flex items-center gap-2">
                        <span className={PORTAL_TEXT_MUTED}>Questions</span>
                        <Input
                          type="number"
                          value={questionCount}
                          onChange={(e) => setQuestionCount(parseInt(e.target.value) || 10)}
                          min={1}
                          max={50}
                          className="h-8 w-16 sm:w-20"
                        />
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <span className={PORTAL_TEXT_MUTED}>Seconds</span>
                      <Input
                        type="number"
                        value={durationSec}
                        onChange={(e) => setDurationSec(parseInt(e.target.value) || 10)}
                        min={5}
                        max={60}
                        className="h-8 w-16 sm:w-20"
                      />
                    </div>
                  </div>
                </section>
              ) : null}

              {filteredQuestions.length === 0 ? (
                <div className={cn(cardBase, "py-12 text-center")}>
                  <FileText className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
                  <p className={cn("font-medium", PORTAL_TEXT)}>No questions found</p>
                  <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>
                    Try adjusting your filters or add questions to the question bank
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {paginatedQuestions.map((question) => (
                      <PlaygroundQuestionCard
                        key={question.id}
                        questionText={question.questionText}
                        questionType={question.questionType}
                        topic={question.topic}
                        difficulty={question.difficulty}
                        selected={selectedQuestionIds.includes(question.id)}
                        onToggle={() => toggleQuestion(question.id)}
                      />
                    ))}
                  </div>

                  {totalQuestionsPages > 1 ? (
                    <div className="flex flex-col items-center justify-between gap-4 pt-2 sm:flex-row">
                      <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
                        Showing {(questionsPage - 1) * QUESTIONS_PER_PAGE + 1}-
                        {Math.min(questionsPage * QUESTIONS_PER_PAGE, filteredQuestions.length)} of{" "}
                        {filteredQuestions.length} questions
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 px-2.5"
                          disabled={questionsPage <= 1}
                          onClick={() => setQuestionsPage((page) => Math.max(1, page - 1))}
                        >
                          Previous
                        </Button>
                        <p className={cn("min-w-[4.5rem] text-center text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
                          {questionsPage} / {totalQuestionsPages}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 px-2.5"
                          disabled={questionsPage >= totalQuestionsPages}
                          onClick={() =>
                            setQuestionsPage((page) => Math.min(totalQuestionsPages, page + 1))
                          }
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}

          {activeTab === "performance" && (
            <div className={embedInDashboard ? "flex min-h-0 min-w-0 flex-1 flex-col" : undefined}>
            <InstructorPlaygroundPerformanceTab
              sessions={sessions}
              selectedSessionId={selectedPerformanceSessionId}
              onSelectSession={setSelectedPerformanceSessionId}
              loading={loadingPerformance}
              performanceData={performanceData}
              questionStats={questionStats}
              overallStats={overallStats}
              recentSessions={recentPerformanceSessions}
              accumulatedScore={accumulatedScore}
              avgScore={avgScore}
              avgResponseTimeMs={avgResponseTimeMs}
              onRefresh={() => {
                if (selectedPerformanceSessionId === "all") {
                  fetchPerformance()
                } else {
                  const id = Number.parseInt(selectedPerformanceSessionId, 10)
                  if (!Number.isNaN(id)) fetchPerformance(id)
                }
              }}
              getSessionDisplayLabel={(session) => getSessionDisplayLabel(session as Session)}
            />
            </div>
          )}

          {/* Leaderboard Tab */}
          {activeTab === "leaderboard" && (
            <div className={embedInDashboard ? "flex min-h-0 min-w-0 flex-1 flex-col" : undefined}>
            <InstructorPlaygroundLeaderboardTab
              sessions={sessions}
              selectedLeaderboardSession={selectedLeaderboardSession}
              onSelectSession={setSelectedLeaderboardSession}
              loadingLeaderboard={loadingLeaderboard}
              refreshingLeaderboard={false}
              leaderboardData={leaderboardData}
              leaderboardStats={leaderboardStats}
              leaderboardSessionMeta={leaderboardSessionMeta}
              selectedLeaderboardSessionRow={selectedLeaderboardSessionRow}
              leaderboardSessionIsLive={leaderboardSessionIsLive}
              onRefresh={() => fetchLeaderboard()}
              getSessionDisplayLabel={(session) => getSessionDisplayLabel(session as Session)}
            />
            </div>
          )}

          {/* Configuration Tab */}
          {activeTab === "configuration" && (
            <div className="space-y-6">
              <InstructorAdminQuickLink
                href={`${FACULTY_DASHBOARD_BASE}/administration/playground-rules`}
                label="Playground rules in Administration"
                description="Same course rules live here too — grouped with grading, attendance, and classroom points policies"
              />

              <InstructorPlaygroundPoliciesPanel
                availableClassSessions={availableClassSessions}
                onPolicyApplied={applyPlaygroundPolicyDefaults}
              />

              <div className={cn(cardBase, "space-y-4 p-4 sm:p-5")}>
                <div className="flex items-start gap-3">
                  <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", fp.softBg)}>
                    <Play className={cn("h-5 w-5", fp.iconText)} />
                  </div>
                  <div>
                    <h3 className={cn("font-semibold", PORTAL_TEXT)}>Start new session</h3>
                    <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>
                      Uses your saved defaults — pick questions on the Questions tab first
                    </p>
                  </div>
                </div>
                <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Question Count</Label>
                    <Input
                      type="number"
                      value={questionCount}
                      onChange={(e) => setQuestionCount(parseInt(e.target.value) || 10)}
                      min={1}
                      max={playgroundPolicy.max_questions_per_session}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedQuestionIds.length > 0
                        ? `${selectedQuestionIds.length} questions selected`
                        : "Number of questions to include"}
                    </p>
                  </div>
                  <div>
                    <Label>Duration per Question (seconds)</Label>
                    <Input
                      type="number"
                      value={durationSec}
                      onChange={(e) => setDurationSec(parseInt(e.target.value) || 10)}
                      min={playgroundPolicy.min_duration_sec}
                      max={playgroundPolicy.max_duration_sec}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Range: {playgroundPolicy.min_duration_sec}–{playgroundPolicy.max_duration_sec} seconds
                    </p>
                  </div>
                </div>

                <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className={cn("text-sm font-medium", PORTAL_TEXT)}>Selection</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>
                      Topics Selected: <span className="font-medium">{selectedTopics.length}</span>
                    </div>
                    <div>
                      Questions Selected: <span className="font-medium">{selectedQuestionIds.length}</span>
                    </div>
                    {selectedTopics.length === 0 && selectedQuestionIds.length === 0 && (
                      <div className="text-amber-600 dark:text-amber-400 text-xs mt-2">
                        ⚠️ Please select topics or questions before starting
                      </div>
                    )}
                  </div>
                </div>

                {/* Class Session Access Selection */}
                <div className="space-y-2">
                  <Label className="text-slate-800 dark:text-slate-100">Class Session Access</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Select which class sections can join this game. Each section’s lobby runs independently — opening P01 does not affect P02 or P03.
                  </p>
                  <div className="flex flex-wrap gap-2 min-w-0">
                    {availableClassSessions.map((session) => (
                      <Button
                        key={session.id}
                        type="button"
                        variant={selectedClassSessions.includes(session.id) ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          if (selectedClassSessions.includes(session.id)) {
                            setSelectedClassSessions(selectedClassSessions.filter(id => id !== session.id))
                          } else {
                            setSelectedClassSessions([...selectedClassSessions, session.id])
                          }
                        }}
                        className={selectedClassSessions.includes(session.id) ? chrome.cta : chrome.outline}
                      >
                        {session.code}
                      </Button>
                    ))}
                  </div>
                  {selectedClassSessions.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Selected: {selectedClassSessions.map(id => {
                        const session = availableClassSessions.find(s => s.id === id)
                        return session?.code
                      }).filter(Boolean).join(", ")}
                    </p>
                  )}
                  {selectedClassSessions.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      All class sessions will have access
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleStartSession}
                  disabled={
                    loading ||
                    (selectedTopics.length === 0 && selectedQuestionIds.length === 0) ||
                    questionCount < 1 ||
                    durationSec < playgroundPolicy.min_duration_sec ||
                    (playgroundPolicy.require_session_restriction && selectedClassSessions.length === 0)
                  }
                  className={cn("w-full rounded-xl", chrome.cta)}
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader className="h-4 w-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Start Session
                    </>
                  )}
                </Button>
              </div>
            </div>
            </div>
          )}
        </div>
      </FacultyModuleSplitLayout>

      {/* Session Questions Editor */}
      <Dialog open={!!editorSession} onOpenChange={(open) => !open && closeSessionEditor()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <Pencil className={cn("h-5 w-5", fp.iconText)} />
              {editorSession ? `${editorSession.session_code} — ${getSessionDisplayLabel(editorSession)}` : "Session Questions"}
            </DialogTitle>
            <DialogDescription>
              Reorder, add, remove, or edit this session’s copy. Wording changes do not update the Question Bank. Stop the session before saving.
            </DialogDescription>
          </DialogHeader>

          {editorLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader className={cn("h-8 w-8 animate-spin", facultyModuleSpinnerClass("playground"))} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="flex flex-col sm:flex-row sm:items-end gap-3 p-3 rounded-lg border bg-slate-50/80 dark:bg-slate-900/40">
                <div className="flex-1">
                  <Label htmlFor="editor-duration">Seconds per question</Label>
                  <Input
                    id="editor-duration"
                    type="number"
                    min={5}
                    max={60}
                    value={editorDurationSec}
                    onChange={(e) => setEditorDurationSec(Number(e.target.value))}
                    disabled={editorSession?.is_active}
                    className="mt-1 max-w-[140px]"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  {editorQuestions.length} question{editorQuestions.length === 1 ? "" : "s"} in session
                  {editorSession?.is_active && (
                    <span className="block text-amber-600 dark:text-amber-400 mt-1">
                      Stop this session to edit questions.
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <div className="px-3 py-2 border-b bg-slate-50/80 dark:bg-slate-900/40 text-sm font-medium">
                  Session question order
                </div>
                {editorQuestions.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No questions in this session yet. Add questions from the bank below.
                  </div>
                ) : (
                  <div className="divide-y max-h-64 overflow-y-auto">
                    {editorQuestions.map((q, index) => (
                      <div key={`${q.bankQuestionId}-${index}`} className="p-3 flex gap-3 items-start">
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={index === 0 || editorSession?.is_active}
                            onClick={() => moveEditorQuestion(index, -1)}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={index === editorQuestions.length - 1 || editorSession?.is_active}
                            onClick={() => moveEditorQuestion(index, 1)}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">Q{index + 1}</Badge>
                            <Badge variant="secondary" className="text-xs">{formatQuestionType(q.questionType)}</Badge>
                            <Badge variant="outline" className="text-xs">{q.difficulty}</Badge>
                          </div>
                          <p className="line-clamp-2 text-sm text-slate-800 dark:text-slate-200">
                            {stripHtmlToPlain(q.questionText) || q.questionText}
                          </p>
                          {q.topic && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">{q.topic}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={editorSession?.is_active}
                            onClick={() => openSnapshotEditor(q)}
                            aria-label={`Edit session question ${index + 1}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                            disabled={editorSession?.is_active}
                            onClick={() => removeEditorQuestion(q.bankQuestionId)}
                            aria-label={`Remove session question ${index + 1}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!editorSession?.is_active && (
                <div className="rounded-lg border overflow-hidden">
                  <div className="px-3 py-2 border-b bg-teal-50/80 dark:bg-teal-950/30 text-sm font-medium">
                    Add from question bank
                  </div>
                  <div className="p-3 space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search bank questions..."
                        value={editorAddSearch}
                        onChange={(e) => setEditorAddSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y rounded-md border">
                      {editorBankQuestions.length === 0 ? (
                        <p className="p-4 text-sm text-muted-foreground text-center">No matching questions</p>
                      ) : (
                        editorBankQuestions.slice(0, 40).map((q) => {
                          const alreadyAdded = editorExistingBankIds.has(q.id)
                          return (
                            <div key={q.id} className="p-2.5 flex items-start gap-2 text-sm">
                              <Checkbox
                                checked={alreadyAdded}
                                disabled={alreadyAdded}
                                onCheckedChange={() => addEditorQuestions([q.id])}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap gap-1 mb-0.5">
                                  <Badge variant="secondary" className="text-[10px]">{formatQuestionType(q.questionType)}</Badge>
                                  <Badge variant="outline" className="text-[10px]">{q.topic}</Badge>
                                </div>
                                <p className="line-clamp-2">{stripHtmlToPlain(q.questionText) || q.questionText}</p>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDeleteSessionDialog(true)}
              disabled={editorSession?.is_active || editorSaving || deletingSession}
              className="sm:mr-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Session
            </Button>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button type="button" variant="outline" onClick={closeSessionEditor}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={saveSessionEditor}
                disabled={editorLoading || editorSaving || editorSession?.is_active || editorQuestions.length === 0}
              >
                {editorSaving ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={snapshotEditor != null} onOpenChange={(open) => !open && setSnapshotEditor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit session question</DialogTitle>
            <DialogDescription>
              Changes apply to this playground session only. The source Question Bank question is left unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {snapshotError ? <p className="text-sm text-destructive">{snapshotError}</p> : null}
            <div className="space-y-1.5">
              <Label htmlFor="session-question-text">Question</Label>
              <Textarea
                id="session-question-text"
                value={snapshotDraft.questionText}
                onChange={(e) => setSnapshotDraft((prev) => ({ ...prev, questionText: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-question-topic">Topic</Label>
              <Input
                id="session-question-topic"
                value={snapshotDraft.topic}
                onChange={(e) => setSnapshotDraft((prev) => ({ ...prev, topic: e.target.value }))}
              />
            </div>
            {snapshotDraft.options.length > 0 ||
            snapshotEditor?.questionType === "mcq" ||
            snapshotEditor?.questionType === "true_false" ? (
              <div className="space-y-2">
                <Label>Answer choices</Label>
                {snapshotDraft.options.map((option, index) => (
                  <div key={`session-opt-${index}`} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="session-correct"
                      checked={snapshotDraft.correctAnswer.trim() === option.trim() && option.trim().length > 0}
                      onChange={() =>
                        setSnapshotDraft((prev) => ({ ...prev, correctAnswer: prev.options[index] ?? "" }))
                      }
                      aria-label={`Mark option ${index + 1} correct`}
                    />
                    <Input
                      value={option}
                      onChange={(e) =>
                        setSnapshotDraft((prev) => {
                          const options = [...prev.options]
                          options[index] = e.target.value
                          const correctAnswer =
                            prev.correctAnswer === prev.options[index] ? e.target.value : prev.correctAnswer
                          return { ...prev, options, correctAnswer }
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600"
                      onClick={() =>
                        setSnapshotDraft((prev) => ({
                          ...prev,
                          options: prev.options.filter((_, i) => i !== index),
                          correctAnswer: prev.correctAnswer === option ? "" : prev.correctAnswer,
                        }))
                      }
                      aria-label={`Remove session option ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSnapshotDraft((prev) => ({ ...prev, options: [...prev.options, ""] }))}
                >
                  Add option
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="session-expected-answer">Expected answer</Label>
                <Input
                  id="session-expected-answer"
                  value={snapshotDraft.correctAnswer}
                  onChange={(e) => setSnapshotDraft((prev) => ({ ...prev, correctAnswer: e.target.value }))}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="session-explanation">Explanation</Label>
              <Textarea
                id="session-explanation"
                value={snapshotDraft.explanation}
                onChange={(e) => setSnapshotDraft((prev) => ({ ...prev, explanation: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSnapshotEditor(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={applySnapshotEditor}>
              Save for this session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteSessionDialog} onOpenChange={setShowDeleteSessionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {editorSession?.session_code} and all participant data for it.
              {(editorSession?.participant_count ?? 0) > 0 && (
                <span className="block mt-2 font-medium text-destructive">
                  Type <code className="text-xs">{STUDENT_DATA_DELETE_CONFIRM_PHRASE}</code> below to confirm.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(editorSession?.participant_count ?? 0) > 0 && (
            <Input
              value={deleteConfirmPhrase}
              onChange={(e) => setDeleteConfirmPhrase(e.target.value)}
              placeholder={STUDENT_DATA_DELETE_CONFIRM_PHRASE}
              className="font-mono text-sm"
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSession}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSession}
              disabled={
                deletingSession ||
                ((editorSession?.participant_count ?? 0) > 0 &&
                  deleteConfirmPhrase !== STUDENT_DATA_DELETE_CONFIRM_PHRASE)
              }
              className="bg-destructive"
            >
              {deletingSession ? "Deleting..." : "Delete Session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Sessions Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={(open) => {
        setShowClearDialog(open)
        if (!open) setClearConfirmPhrase("")
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Sessions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all playground sessions and their data. This action cannot be undone.
              On production, this is blocked unless ops enables maintenance mode.
              <span className="block mt-2 font-medium text-destructive">
                Type <code className="text-xs">{STUDENT_DATA_DELETE_CONFIRM_PHRASE}</code> below to confirm.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={clearConfirmPhrase}
            onChange={(e) => setClearConfirmPhrase(e.target.value)}
            placeholder={STUDENT_DATA_DELETE_CONFIRM_PHRASE}
            className="font-mono text-sm"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleClearSessions(false)}
              disabled={clearingSessions || clearConfirmPhrase !== STUDENT_DATA_DELETE_CONFIRM_PHRASE}
              className="bg-destructive"
            >
              {clearingSessions ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Clearing...
                </>
              ) : (
                "Clear All Sessions"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
