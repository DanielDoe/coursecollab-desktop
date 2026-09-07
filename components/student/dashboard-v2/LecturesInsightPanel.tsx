"use client"

import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  Bell,
  Bookmark,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Heart,
  Lightbulb,
  MessageSquare,
  PlayCircle,
  Radio,
  Star,
  TrendingUp,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  lectureChromeKpi,
} from "@/lib/lecture-chrome-theme"
import { useLectureChrome } from "@/hooks/use-lecture-chrome"
import {
  resolveLectureCardKind,
} from "@/lib/lecture-list-utils"
import {
  lectureSolidThumb,
  lectureStatusAccent,
  lectureThumbIcon,
} from "@/lib/lecture-list-theme"
import { SolidListThumbTile } from "./SignatureListCard"
import {
  ClassWeekEngagementChart,
  LectureProgressDonut,
  LectureWeeklyViewsChart,
} from "./LecturesInsightCharts"

type LectureSummary = {
  id: number
  week: number
  title: string
  status?: string
  progress_percentage?: number
}

type TopMaterial = {
  id: number
  title: string
  view_count: number
  week?: number
}

type TopComment = {
  id: number
  comment: string
  likes: number
  week?: number
  lecture_title?: string
  student_name?: string
  is_current_user?: boolean
  created_at?: string
}

type EngagementStats = {
  total_views: number
  total_comments: number
  slides_viewed?: number
  currently_reading?: number
  active_students?: number
}

type RecentReader = {
  display_label: string
  is_current_user: boolean
  week: number
  lecture_title: string
  progress_percentage: number
  status: string
  last_accessed: string
}

type ProfessorNote = {
  id: number
  week: number
  title: string
  professor_notes: string | null
}

function isCompleted(status?: string) {
  return status === "completed" || status === "Completed"
}

function isInProgress(status?: string) {
  return status === "in_progress"
}

function pickContinueLecture(lectures: LectureSummary[]) {
  const sorted = [...lectures].sort((a, b) => a.week - b.week)
  const inProgress = sorted.find((l) => isInProgress(l.status))
  if (inProgress) return inProgress
  return sorted.find((l) => !isCompleted(l.status)) ?? null
}

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.max(0, Math.floor(diffMs / 60000))
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function PanelShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] dark:border-white/[0.06]",
        className
      )}
    >
      {children}
    </div>
  )
}

function SectionHeader({
  title,
  subtitle,
  icon: Icon,
  thumbFill,
  thumbIcon = "#FFFFFF",
  action,
}: {
  title: string
  subtitle?: string
  icon: LucideIcon
  thumbFill: string
  thumbIcon?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <SolidListThumbTile thumb={{ fill: thumbFill, icon: thumbIcon }} icon={Icon} size="compact" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[var(--cc-text)]">{title}</h3>
          {subtitle ? <p className="text-xs text-[var(--cc-text-muted)]">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  )
}

function StatCell({
  label,
  value,
  icon: Icon,
  thumbIndex,
}: {
  label: string
  value: number
  icon: LucideIcon
  thumbIndex: number
}) {
  const { roles } = useLectureChrome()
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 p-3.5 dark:border-white/[0.06]">
      <SolidListThumbTile thumb={lectureChromeKpi(thumbIndex, roles)} icon={Icon} size="compact" />
      <div className="min-w-0">
        <p className="text-lg font-semibold tabular-nums leading-none text-[var(--cc-text)]">{value}</p>
        <p className="mt-1 truncate text-[11px] font-medium text-[var(--cc-text-muted)]">{label}</p>
      </div>
    </div>
  )
}

function ReaderAvatar({ label, isYou }: { label: string; isYou?: boolean }) {
  const { orange, cream, ink, white } = useLectureChrome()
  const initial = isYou ? "Y" : label.charAt(0).toUpperCase()
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
        isYou ? "text-white" : "text-[#4A2E0A]"
      )}
      style={{
        backgroundColor: isYou ? orange : cream,
        color: isYou ? white : ink,
      }}
    >
      {initial}
    </span>
  )
}

