"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  MessageSquare,
  Plus,
  CheckCircle2,
  FolderOpen,
  FileWarning,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ReportIssueModal } from "./report-issue-modal"
import { IssueDetailModal } from "./issue-detail-modal"
import { useAssessmentType, configForType } from "@/context/assessment-type-context"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { ctaInkOnFill, inkOnFillForMode } from "@/lib/appearance/chrome-ink"
import {
  chromeSwatchFromTokens,
  mixHex,
  themeChromeFamily,
} from "@/lib/appearance/module-chrome"
import { cn } from "@/lib/utils"
import { buildStudentScopedSearchParams } from "@/lib/student-session-ids"
import { studentModuleTabActiveClass } from "@/lib/student-module-themes"
import {
  EMBED_LIST,
  EMBED_LIST_TILE,
} from "@/components/student/dashboard-v2/embed-module-ui"

const ASSESSMENT_MODULE_ID: Record<string, string> = {
  quiz: "quizzes",
  homework: "homework",
  mid_semester: "mid-semester-exams",
  final: "final-exams",
}

interface Issue {
  id: number
  quiz_id: number
  quiz_title: string
  question_number: number | null
  description: string
  status: "open" | "closed"
  reporter_name: string
  reporter_id: string
  created_at: string
  comment_count: number
}

type IssuesChrome = {
  soft: string
  mid: string
  accent: string
  deep: string
  onMid: string
  onSoft: string
}

function IssueEmbedList({
  issues,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptySubtitle,
  onSelect,
  variant,
  chrome,
}: {
  issues: Issue[]
  emptyIcon: typeof FileWarning
  emptyTitle: string
  emptySubtitle: string
  onSelect: (issue: Issue) => void
  variant: "open" | "closed"
  chrome: IssuesChrome
}) {
  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div
          className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-[var(--cc-accent-soft)] text-[var(--cc-accent)]"
        >
          <EmptyIcon className="h-6 w-6 opacity-80" aria-hidden />
        </div>
        <p className="text-sm font-medium text-[var(--cc-text)]">{emptyTitle}</p>
        <p className="mt-1 text-xs text-[var(--cc-text-muted)]">{emptySubtitle}</p>
      </div>
    )
  }

  return (
    <div className={cn(EMBED_LIST, "max-h-[min(520px,60vh)] overflow-y-auto scrollbar-hide")}>
      {issues.map((issue) => (
        <button
          key={issue.id}
          type="button"
          onClick={() => onSelect(issue)}
          className={cn(EMBED_LIST_TILE, "w-full text-left")}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--cc-text)]">
                {issue.quiz_title}
              </p>
              {variant === "open" ? (
                <span className="shrink-0 text-[10px] font-medium" style={{ color: chrome.mid }}>
                  Open
                </span>
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              )}
            </div>
            <p className="line-clamp-2 text-xs leading-snug text-[var(--cc-text-muted)]">
              {issue.question_number ? `Q${issue.question_number}: ` : ""}
              {issue.description}
            </p>
            <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--cc-text-muted)]">
              <span className="truncate">by {issue.reporter_name}</span>
              <span className="inline-flex shrink-0 items-center gap-1">
                <MessageSquare className="h-3 w-3" aria-hidden />
                {issue.comment_count}
              </span>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

