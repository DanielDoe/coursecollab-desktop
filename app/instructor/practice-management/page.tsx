"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import React, { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Brain,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Users,
  Target,
  Download,
  BarChart3,
  Award,
  RotateCcw,
  Settings,
  Clock,
  AlertCircle,
  Trash2,
  Edit,
  Trash,
  Eye,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { portalListStripe } from "@/lib/portal-module-themes"
import { PORTAL_CTA, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { PracticeTopicCard } from "@/components/instructor/practice/practice-topic-card"
import { PracticeStudentCard } from "@/components/instructor/practice/practice-student-card"
import { PracticeActivityCard } from "@/components/instructor/practice/practice-activity-card"
import { PracticeAnalyticsCharts } from "@/components/instructor/practice/practice-analytics-charts"
import { cn } from "@/lib/utils"
import {
  InstructorPracticeHubPoliciesPanel,
  useInstructorPracticeHubPolicy,
} from "@/components/instructor/InstructorPracticeHubPoliciesPanel"
import { ProjectListPaginationBar } from "@/components/project-list-pagination-bar"
import type { ProjectListPageSize } from "@/lib/pagination-ui"

type MenuTab = "topics" | "students" | "analytics" | "activity"

type ClassSessionOption = { id: number; code: string }

function dedupeClassSessions(
  rows: Array<{ id?: unknown; code?: unknown }> | undefined,
): ClassSessionOption[] {
  const seen = new Map<string, ClassSessionOption>()
  for (const row of rows ?? []) {
    const code = typeof row.code === "string" ? row.code.trim() : String(row.code ?? "").trim()
    if (!code) continue
    const id = Number(row.id)
    if (!Number.isFinite(id)) continue
    const norm = code.toUpperCase()
    if (!seen.has(norm)) {
      seen.set(norm, { id, code })
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.code.localeCompare(b.code))
}

interface TopicAvailability {
  [key: string]: { is_available: boolean; daily_limit: number; updated_at: string }
}

interface Topic {
  name: string
  question_count: number
  availability: TopicAvailability
}

interface StudentProgress {
  student_id: number
  student_name: string
  student_section: string
  total_attempts: number
  avg_score: number
  total_questions: number
  total_correct: number
  last_practiced: string
  topics_practiced: string[]
}

interface PracticeAnalytics {
  overview: {
    totalAttempts: number
    totalStudents: number
    avgScore: number
    totalTopics: number
    availableTopics: number
  }
  topicPerformance: Array<{
    topic: string
    attempts: number
    avgScore: number
    uniqueStudents: number
  }>
  recentActivity: Array<{
    student_name: string
    score: number
    totalQuestions: number
    correctAnswers: number
    timestamp: string
    topics: string[]
  }>
  dailyTrends: Array<{
    date: string
    attempts: number
    avgScore: number
  }>
  practiceBankAvailable?: boolean
  courseCode?: string
}

interface PracticeConfig {
  session: string
  dailyLimit: number
  difficultyDistribution: {
    easy: number
    medium: number
    hard: number
  }
  topicWeights: Record<string, number>
}

interface Stats {
  totalQuizzes: number
  activeQuizzes: number
  totalStudents: number
  activeUsers: number
  totalAttempts: number
  upcomingAssessments: number
}

const COLORS = ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#14b8a6", "#f97316"]

function getInstructorScopeHeaders(): HeadersInit {
  const instructorId = (typeof window !== "undefined" ? localStorage.getItem("instructorId") : null) || ""
  let courseId = ""
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("instructorSession") : null
    if (raw) {
      const s = JSON.parse(raw) as { selectedCourseId?: unknown }
      if (s.selectedCourseId != null && String(s.selectedCourseId).trim() !== "") {
        courseId = String(s.selectedCourseId)
      }
    }
  } catch {
    /* ignore */
  }
  const h: Record<string, string> = {}
  const iid = instructorId.trim()
  if (iid) h["x-instructor-id"] = iid
  if (courseId) h["x-course-id"] = courseId
  return h
}

export default function InstructorPracticeManagementPage({ embedInDashboard }: { embedInDashboard?: boolean } = {}) {
  const chrome = facultyEmbedChrome("practice")
  const fp = chrome.p
  const cardBase = chrome.card
  const router = useRouter()
  const { toast } = useToast()
  const [instructorId, setInstructorId] = useState<string | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [studentProgress, setStudentProgress] = useState<StudentProgress[]>([])
  const [analytics, setAnalytics] = useState<PracticeAnalytics | null>(null)
  const [practiceConfig, setPracticeConfig] = useState<PracticeConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<MenuTab>("topics")
  const [searchQuery, setSearchQuery] = useState("")
  const [topicSearchQuery, setTopicSearchQuery] = useState("")
  const [topicsPage, setTopicsPage] = useState(1)
  const [topicsPageSize, setTopicsPageSize] = useState<ProjectListPageSize>(12)
  const [selectedSession, setSelectedSession] = useState("ALL")
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<StudentProgress | null>(null)
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [newQuestionLimit, setNewQuestionLimit] = useState(10)
  const practiceHubPolicyState = useInstructorPracticeHubPolicy()
  const [viewMode, setViewMode] = useState<"list" | "card">("card")
  const [topicConfigDialogOpen, setTopicConfigDialogOpen] = useState(false)
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)
  const [topicDailyLimit, setTopicDailyLimit] = useState(10)
  const [studentViewMode, setStudentViewMode] = useState<"list" | "card">("card")
  const [selectedStudentSession, setSelectedStudentSession] = useState("ALL")
  const [selectedStudentTopic, setSelectedStudentTopic] = useState("ALL")
  const [studentReportDialogOpen, setStudentReportDialogOpen] = useState(false)
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<StudentProgress | null>(null)
  const [studentReportData, setStudentReportData] = useState<any>(null)
  const [sessions, setSessions] = useState<ClassSessionOption[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const { courseScopeVersion } = useInstructorDashboardV2()
  const [practiceBankAvailable, setPracticeBankAvailable] = useState(true)
  const [practiceBankNotice, setPracticeBankNotice] = useState<string | null>(null)

  useEffect(() => {
    void fetchSessions()
  }, [courseScopeVersion])

  const fetchSessions = async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/sessions", { headers: getInstructorScopeHeaders() })
      if (!response.ok) throw new Error("Failed to fetch sessions")
      const data = await response.json()
      setSessions(dedupeClassSessions(data.sessions))
    } catch (error) {
      console.error("[Practice Management] Failed to fetch sessions:", error)
      setSessions([])
    } finally {
      setLoadingSessions(false)
    }
  }

  useEffect(() => {
    const instructorSession = localStorage.getItem("instructorSession")
    if (!instructorSession) {
      router.push("/instructor/login")
      return
    }

    try {
      const parsedSession = JSON.parse(instructorSession) as { id?: unknown }
      if (parsedSession.id == null) {
        router.push("/instructor/login")
        return
      }
      setInstructorId(String(parsedSession.id))
    } catch {
      router.push("/instructor/login")
    }
  }, [router])

  useEffect(() => {
    if (!instructorId) return
    setLoading(false)
    void Promise.all([
      fetch("/api/setup/practice-tables", { method: "POST" }),
      fetch("/api/setup/instructor-notifications", { method: "POST" }),
    ]).catch((e) => console.error(e))
  }, [instructorId])

  useEffect(() => {
    if (!instructorId) return
    void Promise.all([
      fetchTopics(),
      fetchStudentProgress(),
      fetchAnalytics(),
      fetchPracticeConfig(),
    ]).catch(() => {})
  }, [instructorId, courseScopeVersion, selectedSession])

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchTopics(),
        fetchStudentProgress(),
        fetchAnalytics(),
        fetchPracticeConfig(),
      ])
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTopics = async () => {
    try {
      const response = await instructorApiFetch(
        `/api/instructor/practice/topics?session=${encodeURIComponent(selectedSession)}`,
        { headers: getInstructorScopeHeaders() },
      )
      if (response.ok) {
        const data = await response.json()
        setTopics(data.topics || [])
        if (data.practiceBankAvailable === false) {
          setPracticeBankAvailable(false)
          setPracticeBankNotice(typeof data.message === "string" ? data.message : null)
        } else {
          setPracticeBankAvailable(true)
          setPracticeBankNotice(null)
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error("Error fetching topics:", errorData)
        toast({
          title: "Error",
          description: `Failed to fetch topics: ${errorData.error || "Unknown error"}`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching topics:", error)
      toast({
        title: "Error",
        description: "Failed to fetch topics. Please check the console for details.",
        variant: "destructive",
      })
    }
  }

  const fetchStudentProgress = async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/practice/student-progress", {
        headers: getInstructorScopeHeaders(),
      })
      if (response.ok) {
        const data = await response.json()
        setStudentProgress(data.students || [])
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error("Error fetching student progress:", errorData)
        toast({
          title: "Error",
          description: `Failed to fetch student progress: ${errorData.error || "Unknown error"}`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching student progress:", error)
      toast({
        title: "Error",
        description: "Failed to fetch student progress. Please check the console for details.",
        variant: "destructive",
      })
    }
  }

  const fetchAnalytics = async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/practice/analytics", {
        headers: getInstructorScopeHeaders(),
      })
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data)
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error("Analytics fetch error:", errorData)
        toast({
          title: "Warning",
          description: "Could not load analytics data. Some features may be limited.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching analytics:", error)
      toast({
        title: "Warning",
        description: "Could not load analytics data. Some features may be limited.",
        variant: "destructive",
      })
    }
  }

  const fetchPracticeConfig = async () => {
    try {
      const response = await instructorApiFetch(`/api/practice/config?session=${selectedSession}`)
      if (response.ok) {
        const data = await response.json()
        setPracticeConfig(data.config ?? { numQuestions: data.numQuestions ?? 10 })
        if (data.numQuestions) setNewQuestionLimit(data.numQuestions)
      }
    } catch (error) {
      console.error("Error fetching practice config:", error)
    }
  }

  const savePracticeRules = async () => {
    try {
      const [configResponse, policyOk] = await Promise.all([
        instructorApiFetch("/api/instructor/practice/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session: selectedSession,
            dailyLimit: newQuestionLimit,
            difficultyDistribution: practiceConfig?.difficultyDistribution || { easy: 0.3, medium: 0.5, hard: 0.2 },
            topicWeights: practiceConfig?.topicWeights || {},
          }),
        }),
        practiceHubPolicyState.save(),
      ])

      if (configResponse.ok && policyOk) {
        toast({
          title: "Success",
          description: "Practice Hub rules saved",
        })
        setConfigDialogOpen(false)
        fetchPracticeConfig()
      } else {
        throw new Error("Failed to save practice rules")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save practice rules",
        variant: "destructive",
      })
    }
  }

  const toggleTopicAvailability = async (topicName: string, session: string, currentValue: boolean) => {
    try {
      const response = await instructorApiFetch("/api/instructor/practice/topics/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getInstructorScopeHeaders() as Record<string, string>),
        },
        body: JSON.stringify({
          topicName,
          session,
          isAvailable: !currentValue,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Topic ${!currentValue ? "enabled" : "disabled"} for ${session}`,
        })
        fetchTopics()
      } else {
        throw new Error("Failed to toggle topic availability")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update topic availability",
        variant: "destructive",
      })
    }
  }

  const configureTopic = (topic: Topic) => {
    const sessionAvailability = topic.availability[selectedSession]
    setSelectedTopic(topic)
    setTopicDailyLimit(sessionAvailability?.daily_limit || 10)
    setTopicConfigDialogOpen(true)
  }

  const updateTopicConfiguration = async () => {
    if (!selectedTopic) return

    try {
      const sessionAvailability = selectedTopic.availability[selectedSession]
      const response = await instructorApiFetch("/api/instructor/practice/topics/configure", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getInstructorScopeHeaders() as Record<string, string>),
        },
        body: JSON.stringify({
          topic: selectedTopic.name,
          session: selectedSession,
          daily_limit: topicDailyLimit,
          is_available: sessionAvailability?.is_available ?? true,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Topic "${selectedTopic.name}" configuration updated`,
        })
        setTopicConfigDialogOpen(false)
        setSelectedTopic(null)
        fetchTopics()
      } else {
        throw new Error("Failed to update topic configuration")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update topic configuration",
        variant: "destructive",
      })
    }
  }

  const removeTopicFromSession = async (topicName: string) => {
    if (!confirm(`Are you sure you want to remove "${topicName}" from session "${selectedSession}"? This will make it unavailable for students.`)) {
      return
    }

    try {
      const response = await instructorApiFetch(
        `/api/instructor/practice/topics/remove?topic=${encodeURIComponent(topicName)}&session=${encodeURIComponent(selectedSession)}`,
        {
          method: "DELETE",
          headers: getInstructorScopeHeaders(),
        },
      )

      if (response.ok) {
        toast({
          title: "Success",
          description: `Topic "${topicName}" removed from session "${selectedSession}"`,
        })
        fetchTopics()
      } else {
        throw new Error("Failed to remove topic")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove topic from session",
        variant: "destructive",
      })
    }
  }

  const resetStudentProgress = async (studentId: number) => {
    try {
      const response = await instructorApiFetch("/api/instructor/practice/reset-student", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getInstructorScopeHeaders() as Record<string, string>),
        },
        body: JSON.stringify({ studentId }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Student practice data has been reset",
        })
        setResetDialogOpen(false)
        setSelectedStudent(null)
        fetchStudentProgress()
        fetchAnalytics()
      } else {
        throw new Error("Failed to reset student data")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset student practice data",
        variant: "destructive",
      })
    }
  }

  const viewStudentReport = async (student: StudentProgress) => {
    try {
      setSelectedStudentForReport(student)
      setStudentReportDialogOpen(true)
      setStudentReportData(null)

      const response = await instructorApiFetch(
        `/api/instructor/practice/student-report?studentId=${encodeURIComponent(String(student.student_id))}`,
        { headers: getInstructorScopeHeaders() },
      )

      if (response.ok) {
        const data = await response.json()
        setStudentReportData(data)
      } else {
        const errorData = await response.json()
        console.error("Error fetching report:", errorData)
        toast({
          title: "Error",
          description: errorData.error || "Failed to load student report",
          variant: "destructive",
        })
        setStudentReportDialogOpen(false)
      }
    } catch (error) {
      console.error("Error loading report:", error)
      const msg = error instanceof Error ? error.message : "Unknown error"
      toast({
        title: "Error",
        description: `Failed to load student report: ${msg}`,
        variant: "destructive",
      })
      setStudentReportDialogOpen(false)
    }
  }

  const exportData = () => {
    const dataToExport = {
      topics,
      studentProgress,
      analytics,
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `practice-management-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "Success",
      description: "Practice data exported successfully",
    })
  }

  // Get all unique topics from question bank (not just practiced ones)
  const allTopicsFromQuestionBank = Array.from(
    new Set(topics.map(t => t.name))
  ).sort()
  
  // Also get topics that students have practiced (for reference)
  const studentTopics = allTopicsFromQuestionBank.length > 0 
    ? allTopicsFromQuestionBank 
    : Array.from(
        new Set(
          studentProgress.flatMap(s => s.topics_practiced || [])
        )
      ).sort()

  // Filter students by search, session, and topic
  const filteredStudents = studentProgress.filter((student) => {
    const matchesSearch = student.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.student_id.toString().includes(searchQuery)
    const matchesSession = selectedStudentSession === "ALL" || student.student_section === selectedStudentSession
    const matchesTopic = selectedStudentTopic === "ALL" || 
      (student.topics_practiced && student.topics_practiced.includes(selectedStudentTopic))
    
    return matchesSearch && matchesSession && matchesTopic
  })

  const filteredTopics = topics.filter((topic) =>
    topic.name.toLowerCase().includes(topicSearchQuery.trim().toLowerCase()),
  )

  useEffect(() => {
    setTopicsPage(1)
  }, [topicSearchQuery, selectedSession, viewMode, topicsPageSize])

  const topicsTotalPages = Math.max(1, Math.ceil(filteredTopics.length / topicsPageSize))
  const topicsPageClamped = Math.min(topicsPage, topicsTotalPages)

  const paginatedTopics = useMemo(() => {
    const start = (topicsPageClamped - 1) * topicsPageSize
    return filteredTopics.slice(start, start + topicsPageSize)
  }, [filteredTopics, topicsPageClamped, topicsPageSize])

  const menuItems = [
    { id: "topics" as const, label: "Topics", icon: Brain, badge: topics.length || undefined },
    {
      id: "students" as const,
      label: "Students",
      icon: Users,
      badge: studentProgress.length || undefined,
    },
    { id: "analytics" as const, label: "Analytics", icon: BarChart3 },
    { id: "activity" as const, label: "Activity", icon: Clock },
  ]

  const sessionFilterSelect = (
    <Select value={selectedSession} onValueChange={setSelectedSession} disabled={loadingSessions}>
      <SelectTrigger
        className={cn(
          facultyToolbarFilterButtonClass(selectedSession !== "ALL"),
          "h-9 w-[132px] shadow-none",
        )}
      >
        <SelectValue placeholder={loadingSessions ? "Loading…" : "Session"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem key="session-all" value="ALL">
          All sessions
        </SelectItem>
        {sessions.map((session) => (
          <SelectItem key={`session-${session.id}`} value={session.code}>
            {session.code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  const toolbarTrailing = (
    <>
      <Button variant="ghost" size="sm" onClick={exportData} className={cn("h-9 rounded-lg", chrome.outline)}>
        <Download className="h-4 w-4 mr-1.5" />
        Export
      </Button>
      <Button size="sm" onClick={() => setConfigDialogOpen(true)} className={cn("h-9 rounded-lg", PORTAL_CTA)}>
        <Settings className="h-4 w-4 mr-1.5" />
        Practice Rules
      </Button>
    </>
  )

  if (loading) {
    return (
      <div className={embedInDashboard ? "w-full min-w-0 py-8" : "container mx-auto px-6 py-8"}>
        <div className="flex items-center justify-center h-[min(420px,50vh)]">
          <div className="text-center">
            <div className={cn("animate-spin rounded-full h-10 w-10 border-2 border-t-transparent mx-auto mb-4", facultyModuleSpinnerClass("practice"))} />
            <p className={PORTAL_TEXT_MUTED}>Loading practice management…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={
        embedInDashboard
          ? "w-full min-w-0"
          : "w-full max-w-[min(100%,72rem)] mx-auto px-3 sm:px-4 md:px-5 py-3 sm:py-4 min-w-0"
      }
    >
      {!embedInDashboard && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => router.push("/instructor/dashboard")}
            className="border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all rounded-xl"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      )}

      {!practiceBankAvailable && practiceBankNotice && topics.length === 0 ? (
        <Alert className="rounded-2xl border-amber-200 bg-amber-50/95 text-amber-950 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-50">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Practice topics</AlertTitle>
          <AlertDescription>{practiceBankNotice}</AlertDescription>
        </Alert>
      ) : null}

      <FacultyModuleSplitLayout
        menu={
          <FacultyModuleSideMenu
            moduleId="practice"
            title="Practice"
            accent="theme"
            activeId={activeTab}
            onSelect={(id) => setActiveTab(id as MenuTab)}
            items={menuItems}
          />
        }
      >
        <div className="min-w-0 flex-1 space-y-4 sm:space-y-6">
          {activeTab === "topics" && (
            <div className="space-y-4">
              <FacultyIntegratedToolbar
                moduleId="practice"
                search={topicSearchQuery}
                onSearchChange={setTopicSearchQuery}
                onSearchClear={() => setTopicSearchQuery("")}
                searchPlaceholder="Search topics…"
                filters={sessionFilterSelect}
                viewMode={viewMode === "list" ? "list" : "grid"}
                onViewModeChange={(mode) => setViewMode(mode === "list" ? "list" : "card")}
                meta={
                  <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                    {filteredTopics.length === topics.length
                      ? `${topics.length} topics`
                      : `${filteredTopics.length} of ${topics.length} topics`}
                    {" · "}session {selectedSession === "ALL" ? "all" : selectedSession}
                  </p>
                }
                trailing={toolbarTrailing}
              />

              {filteredTopics.length === 0 ? (
                <div className={cn(cardBase, "p-8 text-center sm:p-10")}>
                  <div className={cn("mx-auto mb-3", chrome.iconBadge())}>
                    <Brain className="h-5 w-5 !text-white" />
                  </div>
                  <h4 className={cn("mb-1 font-semibold", PORTAL_TEXT)}>
                    {topics.length === 0 ? "No topics available" : "No matching topics"}
                  </h4>
                  <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
                    {topics.length === 0
                      ? "Add questions to the question bank first."
                      : "Try a different search term"}
                  </p>
                  {topics.length === 0 ? (
                    <Button onClick={fetchTopics} variant="outline" className="mt-4 rounded-xl">
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div
                  key={`topics-page-${topicsPageClamped}`}
                  className={
                    viewMode === "card"
                      ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
                      : cn(cardBase, "divide-y divide-[var(--border)] overflow-hidden")
                  }
                >
                  {paginatedTopics.map((topic, index) => {
                    const sessionAvailability = topic.availability[selectedSession]
                    const sessionKeys = Object.keys(topic.availability)
                    return (
                      <PracticeTopicCard
                        key={topic.name}
                        index={index}
                        layout={viewMode === "card" ? "card" : "list"}
                        name={topic.name}
                        questionCount={topic.question_count}
                        dailyLimit={sessionAvailability?.daily_limit || 10}
                        isAvailable={sessionAvailability?.is_available ?? true}
                        sessionLabel={selectedSession === "ALL" ? "All sessions" : `Session ${selectedSession}`}
                        enabledSessions={sessionKeys.filter((key) => topic.availability[key]?.is_available).length}
                        sessionCount={sessionKeys.length}
                        onToggle={() =>
                          toggleTopicAvailability(
                            topic.name,
                            selectedSession,
                            sessionAvailability?.is_available ?? true,
                          )
                        }
                        onSelect={() => configureTopic(topic)}
                      />
                    )
                  })}
                </div>
              )}

              {filteredTopics.length > 0 ? (
                <ProjectListPaginationBar
                  totalItems={filteredTopics.length}
                  page={topicsPage}
                  pageSize={topicsPageSize}
                  onPageChange={setTopicsPage}
                  onPageSizeChange={setTopicsPageSize}
                />
              ) : null}
            </div>
          )}

          {activeTab === "students" && (
            <div className="space-y-4">
              <FacultyIntegratedToolbar
                moduleId="practice"
                search={searchQuery}
                onSearchChange={setSearchQuery}
                onSearchClear={() => setSearchQuery("")}
                searchPlaceholder="Search students…"
                filters={
                  <>
                    <Select
                      value={selectedStudentSession}
                      onValueChange={setSelectedStudentSession}
                      disabled={loadingSessions}
                    >
                      <SelectTrigger
                        className={cn(
                          facultyToolbarFilterButtonClass(selectedStudentSession !== "ALL"),
                          "h-9 w-[120px] shadow-none",
                        )}
                      >
                        <SelectValue placeholder={loadingSessions ? "Loading…" : "Session"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem key="session-all" value="ALL">
                          All sessions
                        </SelectItem>
                        {sessions.map((session) => (
                          <SelectItem key={`session-${session.id}`} value={session.code}>
                            {session.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={selectedStudentTopic} onValueChange={setSelectedStudentTopic}>
                      <SelectTrigger
                        className={cn(
                          facultyToolbarFilterButtonClass(selectedStudentTopic !== "ALL"),
                          "h-9 w-[148px] shadow-none",
                        )}
                      >
                        <SelectValue placeholder="Topic" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All topics</SelectItem>
                        {studentTopics.map((topic) => (
                          <SelectItem key={topic} value={topic}>
                            {topic}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                }
                viewMode={studentViewMode === "list" ? "list" : "grid"}
                onViewModeChange={(mode) => setStudentViewMode(mode === "list" ? "list" : "card")}
                meta={
                  <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                    {filteredStudents.length} of {studentProgress.length} students
                  </p>
                }
                trailing={toolbarTrailing}
              />

              {filteredStudents.length === 0 ? (
                <div className={cn(cardBase, "p-8 text-center sm:p-10")}>
                  <div className={cn("mx-auto mb-3", chrome.iconBadge())}>
                    <Users className="h-5 w-5 !text-white" />
                  </div>
                  <h4 className={cn("mb-1 font-semibold", PORTAL_TEXT)}>No student data yet</h4>
                  <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
                    Progress appears here after students complete practice sessions.
                  </p>
                  <Button onClick={fetchStudentProgress} variant="outline" className="mt-4 rounded-xl">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              ) : (
                <div
                  className={
                    studentViewMode === "card"
                      ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
                      : cn(cardBase, "divide-y divide-[var(--border)] overflow-hidden")
                  }
                >
                  {filteredStudents.map((student, index) => (
                    <PracticeStudentCard
                      key={student.student_id}
                      index={index}
                      layout={studentViewMode === "card" ? "card" : "list"}
                      name={student.student_name}
                      section={student.student_section}
                      attempts={student.total_attempts}
                      avgScore={student.avg_score}
                      correct={student.total_correct}
                      total={student.total_questions}
                      lastPracticed={student.last_practiced}
                      onSelect={() => viewStudentReport(student)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="space-y-4">
              <FacultyIntegratedToolbar
                moduleId="practice"
                meta={
                  analytics ? (
                    <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                      {analytics.overview.totalAttempts} attempts · {analytics.overview.totalStudents} students ·{" "}
                      {analytics.overview.avgScore.toFixed(1)}% avg
                    </p>
                  ) : null
                }
                trailing={toolbarTrailing}
              />

              {analytics && analytics.overview.totalAttempts > 0 ? (
                <div className="space-y-4">
                  <PracticeAnalyticsCharts
                    topicPerformance={analytics.topicPerformance}
                    dailyTrends={analytics.dailyTrends}
                  />

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <section className="space-y-3">
                      <h3 className={cn("px-1 text-sm font-semibold", PORTAL_TEXT)}>Top topics</h3>
                      {analytics.topicPerformance
                        .filter((t) => t.attempts > 0)
                        .sort((a, b) => b.avgScore - a.avgScore)
                        .slice(0, 5)
                        .map((topic, index) => {
                          const stripe = portalListStripe(index, chrome.theme.family)
                          return (
                          <article
                            key={topic.topic}
                            className={cn("flex items-center gap-3 rounded-2xl border p-3", stripe.row, stripe.border)}
                          >
                            <span
                              className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold",
                                stripe.iconBg,
                                stripe.iconText,
                              )}
                            >
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className={cn("truncate text-sm font-medium", PORTAL_TEXT)}>{topic.topic}</p>
                              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                                {topic.attempts} attempts · {topic.uniqueStudents} students
                              </p>
                            </div>
                            <p className={cn("text-sm font-semibold tabular-nums", PORTAL_TEXT)}>
                              {topic.avgScore.toFixed(0)}%
                            </p>
                          </article>
                          )
                        })}
                    </section>
                    <section className="space-y-3">
                      <h3 className={cn("px-1 text-sm font-semibold", PORTAL_TEXT)}>Needs attention</h3>
                      {analytics.topicPerformance
                        .filter((t) => t.attempts > 0)
                        .sort((a, b) => a.avgScore - b.avgScore)
                        .slice(0, 5)
                        .map((topic, index) => {
                          const stripe = portalListStripe(index, chrome.theme.family)
                          return (
                          <article
                            key={topic.topic}
                            className={cn("flex items-center gap-3 rounded-2xl border p-3", stripe.row, stripe.border)}
                          >
                            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", stripe.iconBg)}>
                              <AlertCircle className={cn("h-4 w-4", stripe.iconText)} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={cn("truncate text-sm font-medium", PORTAL_TEXT)}>{topic.topic}</p>
                              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                                {topic.attempts} attempts · {topic.uniqueStudents} students
                              </p>
                            </div>
                            <p className={cn("text-sm font-semibold tabular-nums", PORTAL_TEXT)}>
                              {topic.avgScore.toFixed(0)}%
                            </p>
                          </article>
                          )
                        })}
                    </section>
                  </div>
                </div>
              ) : (
                <div className={cn(cardBase, "p-8 text-center sm:p-10")}>
                  <div className={cn("mx-auto mb-3", chrome.iconBadge())}>
                    <BarChart3 className="h-5 w-5 !text-white" />
                  </div>
                  <h4 className={cn("mb-1 font-semibold", PORTAL_TEXT)}>No analytics yet</h4>
                  <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
                    Charts appear after students start practice sessions.
                  </p>
                  <Button onClick={() => setActiveTab("topics")} className={cn("mt-4 rounded-xl", chrome.cta)}>
                    <Brain className="mr-2 h-4 w-4" />
                    Configure topics
                  </Button>
                </div>
              )}
            </div>
          )}

          {activeTab === "activity" && (
            <div className="space-y-4">
              <FacultyIntegratedToolbar
                moduleId="practice"
                meta={
                  analytics?.recentActivity?.length ? (
                    <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                      {analytics.recentActivity.length} recent sessions ·{" "}
                      {new Set(analytics.recentActivity.map((a) => a.student_name)).size} students
                    </p>
                  ) : (
                    <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>No recent activity yet</p>
                  )
                }
                trailing={toolbarTrailing}
              />

              {analytics?.recentActivity && analytics.recentActivity.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {analytics.recentActivity.slice(0, 20).map((activity, index) => (
                    <PracticeActivityCard
                      key={`${activity.student_name}-${activity.timestamp}-${index}`}
                      index={index}
                      studentName={activity.student_name}
                      topics={activity.topics}
                      timestamp={activity.timestamp}
                      score={activity.score}
                      correct={activity.correctAnswers}
                      total={activity.totalQuestions}
                    />
                  ))}
                </div>
              ) : (
                <div className={cn(cardBase, "p-8 text-center sm:p-10")}>
                  <div className={cn("mx-auto mb-3", chrome.iconBadge())}>
                    <Clock className="h-5 w-5 !text-white" />
                  </div>
                  <h4 className={cn("mb-1 font-semibold", PORTAL_TEXT)}>No recent activity</h4>
                  <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
                    Sessions appear here after students start practicing.
                  </p>
                  <Button onClick={() => setActiveTab("topics")} className={cn("mt-4 rounded-xl", chrome.cta)}>
                    <Brain className="mr-2 h-4 w-4" />
                    Configure topics
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </FacultyModuleSplitLayout>

      {/* Reset Student Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Reset Student Practice Data
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              Are you sure you want to reset all practice data for {selectedStudent?.student_name}? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-200">
                This will delete:
              </p>
              <ul className="text-sm text-red-700 dark:text-red-300 mt-2 space-y-1">
                <li>• All practice attempts</li>
                <li>• Practice answers and scores</li>
                <li>• Leaderboard position</li>
                <li>• Topic progress data</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedStudent && resetStudentProgress(selectedStudent.student_id)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Reset Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configure Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Settings className="h-5 w-5 text-blue-500" />
              Practice Hub Rules
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              Course-wide practice settings plus session topic defaults
            </DialogDescription>
          </DialogHeader>
          <InstructorPracticeHubPoliciesPanel
            bare
            showSaveButton={false}
            policyState={practiceHubPolicyState}
            headerSlot={
              <div className="space-y-4 pb-2">
                <div className="space-y-2">
                  <Label>Session topic default</Label>
                  <Select value={selectedSession} onValueChange={setSelectedSession} disabled={loadingSessions}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingSessions ? "Loading..." : "Select"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem key="session-all" value="ALL">
                        All sessions
                      </SelectItem>
                      {sessions.map((session) => (
                        <SelectItem key={`session-${session.id}`} value={session.code}>
                          {session.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Daily question limit (this session)</Label>
                  <Input
                    type="number"
                    value={newQuestionLimit}
                    onChange={(e) => setNewQuestionLimit(Number(e.target.value))}
                    min={1}
                    max={50}
                  />
                  <p className="text-sm text-muted-foreground">
                    Topic availability default for {selectedSession}. Membership tier caps still apply.
                  </p>
                </div>
              </div>
            }
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void savePracticeRules()} disabled={practiceHubPolicyState.saving}>
              <Settings className="h-4 w-4 mr-2" />
              Save rules
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Topic Configuration Dialog */}
      <Dialog open={topicConfigDialogOpen} onOpenChange={setTopicConfigDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Settings className="h-5 w-5 text-blue-500" />
              Configure Topic
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              Configure settings for "{selectedTopic?.name}" in session {selectedSession}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="topic-name">Topic Name</Label>
              <Input
                id="topic-name"
                value={selectedTopic?.name || ""}
                disabled
                className="rounded-xl bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="topic-session">Session</Label>
              <Input
                id="topic-session"
                value={selectedSession}
                disabled
                className="rounded-xl bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="daily-limit">Daily Question Limit</Label>
              <Input
                id="daily-limit"
                type="number"
                value={topicDailyLimit}
                onChange={(e) => setTopicDailyLimit(Number(e.target.value))}
                min="1"
                max="50"
                className="rounded-xl bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60"
              />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Maximum number of questions students can practice per day for this topic
              </p>
            </div>
            <div className="space-y-2">
              <Label>Availability Status</Label>
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <Switch
                  checked={selectedTopic?.availability[selectedSession]?.is_available ?? true}
                  onCheckedChange={(checked) => {
                    if (selectedTopic) {
                      setSelectedTopic({
                        ...selectedTopic,
                        availability: {
                          ...selectedTopic.availability,
                          [selectedSession]: {
                            ...selectedTopic.availability[selectedSession],
                            is_available: checked
                          }
                        }
                      })
                    }
                  }}
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {selectedTopic?.availability[selectedSession]?.is_available ? "Available for students" : "Not available for students"}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTopicConfigDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={updateTopicConfiguration}>
              <Settings className="h-4 w-4 mr-2" />
              Update Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Student Report Dialog */}
      <Dialog open={studentReportDialogOpen} onOpenChange={setStudentReportDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Users className="h-5 w-5 text-blue-500" />
              Student Practice Report
            </DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              Detailed practice report for {selectedStudentForReport?.student_name}
            </DialogDescription>
          </DialogHeader>
          
          {studentReportData ? (
            studentReportData.overallStats.totalAttempts === 0 ? (
              <div className="text-center py-12">
                <Users className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">No Practice Data</h3>
                <p className="text-slate-600 dark:text-slate-400">
                  This student hasn't completed any practice sessions yet.
                </p>
              </div>
            ) : (
            <div className="space-y-6 py-4">
              {/* Overall Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Attempts</div>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                    {studentReportData.overallStats.totalAttempts}
                  </div>
                </Card>
                <Card className="p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <div className="text-sm text-green-600 dark:text-green-400 font-medium">Total Questions</div>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">
                    {studentReportData.overallStats.totalQuestions}
                  </div>
                </Card>
                <Card className="p-4 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                  <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">Accuracy</div>
                  <div className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">
                    {studentReportData.overallStats.accuracy}%
                  </div>
                </Card>
                <Card className="p-4 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                  <div className="text-sm text-orange-600 dark:text-orange-400 font-medium">Average Score</div>
                  <div className="text-2xl font-bold text-orange-700 dark:text-orange-300 mt-1">
                    {studentReportData.overallStats.avgScore}%
                  </div>
                </Card>
              </div>

              {/* Leaderboard Position */}
              {studentReportData.leaderboard && (
                <Card className="p-4">
                  <h3 className="font-semibold text-lg mb-3 text-slate-900 dark:text-slate-100">Leaderboard Position</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">Rank</div>
                      <div className="text-xl font-bold text-slate-900 dark:text-slate-100">#{studentReportData.leaderboard.rank}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">XP</div>
                      <div className="text-xl font-bold text-slate-900 dark:text-slate-100">{studentReportData.leaderboard.xp}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">Level</div>
                      <div className="text-xl font-bold text-slate-900 dark:text-slate-100">{studentReportData.leaderboard.level}</div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Topic Performance */}
              {studentReportData.topicPerformance.length > 0 && (
                <Card className="p-4">
                  <h3 className="font-semibold text-lg mb-3 text-slate-900 dark:text-slate-100">Topic-wise Performance</h3>
                  <div className="space-y-3">
                    {studentReportData.topicPerformance.map((topic: any) => (
                      <div key={topic.topic} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div>
                          <div className="font-medium text-slate-900 dark:text-slate-100">{topic.topic}</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            {topic.correct_answers}/{topic.total_questions} correct
                          </div>
                        </div>
                        <Badge className={`${
                          topic.accuracy >= 80 ? "bg-green-500" :
                          topic.accuracy >= 60 ? "bg-yellow-500" : "bg-red-500"
                        } text-white rounded-full`}>
                          {topic.accuracy}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Recent Attempts */}
              <Card className="p-4">
                <h3 className="font-semibold text-lg mb-3 text-slate-900 dark:text-slate-100">Recent Practice Attempts</h3>
                <div className="space-y-2">
                  {studentReportData.attempts.slice(0, 5).map((attempt: any) => (
                    <div key={attempt.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {attempt.topics.join(", ")}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          {new Date(attempt.started_at).toLocaleString('en-US', { timeZone: 'America/Chicago' })} • {attempt.difficulty}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={`${
                          attempt.score_percentage >= 80 ? "bg-green-500" :
                          attempt.score_percentage >= 60 ? "bg-yellow-500" : "bg-red-500"
                        } text-white rounded-full`}>
                          {attempt.score_percentage}%
                        </Badge>
                        <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          {attempt.correct_answers}/{attempt.total_questions} correct
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            )
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className={cn("animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4", fp.spinner.replace("border-t-", "border-b-"))} />
                <p className="text-slate-600 dark:text-slate-400">Loading report...</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setStudentReportDialogOpen(false)
              setStudentReportData(null)
            }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}