function ClassmatesPanel({
  lectures,
  recentReaders,
  topComments,
  currentlyReading,
  onOpenLecture,
}: {
  lectures: LectureSummary[]
  recentReaders: RecentReader[]
  topComments: TopComment[]
  currentlyReading: number
  onOpenLecture: (lecture: { id: number; week: number }) => void
}) {
  const { orange, roles } = useLectureChrome()
  const readingNow = recentReaders.filter((reader) => reader.status === "in_progress")
  const openByWeek = (week?: number) => {
    if (week == null) return
    const lecture = lectures.find((item) => item.week === week)
    if (lecture) onOpenLecture({ id: lecture.id, week: lecture.week })
  }

  return (
    <PanelShell>
      <div className="p-4 sm:p-5">
        <SectionHeader
          title="Classmates"
          subtitle="Peers reading lectures or joining discussion"
          icon={Users}
          thumbFill={roles.classmates.fill}
          action={
            currentlyReading > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                {currentlyReading} reading now
              </span>
            ) : null
          }
        />

        <div className="space-y-4">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
              <Radio className="size-3.5" style={{ color: orange }} aria-hidden />
              Reading now
            </p>
            {readingNow.length > 0 ? (
              <ul className="space-y-2">
                {readingNow.slice(0, 6).map((reader, index) => (
                  <li key={`${reader.display_label}-${reader.week}-${index}`}>
                    <button
                      type="button"
                      onClick={() => openByWeek(reader.week)}
                      className="group flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/15 px-3 py-2.5 text-left transition-colors hover:bg-[var(--sidebar-accent)] dark:border-white/[0.06]"
                    >
                      <ReaderAvatar label={reader.display_label} isYou={reader.is_current_user} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--cc-text)]">
                          {reader.is_current_user ? "You" : reader.display_label}
                          <span className="font-normal text-[var(--cc-text-muted)]"> · Week {reader.week}</span>
                        </p>
                        <p className="truncate text-xs text-[var(--cc-text-muted)]">{reader.lecture_title}</p>
                        <p className="text-[10px] text-[var(--cc-text-muted)]">
                          {reader.progress_percentage}% through · {formatRelativeTime(reader.last_accessed)}
                        </p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-[var(--cc-text-muted)] opacity-50 group-hover:opacity-100" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl bg-[var(--muted)]/30 px-4 py-5 text-center text-sm text-[var(--cc-text-muted)]">
                No classmates are reading a lecture right now.
              </p>
            )}
          </div>

          <div className="border-t border-[var(--border)] pt-4 dark:border-white/[0.06]">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
              <MessageSquare className="size-3.5" style={{ color: orange }} aria-hidden />
              In discussion
            </p>
            {topComments.length > 0 ? (
              <ul className="space-y-2">
                {topComments.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openByWeek(item.week)}
                      className="group w-full rounded-xl border border-[var(--border)] bg-[var(--muted)]/15 px-3.5 py-3 text-left transition-colors hover:bg-[var(--sidebar-accent)] dark:border-white/[0.06]"
                    >
                      <div className="flex items-center gap-2">
                        <ReaderAvatar
                          label={item.is_current_user ? "You" : item.student_name ?? "Student"}
                          isYou={item.is_current_user}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--cc-text)]">
                            {item.is_current_user ? "You" : item.student_name ?? "Classmate"}
                            {item.week != null ? (
                              <span className="font-normal text-[var(--cc-text-muted)]"> · Week {item.week}</span>
                            ) : null}
                          </p>
                          {item.lecture_title ? (
                            <p className="truncate text-xs text-[var(--cc-text-muted)]">{item.lecture_title}</p>
                          ) : null}
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-[var(--cc-text-muted)] opacity-50 group-hover:opacity-100" aria-hidden />
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--cc-text)]">{item.comment}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-[var(--cc-text-muted)]">
                        <span className="inline-flex items-center gap-1">
                          <Heart className="size-3.5" aria-hidden />
                          {item.likes} like{item.likes === 1 ? "" : "s"}
                        </span>
                        {item.created_at ? <span>{formatRelativeTime(item.created_at)}</span> : null}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl bg-[var(--muted)]/30 px-4 py-5 text-center text-sm text-[var(--cc-text-muted)]">
                No class discussion yet — be the first to comment on a lecture.
              </p>
            )}
          </div>
        </div>
      </div>
    </PanelShell>
  )
}