export function QuizIssuesPanel({
  assessmentType = "quiz",
  embedInDashboard = false,
}: {
  assessmentType?: string
  embedInDashboard?: boolean
}) {
  // Use context for colors and terminology (with fallback)
  let assessmentConfig
  try {
    assessmentConfig = useAssessmentType()
  } catch {
    // Fallback for pages without provider
    assessmentConfig = configForType("quiz")
  }

  const { themeId, tokens } = useAppearance()
  const issuesChrome = useMemo((): IssuesChrome => {
    // Purple brand themes (e.g. Apple Lavender): #533483 — violet companion to brand purple.
    const brandFamily = themeChromeFamily(themeId)
    const [soft, mid, accent, deep] =
      brandFamily === "purple"
        ? (() => {
            const violet = "#F5EAEA"
            if (tokens.isDark) {
              return [
                mixHex(violet, "#0B0F14", 0.62),
                mixHex(violet, "#FFFFFF", 0.18),
                mixHex(violet, "#FFFFFF", 0.28),
                violet,
              ] as const
            }
            return [
              mixHex(violet, "#FFFFFF", 0.9),
              violet,
              mixHex(violet, "#FFFFFF", 0.22),
              mixHex(violet, "#000000", 0.2),
            ] as const
          })()
        : chromeSwatchFromTokens(tokens, themeId)
    return {
      soft,
      mid,
      accent,
      deep,
      onMid: ctaInkOnFill(mid),
      onSoft: inkOnFillForMode(soft, Boolean(tokens.isDark), deep),
    }
  }, [themeId, tokens])

  const [issues, setIssues] = useState<Issue[]>([])
  const [selectedTab, setSelectedTab] = useState<"open" | "closed">("open")
  const [showReportModal, setShowReportModal] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [studentId, setStudentId] = useState("")
  const [closedCount, setClosedCount] = useState(0)
  const [openCount, setOpenCount] = useState(0)

  useEffect(() => {
    const id = sessionStorage.getItem("studentId")
    if (id) {
      setStudentId(id)
      fetchIssues(id)
      fetchIssueCounts(id)
    }
  }, [selectedTab, assessmentType])

  const fetchIssues = async (id: string) => {
    try {
      const params = buildStudentScopedSearchParams({
        status: selectedTab,
        studentId: id,
        assessmentType,
      })
      const res = await studentApiFetch(`/api/student/issues?${params}`)
      const data = await res.json()
      setIssues(data.issues || [])
    } catch (error) {
      // Failed to fetch issues
    }
  }

  const fetchIssueCounts = async (id: string) => {
    try {
      const [openRes, closedRes] = await Promise.all([
        fetch(
          `/api/student/issues?${buildStudentScopedSearchParams({
            status: "open",
            studentId: id,
            assessmentType,
          })}`,
        ),
        fetch(
          `/api/student/issues?${buildStudentScopedSearchParams({
            status: "closed",
            studentId: id,
            assessmentType,
          })}`,
        ),
      ])
      const openData = await openRes.json()
      const closedData = await closedRes.json()
      setOpenCount(openData.issues?.length || 0)
      setClosedCount(closedData.issues?.length || 0)
    } catch {
      // Failed to fetch issue counts
    }
  }

  const handleIssueSubmitted = () => {
    if (studentId) {
      fetchIssues(studentId)
      fetchIssueCounts(studentId)
    }
  }

  const closedTabCountClass = (active: boolean) =>
    cn(
      "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums leading-none",
      active
        ? "bg-white/25 text-white"
        : embedInDashboard
          ? "bg-slate-200/90 text-slate-600 dark:bg-white/10 dark:text-slate-300"
          : "bg-green-600 text-white",
    )

  const Wrapper = embedInDashboard ? "div" : Card
  const HeaderComp = embedInDashboard ? "div" : CardHeader
  const ContentComp = embedInDashboard ? "div" : CardContent
  const moduleTabActive = studentModuleTabActiveClass(ASSESSMENT_MODULE_ID[assessmentType] ?? "quizzes")

  if (embedInDashboard) {
    return (
      <>
        <div className="flex h-full flex-col rounded-xl border border-[var(--border)] bg-[var(--muted)]/25">
          <div className="border-b border-[var(--border)] px-3 py-3 sm:px-4">
            <div className="flex items-start gap-3">
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: "var(--cc-accent)", color: "#FFFFFF" }}
              >
                <MessageSquare className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 className="text-sm font-semibold text-[var(--cc-text)] sm:text-base">
                    Issues & Comments
                  </h3>
                  {openCount > 0 || closedCount > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[var(--cc-text-muted)]">
                      {openCount > 0 ? <span>{openCount} open</span> : null}
                      {closedCount > 0 ? <span>{closedCount} closed</span> : null}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">
                  Report problems or follow threads on {assessmentConfig.pluralName.toLowerCase()}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setShowReportModal(true)}
                className="h-9 shrink-0 gap-1 rounded-lg px-3 text-xs touch-manipulation hover:opacity-90 shadow-none border-0"
                style={{ backgroundColor: "var(--cc-accent)", color: "#FFFFFF" }}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="@[240px]/issues:inline hidden">Report</span>
              </Button>
            </div>
          </div>

          <div className="px-3 pb-3 pt-3 sm:px-4">
            <div
              className="mb-3 grid h-auto min-h-[40px] w-full min-w-0 grid-cols-2 gap-1 rounded-xl bg-[var(--muted)]/50 p-1 touch-manipulation"
              role="tablist"
              aria-label="Issue status"
            >
              <button
                type="button"
                role="tab"
                aria-selected={selectedTab === "open"}
                onClick={() => setSelectedTab("open")}
                className={cn(
                  "flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-all min-h-[36px] touch-manipulation sm:text-sm sm:px-3",
                  selectedTab === "open"
                    ? "bg-[var(--cc-accent)] text-white"
                    : "text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]",
                )}
              >
                <span className="shrink-0">Open</span>
                {openCount > 0 ? (
                  <span className={closedTabCountClass(selectedTab === "open")} aria-label={`${openCount} open`}>
                    {openCount}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={selectedTab === "closed"}
                onClick={() => setSelectedTab("closed")}
                className={cn(
                  "flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-all min-h-[36px] touch-manipulation sm:text-sm sm:px-3",
                  selectedTab === "closed"
                    ? "bg-[var(--cc-accent)] text-white"
                    : "text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]",
                )}
              >
                <span className="shrink-0">Closed</span>
                {closedCount > 0 ? (
                  <span className={closedTabCountClass(selectedTab === "closed")} aria-label={`${closedCount} closed`}>
                    {closedCount}
                  </span>
                ) : null}
              </button>
            </div>

            {selectedTab === "open" ? (
              <IssueEmbedList
                issues={issues}
                emptyIcon={FileWarning}
                emptyTitle="No open issues"
                emptySubtitle="All running smoothly!"
                onSelect={setSelectedIssue}
                variant="open"
                chrome={issuesChrome}
              />
            ) : (
              <IssueEmbedList
                issues={issues}
                emptyIcon={FolderOpen}
                emptyTitle="No closed issues"
                emptySubtitle="No resolved reports yet."
                onSelect={setSelectedIssue}
                variant="closed"
                chrome={issuesChrome}
              />
            )}
          </div>
        </div>

        {showReportModal ? (
          <ReportIssueModal
            onClose={() => setShowReportModal(false)}
            onSubmitted={handleIssueSubmitted}
            assessmentType={assessmentType}
          />
        ) : null}

        {selectedIssue ? (
          <IssueDetailModal
            issue={selectedIssue}
            onClose={() => setSelectedIssue(null)}
            onUpdated={handleIssueSubmitted}
          />
        ) : null}
      </>
    )
  }

  return (
    <>
      <Wrapper className={cn(
        "@container/issues h-full overflow-visible",
        !embedInDashboard && "border border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-xl sm:rounded-2xl"
      )}>
        <HeaderComp className={cn(
          "pb-3 sm:pb-4 border-b pt-0 sm:pt-0",
          embedInDashboard
            ? "border-slate-200/80 dark:border-white/10 px-0"
            : "border-slate-200/60 dark:border-slate-700/60 px-4 sm:px-6"
        )}>
          <div
            className={cn(
              embedInDashboard
                ? cn("rounded-xl border p-3", assessmentConfig.colors.cardBorder, assessmentConfig.colors.cardBg)
                : "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
            )}
          >
            <div
              className={cn(
                embedInDashboard
                  ? "flex items-center gap-3 min-w-0"
                  : "flex min-w-0 items-center gap-2 sm:gap-3",
              )}
            >
              <div className={cn(
                "flex size-9 sm:size-10 items-center justify-center rounded-xl shrink-0 shadow-sm",
                assessmentConfig.colors.iconBg,
                embedInDashboard && "ring-2 ring-white/80 dark:ring-white/10"
              )}>
                <MessageSquare className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <h3 className={cn(
                    "font-semibold text-slate-900 dark:text-white leading-tight",
                    embedInDashboard ? "text-sm sm:text-base" : "text-sm sm:text-lg",
                  )}>
                    Issues & Comments
                  </h3>
                  {embedInDashboard && (openCount > 0 || closedCount > 0) ? (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                      {openCount > 0 ? (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                          {openCount} open
                        </span>
                      ) : null}
                      {closedCount > 0 ? (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                          {closedCount} closed
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </div>
                <p className={cn(
                  "text-slate-500 dark:text-slate-400 line-clamp-2",
                  embedInDashboard ? "text-[11px] sm:text-xs mt-0.5" : "text-xs",
                )}>
                  {embedInDashboard
                    ? `Report problems or follow threads on ${assessmentConfig.pluralName.toLowerCase()}`
                    : `Report or discuss ${assessmentConfig.pluralName.toLowerCase()}`}
                </p>
              </div>
              {embedInDashboard ? (
                <Button
                  size="sm"
                  onClick={() => setShowReportModal(true)}
                  className={cn(
                    "gap-1 rounded-xl h-9 min-h-[36px] shrink-0 px-3 text-xs text-white touch-manipulation shadow-sm",
                    assessmentConfig.colors.gradient,
                    "hover:opacity-90",
                  )}
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className="@[240px]/issues:inline hidden">Report</span>
                </Button>
              ) : null}
            </div>
            {!embedInDashboard ? (
              <Button
                size="sm"
                onClick={() => setShowReportModal(true)}
                className={cn(
                  "gap-1.5 rounded-xl sm:rounded-2xl h-9 min-h-[36px] shrink-0 text-xs sm:text-sm px-3 sm:px-4 text-white touch-manipulation w-full sm:w-auto min-h-[44px]",
                  assessmentConfig.colors.gradient,
                  "hover:opacity-90",
                )}
              >
                <Plus className="h-4 w-4 shrink-0" />
                Report
              </Button>
            ) : null}
          </div>
        </HeaderComp>

        <ContentComp className={cn("p-4 sm:p-6", embedInDashboard && "px-3 pt-3 pb-4 sm:px-4")}>
          {/* Open / Closed filters — native buttons for reliable iPad touch */}
          <div
            className={cn(
              "grid grid-cols-2 w-full min-w-0 mb-4 sm:mb-6 rounded-xl sm:rounded-2xl p-1 touch-manipulation gap-1",
              embedInDashboard
                ? "h-auto min-h-[40px] bg-slate-100/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/10"
                : "overflow-hidden bg-slate-100/80 dark:bg-slate-700/80 rounded-full p-0.5 sm:p-1 h-11 sm:h-10 min-h-[44px]",
            )}
            role="tablist"
            aria-label="Issue status"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedTab === "open"}
              onClick={() => setSelectedTab("open")}
              className={cn(
                "flex min-w-0 items-center justify-center gap-1.5 text-xs sm:text-sm transition-all font-medium px-2 sm:px-3 py-1.5 min-h-[36px] touch-manipulation rounded-lg sm:rounded-xl",
                !embedInDashboard && "whitespace-nowrap",
                selectedTab === "open"
                  ? embedInDashboard
                    ? cn("shadow-sm", moduleTabActive)
                    : assessmentConfig.colors.gradient + " shadow-sm"
                  : embedInDashboard
                    ? "text-slate-500 dark:text-slate-400"
                    : "text-slate-700 dark:text-slate-300",
              )}
            >
              <span className="shrink-0">Open</span>
              {openCount > 0 && (
                <span
                  className={closedTabCountClass(selectedTab === "open")}
                  aria-label={`${openCount} open`}
                >
                  {openCount}
                </span>
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedTab === "closed"}
              onClick={() => setSelectedTab("closed")}
              className={cn(
                "flex min-w-0 items-center justify-center gap-1.5 text-xs sm:text-sm transition-all font-medium px-2 sm:px-3 py-1.5 min-h-[36px] touch-manipulation rounded-lg sm:rounded-xl",
                !embedInDashboard && "whitespace-nowrap",
                selectedTab === "closed"
                  ? embedInDashboard
                    ? cn("shadow-sm", moduleTabActive)
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  : embedInDashboard
                    ? "text-slate-500 dark:text-slate-400"
                    : "text-slate-700 dark:text-slate-300",
              )}
            >
              <span className="shrink-0">Closed</span>
              {closedCount > 0 && (
                <span
                  className={closedTabCountClass(selectedTab === "closed")}
                  aria-label={`${closedCount} closed`}
                >
                  {closedCount}
                </span>
              )}
            </button>
          </div>

          {selectedTab === "open" && (
            <div
              className="space-y-3 sm:space-y-4 max-h-[400px] sm:max-h-[500px] md:max-h-[580px] overflow-y-auto scrollbar-thin scrollbar-thumb-amber-500/50 dark:scrollbar-thumb-amber-500/70 scrollbar-track-transparent pr-1"
            >
              {issues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 sm:py-12 md:py-16 text-center text-slate-500 dark:text-slate-400">
                  <div className="p-3 sm:p-4 bg-slate-100/80 dark:bg-slate-700/80 rounded-xl sm:rounded-2xl mb-3 sm:mb-4">
                    <FileWarning className="h-6 w-6 sm:h-8 sm:w-8 opacity-50 dark:text-slate-500" />
                  </div>
                  <p className="text-xs sm:text-sm">No open issues</p>
                  <p className="text-[10px] sm:text-xs opacity-75 mt-1 px-2">
                    <span className="sm:hidden">All running smoothly!</span>
                    <span className="hidden sm:inline">All {assessmentConfig.pluralName.toLowerCase()} seem to be running smoothly!</span>
                  </p>
                </div>
              ) : (
                issues.map((issue) => (
                  <Card
                    key={issue.id}
                    className={cn(
                      "cursor-pointer rounded-xl transition-colors",
                      embedInDashboard ? "p-2.5 sm:p-3" : "p-3 sm:p-4",
                      embedInDashboard
                        ? "bg-slate-50/90 dark:bg-white/[0.04] ring-1 ring-slate-200/60 dark:ring-white/[0.08] hover:bg-slate-100/90 dark:hover:bg-white/[0.06] border-0 shadow-none"
                        : "border-l-4 border-l-amber-400/70 dark:border-l-amber-500/70 hover:border-amber-500/90 dark:hover:border-amber-400/90 hover:shadow-lg bg-white/80 dark:bg-slate-700/80 border border-slate-200/50 dark:border-slate-600/50 rounded-lg sm:rounded-xl"
                    )}
                    onClick={() => setSelectedIssue(issue)}
                  >
                    {embedInDashboard ? (
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate flex-1 min-w-0">
                            {issue.quiz_title}
                          </p>
                          <Badge
                            variant="outline"
                            className="shrink-0 rounded-full border-orange-400 text-orange-600 bg-orange-100/60 dark:border-orange-600 dark:text-orange-400 dark:bg-orange-900/30 text-[10px] px-1.5 py-0"
                          >
                            Open
                          </Badge>
                        </div>
                        <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-400 line-clamp-2 overflow-hidden">
                          {issue.question_number ? `Q${issue.question_number}: ` : ""}
                          {issue.description}
                        </p>
                        <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                          <span className="truncate">by {issue.reporter_name}</span>
                          <span className="inline-flex shrink-0 items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {issue.comment_count}
                          </span>
                        </div>
                      </div>
                    ) : (
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200 truncate">
                          {issue.quiz_title}
                        </p>
                        <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 line-clamp-2 sm:line-clamp-3 mt-1 break-words">
                          {issue.question_number ? `Q${issue.question_number}: ` : ""}
                          {issue.description}
                        </p>
                        <div className="flex flex-col sm:flex-row justify-between gap-1 sm:gap-0 mt-2 text-[10px] sm:text-xs text-slate-600 dark:text-slate-400">
                          <span className="truncate">by {issue.reporter_name}</span>
                          <span className="shrink-0">
                            {new Date(issue.created_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 items-end shrink-0">
                        <Badge
                          variant="outline"
                          className="text-amber-700 dark:text-amber-400 border-amber-300/50 dark:border-amber-700/50 shrink-0 rounded-full bg-amber-100/60 dark:bg-amber-900/30 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5"
                        >
                          <MessageSquare className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" /> {issue.comment_count}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] sm:text-xs shrink-0 rounded-full px-1.5 sm:px-2 py-0.5 ${
                            issue.status === "open"
                              ? "border-orange-400 text-orange-600 bg-orange-100/60 dark:border-orange-600 dark:text-orange-400 dark:bg-orange-900/30"
                              : "border-green-400 text-green-600 bg-green-100/60 dark:border-green-600 dark:text-green-400 dark:bg-green-900/30"
                          }`}
                        >
                          {issue.status === "open" ? "Open" : "Closed"}
                        </Badge>
                      </div>
                    </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          )}

          {selectedTab === "closed" && (
            <div
              className="space-y-3 sm:space-y-4 max-h-[400px] sm:max-h-[500px] md:max-h-[580px] overflow-y-auto scrollbar-thin scrollbar-thumb-emerald-500/40 dark:scrollbar-thumb-emerald-500/60 scrollbar-track-transparent pr-1"
            >
              {issues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 sm:py-12 md:py-16 text-center text-slate-500 dark:text-slate-400">
                  <div className="p-3 sm:p-4 bg-slate-100/80 dark:bg-slate-700/80 rounded-xl sm:rounded-2xl mb-3 sm:mb-4">
                    <FolderOpen className="h-6 w-6 sm:h-8 sm:w-8 opacity-50 dark:text-slate-500" />
                  </div>
                  <p className="text-xs sm:text-sm">No closed issues</p>
                  <p className="text-[10px] sm:text-xs opacity-75 mt-1">
                    <span className="sm:hidden">No resolved reports</span>
                    <span className="hidden sm:inline">No resolved reports yet.</span>
                  </p>
                </div>
              ) : (
                issues.map((issue) => (
                  <Card
                    key={issue.id}
                    className={cn(
                      "cursor-pointer rounded-xl transition-colors",
                      embedInDashboard ? "p-2.5 sm:p-3" : "p-3 sm:p-4",
                      embedInDashboard
                        ? "bg-slate-50/90 dark:bg-white/[0.04] ring-1 ring-slate-200/60 dark:ring-white/[0.08] hover:bg-slate-100/90 dark:hover:bg-white/[0.06] border-0 shadow-none"
                        : "border-l-4 border-l-emerald-400/70 dark:border-l-emerald-500/70 bg-white/80 dark:bg-slate-700/80 hover:shadow-lg border border-slate-200/50 dark:border-slate-600/50 rounded-lg sm:rounded-xl"
                    )}
                    onClick={() => setSelectedIssue(issue)}
                  >
                    {embedInDashboard ? (
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate flex-1 min-w-0">
                            {issue.quiz_title}
                          </p>
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                        </div>
                        <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-400 line-clamp-2 overflow-hidden">
                          {issue.question_number ? `Q${issue.question_number}: ` : ""}
                          {issue.description}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          Resolved{" "}
                          {new Date(issue.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    ) : (
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200 truncate">
                          {issue.quiz_title}
                        </p>
                        <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 line-clamp-2 sm:line-clamp-3 mt-1 break-words">
                          {issue.question_number ? `Q${issue.question_number}: ` : ""}
                          {issue.description}
                        </p>
                        <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 mt-2">
                          <span className="sm:hidden">Resolved {new Date(issue.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                          <span className="hidden sm:inline">
                            Resolved on{" "}
                            {new Date(issue.created_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </p>
                      </div>
                      <div className="flex flex-col gap-1 items-end shrink-0">
                        <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <Badge
                          variant="outline"
                          className="text-[10px] sm:text-xs shrink-0 rounded-full border-green-400 text-green-600 bg-green-100/60 dark:border-green-600 dark:text-green-400 dark:bg-green-900/30 px-1.5 sm:px-2 py-0.5"
                        >
                          Closed
                        </Badge>
                      </div>
                    </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          )}
        </ContentComp>
      </Wrapper>

      {/* Modals */}
      {showReportModal && (
        <ReportIssueModal 
          onClose={() => setShowReportModal(false)} 
          onSubmitted={handleIssueSubmitted}
          assessmentType={assessmentType}
        />
      )}

      {selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onUpdated={handleIssueSubmitted}
        />
      )}
    </>
  )
}
