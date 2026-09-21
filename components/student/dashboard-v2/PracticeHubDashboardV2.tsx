"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Target, Zap, AlertCircle, Search, Lock, Award, Grid3X3, List } from "lucide-react"
import { usePreventBack } from "@/hooks/use-prevent-back"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { useToast } from "@/hooks/use-toast"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { getStudentCourseIdFromSession } from "@/lib/student-session-ids"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import {
  isPracticeTopicLocked,
  practiceTopicProgressLabel,
  practiceTopicUnlockedCount,
  resolvePracticeSessionQuestionCount,
  type PracticeAccessClient,
} from "@/lib/practice-session-count"
import { usePracticeChrome } from "@/hooks/use-practice-chrome"
import { practiceChromeKpi } from "@/lib/practice-chrome-theme"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import { PracticeHubBrowseShell } from "@/components/student/dashboard-v2/PracticeHubBrowseShell"

interface TopicProgress {
  name: string
  questionCount: number
  unlockedCount?: number
  lockedCount?: number
  completed: number
  correct: number
  accuracy: number
  lastPracticed: string | null
}

interface PracticeConfig {
  numQuestions: number
  membershipTier?: string | null
  access?: PracticeAccessClient | null
  limits?: {
    fullTopicAccess?: boolean
  }
}

interface Badge {
  badge_type: string
  badge_name: string
  badge_description: string
  earned_at: string
}

interface RecentSession {
  id?: number
  topic: string
  score: number
  created_at: string
}

const DIFFICULTIES = ["easy", "medium", "hard", "mixed"] as const
const TOPICS_PER_PAGE_LIST = 8
const TOPICS_PER_PAGE_CARD = 6

