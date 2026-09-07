"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Search, Loader2, Sparkles, SlidersHorizontal, LayoutGrid, List } from "lucide-react"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import {
  portalViewOrganizerActiveClass,
  portalViewOrganizerContainerClass,
  portalViewOrganizerInactiveClass,
} from "@/lib/portal-module-themes"
import { cn } from "@/lib/utils"
import { LectureAiNotesPanel } from "@/components/lecture-ai-notes-panel"
import {
  StudentLectureListCard,
  StudentLectureListCardActions,
} from "@/components/student/lectures/student-lecture-list-card"
import { resolveLectureCardKind } from "@/lib/lecture-list-utils"
import {
  getStudentData,
  patchStudentSessionSection,
  getStudentAuthHeaders,
  resolveStudentDatabaseId,
  studentApiFetch,
} from "@/lib/auth"
import { canonicalSessionCode } from "@/lib/session-code-aliases"
import { studentSessionBadgeLabel } from "@/lib/course-section-model"
import { buildStudentLectureViewerHref } from "@/lib/student-lecture-viewer-path"
import {
  LECTURE_FILTER_OPTIONS,
  matchesLectureFilter,
  type LectureFilter,
} from "@/lib/lecture-list-utils"
import { useNotificationModuleRefresh } from "@/lib/notification-module-refresh"
import { useLectureChrome } from "@/hooks/use-lecture-chrome"
import {
  DesktopChromeTitle,
  DesktopChromeTitleActions,
} from "@/components/desktop/DesktopLangSmithChrome"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"
import { useStudentLecturesQuery } from "@/hooks/data/use-student-lectures-query"
import { ModuleListSkeleton, StaleRefreshHint } from "@/components/data/module-list-skeleton"
import { formatLectureIndexLabel } from "@/lib/lecture-index-label"

interface Lecture {
  id: number
  week: number
  title: string
  session: string
  description: string
  materials_url: string | null
  created_at: string
  status?: "not_started" | "in_progress" | "completed" | "Available" | "Pending" | "Completed"
  progress_percentage?: number
}

function isBenignNetworkError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") return true
  if (error instanceof Error && error.name === "AbortError") return true
  return error instanceof TypeError
}


function displayLectureTitle(title: string | null | undefined) {
  return String(title ?? "")
    .replace(/^ECE\s*2202:\s*Circuit Analysis II\s*[—–-]\s*/i, "")
    .replace(/^ELEG\s*130X:\s*Lecture\s+\d+\s*[—–-]\s*/i, "")
    .replace(/^Lecture\s+(\d+):\s*/i, "Lecture $1 · ")
    .trim()
}

