"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ExtendSelfServiceClosedBanner } from "@/components/student/ExtendSelfServiceClosedBanner"
import { ModuleListSkeleton, StaleRefreshHint } from "@/components/data/module-list-skeleton"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"
import { StudentModuleHubLayout } from "@/components/student/dashboard-v2/StudentModuleHubLayout"
import { useAssessmentType } from "@/context/assessment-type-context"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import {
  portalViewOrganizerActiveClass,
  portalViewOrganizerContainerClass,
  portalViewOrganizerInactiveClass,
} from "@/lib/portal-module-themes"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"
import { cn } from "@/lib/utils"
import { LayoutGrid, Lightbulb, List, Search } from "lucide-react"
import type { QuizHubMeta } from "@/components/quiz-list"

const QuizList = dynamic(
  () => import("@/components/quiz-list").then((m) => ({ default: m.QuizList })),
  { ssr: false, loading: () => <ModulePageSkeleton className="min-h-[360px]" /> },
)

const QuizIssuesPanel = dynamic(
  () => import("@/components/quiz-issues-panel").then((m) => ({ default: m.QuizIssuesPanel })),
  { ssr: false, loading: () => <ModulePageSkeleton className="min-h-[240px]" /> },
)

const HUB_TITLE = {
  quiz: "Quizzes",
  homework: "Homework",
  mid_semester: "Mid-Semester",
  final: "Finals",
} as const

const HUB_MODULE_ID = {
  quiz: "quizzes",
  homework: "homework",
  mid_semester: "mid-semester-exams",
  final: "final-exams",
} as const

function persistKey(assessmentType: keyof typeof HUB_TITLE, suffix: string) {
  const slug =
    assessmentType === "mid_semester" ? "mid-semester" : assessmentType === "final" ? "final-exams" : assessmentType
  return `student-${slug}-${suffix}`
}