export function PracticeHubDashboardV2() {
  const router = useRouter()
  const { toast } = useToast()
  const { roles, accent } = usePracticeChrome()
  usePreventBack("/student/login")

  const [studentId, setStudentId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const [topics, setTopics] = useState<TopicProgress[]>([])
  const [selectedTopic, setSelectedTopic] = usePersistedState<string | null>("student-practice-topic", null)
  const [difficulty, setDifficulty] = usePersistedState<(typeof DIFFICULTIES)[number]>(
    "student-practice-difficulty",
    "mixed",
  )
  const [topicSearch, setTopicSearch] = useState("")
  const [topicPage, setTopicPage] = useState(1)
  const [viewMode, setViewMode] = usePersistedState<"card" | "list">(
    "student-practice-topic-view",
    "card",
  )

  const [practiceConfig, setPracticeConfig] = useState<PracticeConfig>({ numQuestions: 10 })
  const [practiceAccess, setPracticeAccess] = useState<PracticeAccessClient | null>(null)
  const [membershipTier, setMembershipTier] = useState<string | null>(null)
  const [badges, setBadges] = useState<Badge[]>([])
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])

  const filteredTopics = useMemo(() => {
    const q = topicSearch.trim().toLowerCase()
    if (!q) return topics
    return topics.filter((t) => t.name.toLowerCase().includes(q))
  }, [topics, topicSearch])

  const topicsPerPage = viewMode === "card" ? TOPICS_PER_PAGE_CARD : TOPICS_PER_PAGE_LIST
  const totalTopicPages = Math.max(1, Math.ceil(filteredTopics.length / topicsPerPage))
  const safeTopicPage = Math.min(topicPage, totalTopicPages)

  const paginatedTopics = useMemo(() => {
    const start = (safeTopicPage - 1) * topicsPerPage
    return filteredTopics.slice(start, start + topicsPerPage)
  }, [filteredTopics, safeTopicPage, topicsPerPage])

  useEffect(() => {
    setTopicPage(1)
  }, [topicSearch, viewMode])

  useEffect(() => {
    if (topicPage > totalTopicPages) setTopicPage(totalTopicPages)
  }, [topicPage, totalTopicPages])

  useEffect(() => {
    const studentData = getStudentData()
    if (!studentData || !studentData.databaseId) {
      router.push("/student/login")
      return
    }

    const studentDbId = Number.parseInt(studentData.databaseId)
    const courseId = getStudentCourseIdFromSession()

    setStudentId(studentDbId)
    fetchTopicsWithProgress(studentDbId, studentData.section, courseId)
    fetchPracticeConfig(studentData.section, studentDbId, courseId)
    fetchLeaderboard(studentDbId, studentData.section, courseId)
    fetchRecentSessions(studentDbId)
  }, [router])

  const fetchTopicsWithProgress = async (
    studentDbId: number,
    session: string,
    courseId: number | null,
  ) => {
    try {
      const courseQs = courseId != null ? `&courseId=${courseId}` : ""
      const response = await studentApiFetch(
        `/api/practice/topics-progress?studentId=${studentDbId}&session=${encodeURIComponent(session)}${courseQs}`,
      )
      const data = await response.json()
      if (response.ok) {
        setTopics(data.topics || [])
        if (data.access) setPracticeAccess(data.access)
        if (data.membershipTier) setMembershipTier(data.membershipTier)
      } else {
        const err = await response.json().catch(() => ({}))
        console.error("Failed to fetch practice topics:", response.status, err)
        toast({
          title: "Could not load practice topics",
          description: String(err.error ?? "Sign in again or refresh the page."),
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to fetch topics:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPracticeConfig = async (
    session: string,
    studentDbId?: number,
    courseId?: number | null,
  ) => {
    try {
      const courseQs = courseId != null ? `&courseId=${courseId}` : ""
      const studentQs = studentDbId != null ? `&studentId=${studentDbId}` : ""
      const response = await studentApiFetch(
        `/api/practice/config?session=${encodeURIComponent(session)}${courseQs}${studentQs}`,
      )
      const data = await response.json()
      if (response.ok) {
        setPracticeConfig({
          numQuestions: data.numQuestions ?? 10,
          membershipTier: data.membershipTier ?? null,
          access: data.access ?? null,
          limits: data.limits ?? {},
        })
        if (data.access) setPracticeAccess(data.access)
        if (data.membershipTier) setMembershipTier(data.membershipTier)
      }
    } catch (error) {
      console.error("Failed to fetch practice config:", error)
    }
  }

  const fetchLeaderboard = async (
    studentDbId: number,
    session: string,
    courseId: number | null,
  ) => {
    try {
      const courseQs = courseId != null ? `&courseId=${courseId}` : ""
      const response = await studentApiFetch(
        `/api/practice/leaderboard?studentId=${studentDbId}&session=${encodeURIComponent(session)}&limit=100${courseQs}`,
      )
      const data = await response.json()
      if (response.ok) setBadges(data.badges || [])
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error)
    }
  }

  const fetchRecentSessions = async (studentDbId: number) => {
    try {
      const response = await studentApiFetch(`/api/practice/recent-sessions?studentId=${studentDbId}&limit=5`)
      const data = await response.json()
      if (response.ok) setRecentSessions(data.sessions || [])
    } catch (error) {
      console.error("Failed to fetch recent sessions:", error)
    }
  }

  const canStartPractice = practiceAccess?.canStartPractice !== false
  const membershipHref = "/student/dashboard-v2/membership"

  const handleStartPractice = async () => {
    if (!selectedTopic) {
      toast({
        title: "No topic selected",
        description: "Please select a topic to practice.",
        variant: "destructive",
      })
      return
    }

    if (!canStartPractice) {
      toast({
        title: "Practice locked",
        description: "Upgrade to Explorer or Trailblazer to start practice sessions.",
        variant: "destructive",
      })
      router.push(membershipHref)
      return
    }

    const selectedTopicData = topics.find((t) => t.name === selectedTopic)
    if (!selectedTopicData) return

    if (isPracticeTopicLocked(selectedTopicData, canStartPractice)) {
      toast({
        title: "Topic locked",
        description: "Upgrade your membership to unlock questions in this topic.",
        variant: "destructive",
      })
      router.push(membershipHref)
      return
    }

    const sessionCount = resolvePracticeSessionQuestionCount(
      selectedTopicData,
      practiceConfig.numQuestions,
    )
    const fullTopic =
      membershipTier === "Explorer" ||
      membershipTier === "Trailblazer" ||
      practiceConfig.limits?.fullTopicAccess === true ||
      practiceAccess?.level === "partial" ||
      practiceAccess?.level === "full"

    setGenerating(true)
    try {
      const response = await studentApiFetch("/api/practice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          topics: [selectedTopic],
          count: sessionCount,
          difficulty: difficulty === "mixed" ? undefined : difficulty,
          courseId: getStudentCourseIdFromSession(),
          fullTopic,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        if (data.reviewOnly) {
          toast({
            title: "Reviewing completed topic",
            description: "These questions are locked. Your previous answers and the correct answers are shown.",
          })
        } else if (fullTopic && Array.isArray(data.questions) && data.questions.length < sessionCount) {
          toast({
            title: "Fewer questions available",
            description: `Loaded ${data.questions.length} of ${sessionCount} requested — the unlocked pool may be nearly exhausted.`,
          })
        }
        sessionStorage.setItem("practiceReviewOnly", data.reviewOnly ? "1" : "0")
        sessionStorage.setItem("practiceAttemptId", data.attemptId != null ? String(data.attemptId) : "0")
        sessionStorage.setItem("practiceQuestions", JSON.stringify(data.questions))
        router.push("/student/dashboard-v2/practice/quiz")
      } else {
        toast({
          title: "Failed to generate practice",
          description: data.error || "Please try again.",
          variant: "destructive",
        })
      }
    } catch {
      toast({ title: "Error", description: "Failed to generate practice quiz.", variant: "destructive" })
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--muted)]/20">
        <div className="animate-pulse text-[var(--cc-text-muted)]">Loading Practice Hub…</div>
      </div>
    )
  }

  const selectedTopicData = topics.find((t) => t.name === selectedTopic)
  const selectedUnlocked = selectedTopicData ? practiceTopicUnlockedCount(selectedTopicData) : 0
  const selectedLocked =
    selectedTopicData != null
      ? (selectedTopicData.lockedCount ?? Math.max(0, selectedTopicData.questionCount - selectedUnlocked))
      : 0
  const selectedSessionCount = selectedTopicData
    ? resolvePracticeSessionQuestionCount(selectedTopicData, practiceConfig.numQuestions)
    : practiceConfig.numQuestions
  const selectedTopicLocked = selectedTopicData
    ? isPracticeTopicLocked(selectedTopicData, canStartPractice)
    : !canStartPractice
  const selectedPoolComplete =
    selectedTopicData != null && selectedUnlocked > 0 && selectedTopicData.completed >= selectedUnlocked

  return (
    <PracticeHubBrowseShell
      menuWidthClass="lg:w-52"
      counts={{
        topics: topics.length,
        sessions: recentSessions.length,
        badges: badges.length,
      }}
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
          <div className="flex min-w-0 items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
                Topics
              </p>
              <p className="mt-0.5 truncate text-sm text-[var(--cc-text)]">
                {filteredTopics.length} topic{filteredTopics.length === 1 ? "" : "s"}
                {totalTopicPages > 1 ? (
                  <span className="text-[var(--cc-text-muted)]">
                    {" "}
                    · page {safeTopicPage} of {totalTopicPages}
                  </span>
                ) : null}
                <span className="text-[var(--cc-text-muted)]">
                  {selectedTopic ? ` · ${selectedTopic}` : " · pick a topic"}
                  {selectedTopicData ? ` · ${selectedSessionCount} questions` : ""}
                </span>
              </p>
            </div>
            <div className="inline-flex h-9 shrink-0 items-stretch rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-0.5">
              <button
                type="button"
                aria-label="Card view"
                onClick={() => setViewMode("card")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg",
                  viewMode === "card"
                    ? "bg-[var(--cc-accent)] text-white"
                    : "text-[var(--cc-text-muted)]",
                )}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="List view"
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg",
                  viewMode === "list"
                    ? "bg-[var(--cc-accent)] text-white"
                    : "text-[var(--cc-text-muted)]",
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="relative h-10 min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
            <input
              type="search"
              value={topicSearch}
              onChange={(event) => setTopicSearch(event.target.value)}
              placeholder="Search topics…"
              className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 pl-10 pr-3 text-sm text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] outline-none focus:border-[var(--cc-accent)]/40"
            />
          </div>
        </div>

        {!canStartPractice ? (
          <Alert className="border-0 bg-[var(--muted)]/30">
            <Lock className="h-4 w-4" style={{ color: accent }} />
            <AlertTitle>Practice requires Explorer+</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span>Upgrade to unlock Practice Hub topics and sessions.</span>
              <Button
                size="sm"
                className="w-fit rounded-xl border-0 shadow-none hover:opacity-90"
                style={{ backgroundColor: roles.cta.fill, color: roles.cta.icon }}
                onClick={() => router.push(membershipHref)}
              >
                View plans
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {topics.length === 0 ? (
          <Alert className="border-0 bg-[var(--muted)]/30">
            <AlertCircle className="h-4 w-4" style={{ color: accent }} />
            <AlertTitle>No topics available</AlertTitle>
            <AlertDescription>Check back when your instructor publishes practice topics.</AlertDescription>
          </Alert>
        ) : null}

        {filteredTopics.length === 0 && topicSearch.trim() ? (
          <p className="py-6 text-center text-sm text-[var(--cc-text-muted)]">
            No topics match “{topicSearch.trim()}”
          </p>
        ) : (
          <>
            <div
              className={cn(
                "min-h-0",
                viewMode === "card"
                  ? "grid grid-cols-1 gap-2 sm:grid-cols-2"
                  : "flex flex-col gap-2",
              )}
            >
              {paginatedTopics.map((topic, index) => {
              const globalIndex = (safeTopicPage - 1) * topicsPerPage + index
              const unlocked = practiceTopicUnlockedCount(topic)
              const topicLocked = isPracticeTopicLocked(topic, canStartPractice)
              const poolComplete = unlocked > 0 && topic.completed >= unlocked
              const progressDenom = Math.max(1, unlocked)
              const isSelected = selectedTopic === topic.name && !topicLocked
              const thumb = topicLocked
                ? roles.topicLocked
                : isSelected
                  ? roles.topicSelected
                  : poolComplete
                    ? roles.topicDone
                    : practiceChromeKpi(globalIndex, roles)
              const TopicIcon = topicLocked ? Lock : poolComplete ? Award : Target

              return (
                <button
                  key={topic.name}
                  type="button"
                  onClick={() => {
                    if (topicLocked) {
                      toast({
                        title: "Topic locked",
                        description: "Upgrade your membership to unlock this topic.",
                        variant: "destructive",
                      })
                      return
                    }
                    setSelectedTopic(topic.name)
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-left transition-colors",
                    topicLocked ? "cursor-not-allowed opacity-70" : "hover:bg-[var(--muted)]/30",
                    isSelected &&
                      "border-[color-mix(in_srgb,var(--cc-accent)_35%,var(--border))] bg-[var(--cc-accent-soft)]",
                    viewMode === "card" ? "min-h-[108px] p-3.5" : "h-[88px] px-3 py-2.5",
                  )}
                >
                  <SolidListThumbTile thumb={thumb} icon={TopicIcon} size="compact" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--cc-text)]">{topic.name}</p>
                    <p className="mt-0.5 truncate text-xs text-[var(--cc-text-muted)]">
                      {practiceTopicProgressLabel(topic)} · {topic.accuracy.toFixed(0)}% accuracy
                    </p>
                    {viewMode === "card" ? (
                      <Progress
                        value={(topic.completed / progressDenom) * 100}
                        className="mt-2 h-1.5"
                      />
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-[var(--cc-text-muted)]">
                    {topic.completed}/{unlocked}
                  </span>
                </button>
              )
            })}
            </div>

            {filteredTopics.length > topicsPerPage ? (
              <div className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <p className="text-center text-xs text-[var(--cc-text-muted)] sm:text-left">
                  Showing {(safeTopicPage - 1) * topicsPerPage + 1}–
                  {Math.min(safeTopicPage * topicsPerPage, filteredTopics.length)} of{" "}
                  {filteredTopics.length}
                </p>
                <Pagination className="mx-0 w-auto justify-center sm:justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(event) => {
                          event.preventDefault()
                          if (safeTopicPage > 1) setTopicPage(safeTopicPage - 1)
                        }}
                        className={
                          safeTopicPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
                        }
                        aria-disabled={safeTopicPage <= 1}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalTopicPages }, (_, i) => i + 1).map((page) => (
                      <PaginationItem key={page} className="hidden sm:list-item">
                        <PaginationLink
                          href="#"
                          onClick={(event) => {
                            event.preventDefault()
                            setTopicPage(page)
                          }}
                          isActive={safeTopicPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(event) => {
                          event.preventDefault()
                          if (safeTopicPage < totalTopicPages) setTopicPage(safeTopicPage + 1)
                        }}
                        className={
                          safeTopicPage >= totalTopicPages
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                        aria-disabled={safeTopicPage >= totalTopicPages}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            ) : null}
          </>
        )}

        <div className="sticky bottom-0 z-10 flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 sm:flex-row sm:items-center sm:p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--cc-text)]">
              {selectedTopic ?? "Select a topic"}
            </p>
            <p className="text-xs text-[var(--cc-text-muted)]">
              {selectedTopicData
                ? `${selectedSessionCount} questions${selectedLocked > 0 ? ` · ${selectedUnlocked} unlocked` : ""}`
                : "Difficulty applies to the next session"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {DIFFICULTIES.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setDifficulty(level)}
                className="rounded-full px-3 py-1 text-xs font-medium capitalize"
                style={
                  difficulty === level
                    ? { backgroundColor: "var(--cc-accent-soft)", color: "var(--cc-text)" }
                    : { backgroundColor: "var(--muted)", color: "var(--cc-text-muted)" }
                }
              >
                {level}
              </button>
            ))}
          </div>
          {selectedTopicLocked ? (
            <Button
              onClick={() => router.push(membershipHref)}
              className="h-10 shrink-0 rounded-xl border-0 shadow-none hover:opacity-90"
              style={{ backgroundColor: roles.cta.fill, color: roles.cta.icon }}
            >
              <Lock className="mr-1.5 h-4 w-4" />
              Upgrade
            </Button>
          ) : (
            <Button
              onClick={() => void handleStartPractice()}
              disabled={generating || !selectedTopic}
              className="h-10 shrink-0 rounded-xl border-0 shadow-none hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: roles.cta.fill, color: roles.cta.icon }}
            >
              {generating ? (
                <Zap className="mr-1.5 h-4 w-4 animate-pulse" />
              ) : (
                <Zap className="mr-1.5 h-4 w-4" />
              )}
              {generating ? "Generating…" : selectedPoolComplete ? "Review" : "Start"}
            </Button>
          )}
        </div>
      </div>
    </PracticeHubBrowseShell>
  )
}