export function LecturesDashboardV2() {
  const router = useRouter()
  const { toast } = useToast()
  const { roles } = useLectureChrome()
  const [studentId, setStudentId] = useState<string | null>(() => resolveStudentDatabaseId())
  const [studentSession, setStudentSession] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<LectureFilter>("all")
  const [showStatusFilter, setShowStatusFilter] = useState(false)
  const lecturesQuery = useStudentLecturesQuery(studentId)
  const lectures = lecturesQuery.lectures as Lecture[]
  const bookmarkedLectures = lecturesQuery.bookmarks
  const reminders = lecturesQuery.reminders
  const loading = Boolean(studentId) && lecturesQuery.isLoading
  const [showAiNotes, setShowAiNotes] = useState(false)
  const [courseCode, setCourseCode] = useState<string | null>(null)
  const [viewMode, setViewMode] = usePersistedState<"list" | "grid">("student-lecture-view", "list")
  const lecturesTheme = getStudentModuleTheme("lectures")


  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    ;(async () => {
      const stored = getStudentData()
      const id =
        resolveStudentDatabaseId() ??
        stored?.databaseId ??
        sessionStorage.getItem("studentDatabaseId")
      if (!id) return

      let session = stored?.section ?? sessionStorage.getItem("studentSection")
      let code = stored?.courseCode ?? null

      try {
        const res = await studentApiFetch(`/api/student/info?student_id=${encodeURIComponent(id)}`, {
          headers: getStudentAuthHeaders(),
        })
        if (res.ok) {
          const info = await res.json()
          const dbSection = info.student?.section as string | undefined
          const dbCourseCode = info.student?.course_code as string | undefined
          if (dbSection) {
            session = patchStudentSessionSection(dbSection, dbCourseCode)
            code = dbCourseCode ?? code
          }
        }
      } catch {
        /* use cached session */
      }

      const canonical = session ? canonicalSessionCode(session) : null
      if (cancelled || !canonical) return

      setStudentId(id)
      setStudentSession(canonical)
      setCourseCode(code)
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  const refreshLecturesHub = useCallback(async () => {
    lecturesQuery.refetch()
  }, [lecturesQuery])

  useNotificationModuleRefresh("lectures", refreshLecturesHub)

  const sessionBadge = studentSessionBadgeLabel(courseCode, studentSession)

  const toggleBookmark = async (lectureId: number) => {
    if (!studentId) return
    const isBookmarked = bookmarkedLectures.has(lectureId)
    try {
      await lecturesQuery.toggleBookmark.mutateAsync(lectureId)
      toast({ title: isBookmarked ? "Bookmark removed" : "Lecture bookmarked" })
    } catch (error) {
      console.error("Failed to toggle bookmark:", error)
    }
  }

  const setReminder = async (lectureId: number) => {
    if (!studentId) return
    try {
      await lecturesQuery.addReminder.mutateAsync(lectureId)
      toast({ title: "Reminder set" })
    } catch (error) {
      console.error("Failed to set reminder:", error)
    }
  }

  const openSlidesViewer = (lecture: Lecture) => {
    const href = buildStudentLectureViewerHref(lecture.id, lecture.week)
    if (href === "/student/dashboard-v2/lectures") {
      toast({
        title: "Cannot open lecture",
        description: "This lecture is missing a valid week or id.",
        variant: "destructive",
      })
      return
    }
    router.push(href)
  }

  const sortedLectures = [...lectures].sort((a, b) => a.week - b.week)
  const filteredLectures = sortedLectures.filter((lecture) => {
    if (!matchesLectureFilter(lecture, statusFilter)) return false
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      String(lecture.title ?? "").toLowerCase().includes(query) ||
      String(lecture.description ?? "").toLowerCase().includes(query) ||
      `week ${lecture.week}`.includes(query)
    )
  })

  const completedCount = lectures.filter((l) => resolveLectureCardKind(l) === "completed").length
  const inProgressCount = lectures.filter((l) => resolveLectureCardKind(l) === "in_progress").length
  const progressPct = lectures.length ? Math.round((completedCount / lectures.length) * 100) : 0
  const desktopChrome = isDesktopAppShell()
  const progressMeta = [
    `${progressPct}% complete`,
    `${completedCount} of ${lectures.length}`,
    inProgressCount > 0 ? `${inProgressCount} in progress` : null,
    sessionBadge || null,
  ]
    .filter(Boolean)
    .join(" · ")
  const openAiNotes = useCallback(() => setShowAiNotes(true), [])

  const desktopChromeSlots = desktopChrome ? (
    <>
      <DesktopChromeTitle>
        <div className="flex min-w-0 items-center gap-1.5">
          <h1 className="shrink-0 truncate text-[16px] font-semibold tracking-tight">Lectures</h1>
          <span className="shrink-0 text-[12px] text-[#6b7280] dark:text-[#9ca3af]" aria-hidden>
            ·
          </span>
          <p className="min-w-0 truncate text-[12px] leading-4 text-[#6b7280] dark:text-[#9ca3af]">
            {progressMeta}
          </p>
        </div>
      </DesktopChromeTitle>
      <DesktopChromeTitleActions>
        <Button
          className="h-9 shrink-0 rounded-xl border-0 px-3 shadow-none hover:opacity-90"
          style={{ backgroundColor: roles.aiNotes.fill, color: roles.aiNotes.icon }}
          onClick={openAiNotes}
        >
          <Sparkles className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">AI Notes</span>
        </Button>
      </DesktopChromeTitleActions>
    </>
  ) : null

  if (loading) {
    return (
      <>
        {desktopChromeSlots}
        <div className="border-t border-[color-mix(in_srgb,var(--cc-text)_10%,transparent)] pt-3 sm:pt-4">
          <ModuleListSkeleton rows={6} className="min-h-[280px]" />
        </div>
      </>
    )
  }


  return (
    <div className="flex w-full min-w-0 flex-col gap-3 border-t border-[color-mix(in_srgb,var(--cc-text)_10%,transparent)] pt-3 sm:pt-4">
      <StaleRefreshHint visible={lecturesQuery.refreshFailed} onRetry={() => lecturesQuery.refetch()} />
      <div
        className={cn(
          "flex min-w-0 flex-col gap-3",
          desktopChrome
            ? "border-0 bg-transparent p-0"
            : "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4",
        )}
      >
        {desktopChrome ? (
          desktopChromeSlots
        ) : (
          <div className="flex min-w-0 items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
                Lectures
              </p>
              <p className="mt-0.5 truncate text-sm text-[var(--cc-text)]">
                {progressPct}% complete
                <span className="text-[var(--cc-text-muted)]">
                  {" "}
                  · {completedCount} of {lectures.length}
                  {inProgressCount > 0 ? ` · ${inProgressCount} in progress` : ""}
                  {sessionBadge ? ` · ${sessionBadge}` : ""}
                </span>
              </p>
            </div>
            <Button
              className="h-9 shrink-0 rounded-xl border-0 px-3 shadow-none hover:opacity-90"
              style={{ backgroundColor: roles.aiNotes.fill, color: roles.aiNotes.icon }}
              onClick={openAiNotes}
            >
              <Sparkles className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">AI Notes</span>
            </Button>
          </div>
        )}

        {desktopChrome ? null : (
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
            <div
              className="h-full rounded-full"
              style={{ width: `${progressPct}%`, backgroundColor: roles.progress.fill }}
            />
          </div>
        )}

        <div className="flex min-w-0 items-center gap-2">
          <div className="relative h-10 min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
            <Input
              placeholder="Search lectures..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-full border-0 bg-[var(--sidebar-accent)]/50 pl-10 text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] shadow-none focus-visible:bg-[var(--sidebar-accent)]/70 focus-visible:ring-1 focus-visible:ring-[var(--cc-accent)]/30"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-10 w-10 shrink-0 rounded-full p-0"
            style={{
              backgroundColor: statusFilter !== "all" ? roles.filter.fill : "transparent",
              color: statusFilter !== "all" ? roles.filter.icon : undefined,
            }}
            onClick={() => setShowStatusFilter((open) => !open)}
            aria-label="Filter lectures by progress"
            aria-expanded={showStatusFilter}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <div className={portalViewOrganizerContainerClass()} role="group" aria-label="View organizer">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setViewMode("grid")}
              className={cn(
                "shadow-none",
                viewMode === "grid"
                  ? portalViewOrganizerActiveClass(lecturesTheme)
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
                  ? portalViewOrganizerActiveClass(lecturesTheme)
                  : portalViewOrganizerInactiveClass(),
              )}
              aria-label="List view"
              aria-pressed={viewMode === "list"}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showStatusFilter ? (
          <div className="flex flex-wrap gap-2">
            {LECTURE_FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={
                  statusFilter === option.value
                    ? { backgroundColor: roles.cta.fill, color: roles.cta.icon }
                    : { backgroundColor: "var(--muted)", color: "var(--cc-text-muted)" }
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div
        className={
          viewMode === "grid"
            ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
            : "flex flex-col gap-2"
        }
      >
        {filteredLectures.length === 0 ? (
          <p className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-8 text-center text-sm text-[var(--cc-text-muted)] sm:col-span-2">
            {searchQuery.trim() || statusFilter !== "all"
              ? "No lectures match this filter."
              : "No lectures yet."}
          </p>
        ) : (
          filteredLectures.map((lecture, index) => (
            <StudentLectureListCard
              key={lecture.id}
              lecture={{ ...lecture, title: displayLectureTitle(lecture.title) }}
              index={index}
              courseLabel={formatLectureIndexLabel(lecture.week, { title: lecture.title, courseCode })}
              viewMode={viewMode}
              onPress={() => openSlidesViewer(lecture)}
              trailing={
                <StudentLectureListCardActions
                  isBookmarked={bookmarkedLectures.has(lecture.id)}
                  hasReminder={reminders.has(lecture.id)}
                  onToggleBookmark={() => toggleBookmark(lecture.id)}
                  onSetReminder={() => setReminder(lecture.id)}
                />
              }
            />
          ))
        )}
      </div>

      <LectureAiNotesPanel
        open={showAiNotes}
        onOpenChange={setShowAiNotes}
        studentRosterId={studentId}
      />
    </div>
  )
}