export function AssessmentHubDashboardV2() {
  const assessmentConfig = useAssessmentType()
  const assessmentType = assessmentConfig.assessmentType
  const moduleTheme = getStudentModuleTheme(HUB_MODULE_ID[assessmentType])
  const desktopChrome = isDesktopAppShell()

  const [listReady, setListReady] = useState(false)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const [hubMeta, setHubMeta] = useState<QuizHubMeta>({
    total: 0,
    official: 0,
    practice: 0,
    filtered: 0,
    openIssues: 0,
    closedIssues: 0,
  })

  const [viewMode, setViewMode] = usePersistedState<"grid" | "list">(persistKey(assessmentType, "view"), "list")
  const [searchQuery, setSearchQuery] = usePersistedState(persistKey(assessmentType, "search"), "")
  const [filterStatus, setFilterStatus] = usePersistedState<"all" | "active" | "completed" | "locked">(
    persistKey(assessmentType, "filter-status"),
    "all",
  )
  const [sortBy, setSortBy] = usePersistedState<"title" | "status" | "newest">(persistKey(assessmentType, "sort"), "title")

  const handleHubMetaChange = useCallback((meta: QuizHubMeta) => {
    setHubMeta((prev) => ({ ...prev, ...meta }))
    setListReady(true)
    setRefreshFailed(meta.refreshFailed ?? false)
  }, [])

  const handleIssueCountsChange = useCallback((open: number, closed: number) => {
    setHubMeta((prev) => ({ ...prev, openIssues: open, closedIssues: closed }))
  }, [])

  const showListSkeleton = !listReady

  const metaLine = useMemo(() => {
    const parts = [`${hubMeta.filtered} shown`]
    if (assessmentType === "quiz") {
      if (hubMeta.official > 0) parts.push(`${hubMeta.official} official`)
      if (hubMeta.practice > 0) parts.push(`${hubMeta.practice} practice`)
    }
    if (filterStatus !== "all") parts.push(`status: ${filterStatus}`)
    if (hubMeta.openIssues > 0) parts.push(`${hubMeta.openIssues} open issues`)
    return parts.join(" · ")
  }, [hubMeta, filterStatus, assessmentType])

  const searchLabel = assessmentConfig.pluralName.toLowerCase()

  const toolbar = (
    <>
      <div className="relative h-10 min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
        <Input
          placeholder={`Search ${searchLabel}…`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            "h-10 w-full pl-10 text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] shadow-none focus-visible:ring-1 focus-visible:ring-[var(--cc-accent)]/30",
            desktopChrome
              ? "rounded-full border-0 bg-[var(--sidebar-accent)]/50 focus-visible:bg-[var(--sidebar-accent)]/70"
              : "rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 focus-visible:border-[var(--cc-accent)]/40",
          )}
        />
      </div>
      <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
        <SelectTrigger className="h-10 w-[7.5rem] shrink-0 rounded-xl border-[var(--border)] bg-[var(--muted)]/40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="completed">Done</SelectItem>
          <SelectItem value="locked">Locked</SelectItem>
        </SelectContent>
      </Select>
      <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
        <SelectTrigger className="hidden h-10 w-[7rem] shrink-0 rounded-xl border-[var(--border)] bg-[var(--muted)]/40 sm:flex">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="title">Title A–Z</SelectItem>
          <SelectItem value="status">Status</SelectItem>
          <SelectItem value="newest">Newest</SelectItem>
        </SelectContent>
      </Select>
      <div className={portalViewOrganizerContainerClass()} role="group" aria-label="View organizer">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setViewMode("grid")}
          className={cn(
            "shadow-none",
            viewMode === "grid"
              ? portalViewOrganizerActiveClass(moduleTheme)
              : portalViewOrganizerInactiveClass(),
          )}
          aria-label="Grid view"
          aria-pressed={viewMode === "grid"}
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setViewMode("list")}
          className={cn(
            "shadow-none",
            viewMode === "list"
              ? portalViewOrganizerActiveClass(moduleTheme)
              : portalViewOrganizerInactiveClass(),
          )}
          aria-label="List view"
          aria-pressed={viewMode === "list"}
        >
          <List className="h-4 w-4" />
        </Button>
      </div>
    </>
  )

  const headerAction =
    assessmentType === "quiz" ? (
      <Button
        asChild
        className="h-9 shrink-0 rounded-xl border-0 px-3 shadow-none hover:opacity-90"
        style={{ backgroundColor: "var(--cc-accent)", color: "#fff" }}
      >
        <Link href="/student/dashboard-v2/practice">
          <Lightbulb className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Practice Hub</span>
        </Link>
      </Button>
    ) : null

  const footer =
    hubMeta.total > 0 ? (
      <p className="text-xs text-[var(--cc-text-muted)]">
        {assessmentConfig.pluralName} · {hubMeta.filtered} shown
        {assessmentType === "quiz" && hubMeta.practice > 0 ? (
          <>
            {" "}
            · More practice in{" "}
            <Link
              href="/student/dashboard-v2/practice"
              className="text-[var(--cc-accent)] underline underline-offset-2"
            >
              Practice Hub
            </Link>
          </>
        ) : null}
      </p>
    ) : null

  return (
    <>
      <StaleRefreshHint visible={refreshFailed} onRetry={() => setListReady(false)} />
      <ExtendSelfServiceClosedBanner />
      <StudentModuleHubLayout
        moduleId={HUB_MODULE_ID[assessmentType]}
        title={HUB_TITLE[assessmentType]}
        metaLine={metaLine}
        metaSuffix="start, continue, or review reports"
        headerAction={headerAction}
        toolbar={toolbar}
        hideSideMenu
        scrollMode="panel"
        footer={footer}
        menuView={HUB_MODULE_ID[assessmentType]}
        onMenuSelect={() => {}}
        menuItems={[]}
      >
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
          <div className="grid min-h-0 w-full min-w-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] xl:items-stretch xl:gap-5">
            <div className="flex min-h-0 min-w-0 flex-col">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--muted)]/25">
                {showListSkeleton ? <ModuleListSkeleton rows={6} className="min-h-[280px]" /> : null}
                <QuizList
                  assessmentType={assessmentType}
                  hubLayout
                  hubFilters={{
                    searchQuery,
                    filterType: "all",
                    filterStatus,
                    viewMode,
                    sortBy,
                  }}
                  onHubMetaChange={handleHubMetaChange}
                />
              </div>
            </div>
            <div className="@container/issues flex min-h-0 min-w-0 flex-col">
              <QuizIssuesPanel
                assessmentType={assessmentType}
                embedInDashboard
                onCountsChange={handleIssueCountsChange}
              />
            </div>
          </div>
        </div>
      </StudentModuleHubLayout>
    </>
  )
}