function TipRow({ icon: Icon, children, color }: { icon: LucideIcon; children: React.ReactNode; color?: string }) {
  const { orange } = useLectureChrome()
  const tone = color ?? orange
  return (
    <li className="flex items-start gap-2.5 text-sm text-[var(--cc-text-muted)]">
      <span
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${tone}18`, color: tone }}
      >
        <Icon className="size-3.5" strokeWidth={2} aria-hidden />
      </span>
      <span className="leading-snug pt-0.5">{children}</span>
    </li>
  )
}

export function LecturesInsightPanel({
  lectures,
  bookmarkedIds,
  reminderIds,
  stats,
  professorNotes,
  topMaterials,
  topComments,
  weeklyViews,
  recentReaders,
  classWeekProgress,
  onOpenLecture,
}: {
  lectures: LectureSummary[]
  bookmarkedIds: Set<number>
  reminderIds: Set<number>
  stats: EngagementStats | null
  professorNotes: ProfessorNote[]
  topMaterials: TopMaterial[]
  topComments: TopComment[]
  weeklyViews: { label: string; views: number }[]
  recentReaders: RecentReader[]
  classWeekProgress: { week: number; completed: number; active: number }[]
  onOpenLecture: (lecture: { id: number; week: number }) => void
}) {
  const { red, orange, amber, ink, white, roles } = useLectureChrome()
  const sortedLectures = [...lectures].sort((a, b) => a.week - b.week)
  const lectureCount = lectures.length
  const completedCount = lectures.filter((l) => isCompleted(l.status)).length
  const inProgressCount = lectures.filter((l) => isInProgress(l.status)).length
  const notStartedCount = Math.max(0, lectureCount - completedCount - inProgressCount)
  const progressPct = lectureCount > 0 ? Math.round((completedCount / lectureCount) * 100) : 0

  const continueLecture = pickContinueLecture(lectures)
  const continuePct = continueLecture?.progress_percentage ?? 0
  const bookmarkedLectures = sortedLectures.filter((l) => bookmarkedIds.has(l.id))
  const reminderLectures = sortedLectures.filter((l) => reminderIds.has(l.id))

  const currentlyReading = stats?.currently_reading ?? 0

  return (
    <aside className="min-w-0 space-y-4 xl:sticky xl:top-[4.5rem] xl:self-start">
      {/* Progress overview */}
      <PanelShell>
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
                Lecture progress
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-[var(--cc-text)]">{progressPct}%</p>
              <p className="mt-1 text-sm text-[var(--cc-text-muted)]">
                {completedCount} of {lectureCount} lectures completed
              </p>
            </div>
            <div
              className="flex size-14 shrink-0 items-center justify-center rounded-2xl shadow-sm"
              style={{ backgroundColor: roles.progress.fill, color: roles.progress.icon }}
            >
              <BarChart3 className="size-6" strokeWidth={2} aria-hidden />
            </div>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--muted)]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, backgroundColor: roles.progress.fill }}
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/25 px-3 py-3 text-center dark:border-white/[0.06]">
              <CheckCircle2 className="mx-auto size-4" style={{ color: roles.progress.fill }} aria-hidden />
              <p className="mt-1.5 text-sm font-semibold tabular-nums text-[var(--cc-text)]">{completedCount}</p>
              <p className="text-[10px] text-[var(--cc-text-muted)]">Done</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/25 px-3 py-3 text-center dark:border-white/[0.06]">
              <Clock className="mx-auto size-4" style={{ color: roles.inProgress.fill }} aria-hidden />
              <p className="mt-1.5 text-sm font-semibold tabular-nums text-[var(--cc-text)]">{inProgressCount}</p>
              <p className="text-[10px] text-[var(--cc-text-muted)]">In progress</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/25 px-3 py-3 text-center dark:border-white/[0.06]">
              <Bell className="mx-auto size-4" style={{ color: roles.reminder.fill }} aria-hidden />
              <p className="mt-1.5 text-sm font-semibold tabular-nums text-[var(--cc-text)]">{reminderIds.size}</p>
              <p className="text-[10px] text-[var(--cc-text-muted)]">Reminders</p>
            </div>
          </div>

          <div className="mt-4 border-t border-[var(--border)] pt-4 dark:border-white/[0.06]">
            <LectureProgressDonut
              completed={completedCount}
              inProgress={inProgressCount}
              notStarted={notStartedCount}
              className="justify-center sm:justify-start"
            />
          </div>
        </div>
      </PanelShell>

      {/* Continue learning */}
      <PanelShell>
        <div className="p-4 sm:p-5">
          <SectionHeader
            title="Continue learning"
            subtitle={continueLecture ? `Week ${continueLecture.week} · pick up where you left off` : "You're all caught up"}
            icon={PlayCircle}
            thumbFill={roles.cta.fill}
          />
          {continueLecture ? (
            <button
              type="button"
              onClick={() => onOpenLecture({ id: continueLecture.id, week: continueLecture.week })}
              className="group w-full rounded-xl border border-[var(--border)] bg-[var(--muted)]/25 p-4 text-left transition-colors hover:bg-[var(--sidebar-accent)] dark:border-white/[0.06]"
            >
              <div className="flex items-start gap-3">
                <SolidListThumbTile
                  thumb={lectureSolidThumb(
                    continueLecture.week,
                    resolveLectureCardKind(continueLecture),
                  )}
                  icon={lectureThumbIcon(resolveLectureCardKind(continueLecture))}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--cc-text)]">{continueLecture.title}</p>
                  <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
                    {isInProgress(continueLecture.status)
                      ? `${continuePct}% watched — resume slides`
                      : "Open this week's lecture"}
                  </p>
                  {isInProgress(continueLecture.status) && continuePct > 0 ? (
                    <div
                      className="mt-3 h-1.5 overflow-hidden rounded-full"
                      style={{
                        backgroundColor: `${lectureSolidThumb(continueLecture.week, "in_progress").fill}29`,
                      }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${continuePct}%`,
                          backgroundColor: lectureStatusAccent(
                            "in_progress",
                            lectureSolidThumb(continueLecture.week, "in_progress"),
                          ),
                        }}
                      />
                    </div>
                  ) : null}
                </div>
                <ChevronRight className="mt-1 size-4 shrink-0 text-[var(--cc-text-muted)] group-hover:translate-x-0.5 transition-transform" aria-hidden />
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <CheckCircle2 className="size-9 shrink-0 text-emerald-500" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-[var(--cc-text)]">All lectures complete</p>
                <p className="text-xs text-[var(--cc-text-muted)]">Revisit bookmarks or review slides anytime.</p>
              </div>
            </div>
          )}
        </div>
      </PanelShell>

      {/* Classmates — peers reading & discussing */}
      <ClassmatesPanel
        lectures={sortedLectures}
        recentReaders={recentReaders}
        topComments={topComments}
        currentlyReading={currentlyReading}
        onOpenLecture={onOpenLecture}
      />

      {/* Your engagement */}
      <PanelShell>
        <div className="p-4 sm:p-5">
          <SectionHeader title="Your engagement" subtitle="Personal activity this term" icon={Eye} thumbFill={roles.engagement.fill} />
          <div className="grid grid-cols-2 gap-2.5">
            <StatCell label="Lectures opened" value={stats?.total_views ?? 0} icon={Eye} thumbIndex={0} />
            <StatCell label="Slides viewed" value={stats?.slides_viewed ?? 0} icon={BookOpen} thumbIndex={1} />
            <StatCell label="Comments posted" value={stats?.total_comments ?? 0} icon={MessageSquare} thumbIndex={2} />
            <StatCell label="Saved lectures" value={bookmarkedIds.size} icon={Bookmark} thumbIndex={3} />
          </div>
        </div>
      </PanelShell>

      {/* Charts — full width, taller */}
      <PanelShell>
        <div className="space-y-5 p-4 sm:p-5">
          <div>
            <SectionHeader
              title="Class opens this week"
              subtitle="Daily lecture views across your section"
              icon={BarChart3}
              thumbFill={roles.charts.fill}
              thumbIcon={ink}
            />
            <LectureWeeklyViewsChart weeklyViews={weeklyViews} className="h-44" />
          </div>
          <div className="border-t border-[var(--border)] pt-5 dark:border-white/[0.06]">
            <SectionHeader
              title="Completion by week"
              subtitle="Classmates finished vs still watching"
              icon={TrendingUp}
              thumbFill={roles.cta.fill}
            />
            <ClassWeekEngagementChart weeks={classWeekProgress} className="h-44" />
          </div>
        </div>
      </PanelShell>

      {/* Popular materials */}
      {topMaterials.length > 0 ? (
        <PanelShell>
          <div className="p-4 sm:p-5">
            <SectionHeader title="Popular materials" subtitle="Most viewed downloads" icon={FileText} thumbFill={roles.materials.fill} thumbIcon={ink} />
            <ul className="space-y-2">
              {topMaterials.map((material, index) => (
                <li
                  key={material.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/15 px-3.5 py-3 dark:border-white/[0.06]"
                >
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums"
                    style={{
                      backgroundColor: `${lectureChromeKpi(index, roles).fill}22`,
                      color: lectureChromeKpi(index, roles).fill,
                    }}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--cc-text)]">{material.title}</p>
                    <p className="text-xs text-[var(--cc-text-muted)]">
                      {material.week != null ? `Week ${material.week} · ` : ""}
                      {material.view_count} view{material.view_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Eye className="size-4 shrink-0 text-[var(--cc-text-muted)]" aria-hidden />
                </li>
              ))}
            </ul>
          </div>
        </PanelShell>
      ) : null}

      {/* Saved & reminders */}
      {(bookmarkedLectures.length > 0 || reminderLectures.length > 0) ? (
        <PanelShell>
          <div className="divide-y divide-[var(--border)] dark:divide-white/[0.06]">
            {bookmarkedLectures.length > 0 ? (
              <div className="p-4 sm:p-5">
                <SectionHeader
                  title="Saved for review"
                  subtitle={`${bookmarkedLectures.length} bookmark${bookmarkedLectures.length === 1 ? "" : "s"}`}
                  icon={Bookmark}
                  thumbFill={roles.saved.fill}
                  thumbIcon={ink}
                />
                <ul className="space-y-2">
                  {bookmarkedLectures.map((lecture) => (
                    <li key={lecture.id}>
                      <button
                        type="button"
                        onClick={() => onOpenLecture({ id: lecture.id, week: lecture.week })}
                        className="group flex w-full items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--muted)]/15 px-3 py-2.5 text-left transition-colors hover:bg-[var(--sidebar-accent)] dark:border-white/[0.06]"
                      >
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: `${amber}22`, color: ink }}
                        >
                          W{lecture.week}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--cc-text)]">{lecture.title}</span>
                        <ChevronRight className="size-4 shrink-0 opacity-40 group-hover:opacity-100" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {reminderLectures.length > 0 ? (
              <div className="p-4 sm:p-5">
                <SectionHeader
                  title="Your reminders"
                  subtitle="Lectures you've flagged to revisit"
                  icon={Bell}
                  thumbFill={roles.reminder.fill}
                  thumbIcon={ink}
                />
                <ul className="space-y-2">
                  {reminderLectures.map((lecture) => (
                    <li key={lecture.id}>
                      <button
                        type="button"
                        onClick={() => onOpenLecture({ id: lecture.id, week: lecture.week })}
                        className="group flex w-full items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--muted)]/15 px-3 py-2.5 text-left transition-colors hover:bg-[var(--sidebar-accent)] dark:border-white/[0.06]"
                      >
                        <Bell className="size-4 shrink-0 text-sky-500" aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--cc-text)]">
                          Week {lecture.week} · {lecture.title}
                        </span>
                        <ChevronRight className="size-4 shrink-0 opacity-40 group-hover:opacity-100" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </PanelShell>
      ) : null}

      {/* Instructor notes */}
      {professorNotes.length > 0 ? (
        <PanelShell>
          <div className="p-4 sm:p-5">
            <SectionHeader title="From your instructor" subtitle="Latest weekly notes" icon={FileText} thumbFill={roles.instructor.fill} />
            <div className="space-y-2.5">
              {professorNotes.slice(0, 5).map((note) => (
                <div
                  key={note.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 px-3.5 py-3 dark:border-white/[0.06]"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{ backgroundColor: `${orange}20`, color: orange }}
                    >
                      Week {note.week}
                    </span>
                    <p className="min-w-0 truncate text-sm font-semibold text-[var(--cc-text)]">{note.title}</p>
                  </div>
                  {note.professor_notes ? (
                    <p className="mt-2 text-sm leading-relaxed text-[var(--cc-text-muted)]">{note.professor_notes}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </PanelShell>
      ) : null}

      {/* Study tips */}
      <PanelShell>
        <div className="bg-[var(--muted)]/20 p-4 sm:p-5">
          <SectionHeader title="Study smarter" icon={Lightbulb} thumbFill={roles.tips.fill} thumbIcon={ink} />
          <ul className="space-y-3">
            <TipRow icon={Star} color={amber}>
              Bookmark key lectures before exams — they appear in Saved for review above.
            </TipRow>
            <TipRow icon={Bell} color={orange}>
              Set reminders on lectures you want to revisit before the next quiz.
            </TipRow>
            <TipRow icon={Heart} color={red}>
              Join discussions — commenting on slides helps reinforce concepts.
            </TipRow>
          </ul>
        </div>
      </PanelShell>
    </aside>
  )
}
