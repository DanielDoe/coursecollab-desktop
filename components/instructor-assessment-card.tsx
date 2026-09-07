"use client"

import Link from "next/link"
import {
  BookmarkCheck,
  Calendar,
  Clock,
  Copy,
  Download,
  Edit,
  Eye,
  FileText,
  Mail,
  MoreVertical,
  RefreshCw,
  Save,
  Trash2,
  Users,
  Zap,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { QuizReleaseTarget } from "@/lib/quiz-release-targets"
import { cn } from "@/lib/utils"
import {
  AM_LIST_ROW,
  AM_STAT_BOX,
  AM_STATUS_PILL,
  AM_TILE,
  PORTAL_LIST_ROW_HOVER,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/assessments/assessment-management-surface-classes"
import type { AssessmentListViewMode } from "@/components/instructor-assessment-list-toolbar"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyToolbarFilterButtonClass } from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { portalListStripe } from "@/lib/portal-module-themes"

export type InstructorAssessmentCardQuiz = {
  id: number
  title: string
  description: string
  is_active: boolean
  is_saved: boolean
  time_per_question: number
  question_count: number
  created_at: string
  session_access?: Record<string, boolean | undefined>
  ta_content_visible?: boolean
  ta_content_restricted?: boolean
  unfinalized_count?: number
  total_attempts?: number
}

type SessionAccessRowProps = {
  quiz: InstructorAssessmentCardQuiz
  releaseTargets: QuizReleaseTarget[]
  canPublishToStudents: boolean
  isSupervisingInstructor: boolean
  togglingKey: string | null
  onToggleSession: (quizId: number, sessionCode: string, current: boolean) => void
  onToggleTa: (quizId: number, current: boolean) => void
}

type SessionTogglePillProps = {
  label: string
  sublabel: string
  active: boolean
  disabled?: boolean
  onToggle: () => void
  title?: string
}

function SessionTogglePill({
  label,
  sublabel,
  active,
  disabled,
  onToggle,
  title,
}: SessionTogglePillProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onToggle}
      className={cn(
        "group inline-flex min-w-[9.5rem] max-w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]/30",
        disabled && "cursor-not-allowed opacity-50",
        active
          ? "border-[var(--cc-accent)]/30 bg-[var(--cc-accent-soft)] ring-1 ring-[var(--cc-accent)]/20"
          : cn("border-[var(--border)] bg-[var(--card)]", PORTAL_LIST_ROW_HOVER),
      )}
    >
      <span
        aria-hidden
        className={cn(
          "relative flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors",
          active ? "bg-[var(--cc-accent)]" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
            active ? "translate-x-5" : "translate-x-0",
          )}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn("truncate text-sm font-medium leading-tight", PORTAL_TEXT)}>{label}</span>
          {active ? (
            <span className={cn(AM_STATUS_PILL, "bg-[var(--cc-accent)]/10 text-[var(--cc-accent-dark)]")}>On</span>
          ) : (
            <span className={cn(AM_STATUS_PILL, "bg-muted text-[var(--cc-text-muted)]")}>Off</span>
          )}
        </span>
        <span className={cn("mt-1 block truncate text-xs leading-snug", PORTAL_TEXT_MUTED)}>{sublabel}</span>
      </span>
    </button>
  )
}

function SessionAccessRow({
  quiz,
  releaseTargets,
  canPublishToStudents,
  isSupervisingInstructor,
  togglingKey,
  onToggleSession,
  onToggleTa,
}: SessionAccessRowProps) {
  if (releaseTargets.length === 0) {
    return <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No sections configured for this course.</p>
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-muted/20 p-3">
      <div className="flex flex-wrap gap-2.5">
        {releaseTargets.map((target) => {
          const sessionAccess = quiz.session_access || {}
          const isActive = sessionAccess[target.sessionCode] === true
          const toggleKey = `${quiz.id}-${target.sessionCode}`

          return (
            <SessionTogglePill
              key={target.sessionId}
              label={target.label}
              sublabel={
                canPublishToStudents
                  ? isActive
                    ? `Published · ${target.studentToggleLabel}`
                    : "Hidden · click to publish"
                  : "View only"
              }
              active={isActive}
              disabled={!canPublishToStudents || togglingKey === toggleKey}
              title={
                canPublishToStudents
                  ? `${target.label}: ${isActive ? "Published" : "Hidden"}`
                  : `${target.label}: view only`
              }
              onToggle={() => onToggleSession(quiz.id, target.sessionCode, isActive)}
            />
          )
        })}
        {isSupervisingInstructor && (
          <SessionTogglePill
            label="Teaching assistants"
            sublabel={
              quiz.ta_content_visible ? "TA access enabled" : "Hidden from TAs · click to enable"
            }
            active={Boolean(quiz.ta_content_visible)}
            disabled={togglingKey === `ta-${quiz.id}`}
            title={
              quiz.ta_content_visible
                ? "TA can view questions — click to hide"
                : "TA access hidden — click to enable"
            }
            onToggle={() => onToggleTa(quiz.id, Boolean(quiz.ta_content_visible))}
          />
        )}
      </div>
    </div>
  )
}

type MoreMenuProps = {
  quiz: InstructorAssessmentCardQuiz
  savingQuizId: number | null
  cloningQuizId: number | null
  autoFinalizingQuizId: number | null
  emailingMissedQuizId: number | null
  onToggleSaved: (quizId: number, isSaved: boolean) => void
  onClone: (quizId: number, title: string) => void
  onAutoFinalize: (quizId: number) => void
  onEmailMissed: (quizId: number) => void
  onBulkReeval: (quiz: InstructorAssessmentCardQuiz) => void
  onExport: (quizId: number, format: "json" | "csv") => void
  triggerClass?: string
}

function AssessmentMoreMenu({
  quiz,
  savingQuizId,
  cloningQuizId,
  autoFinalizingQuizId,
  emailingMissedQuizId,
  onToggleSaved,
  onClone,
  onAutoFinalize,
  onEmailMissed,
  onBulkReeval,
  onExport,
  triggerClass,
}: MoreMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("h-9 w-9 shrink-0 p-0", triggerClass)}>
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">More options</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuItem
          onClick={() => onToggleSaved(quiz.id, quiz.is_saved)}
          disabled={savingQuizId === quiz.id}
        >
          {savingQuizId === quiz.id ? (
            "Saving..."
          ) : quiz.is_saved ? (
            <>
              <BookmarkCheck className="mr-2 h-4 w-4" />
              Remove Template
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save as Template
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onClone(quiz.id, quiz.title)} disabled={cloningQuizId === quiz.id}>
          {cloningQuizId === quiz.id ? (
            "Cloning..."
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Clone
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onAutoFinalize(quiz.id)}
          disabled={autoFinalizingQuizId === quiz.id}
        >
          {autoFinalizingQuizId === quiz.id ? (
            "Finalizing..."
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Auto-Finalize
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onEmailMissed(quiz.id)}
          disabled={emailingMissedQuizId === quiz.id}
        >
          {emailingMissedQuizId === quiz.id ? (
            "Sending..."
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              Email Students Who Missed
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onBulkReeval(quiz)}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Bulk re-evaluate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onExport(quiz.id, "json")}>
          <Download className="mr-2 h-4 w-4" />
          Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport(quiz.id, "csv")}>
          <Download className="mr-2 h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function StatusBadges({ quiz }: { quiz: InstructorAssessmentCardQuiz }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {quiz.is_saved ? (
        <span className={cn(AM_STATUS_PILL, "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]")}>
          <BookmarkCheck className="mr-1 inline h-3 w-3" />
          Saved
        </span>
      ) : null}
      {quiz.unfinalized_count !== undefined &&
        Number(quiz.unfinalized_count) === 0 &&
        quiz.total_attempts &&
        Number(quiz.total_attempts) > 0 && (
          <span className={cn(AM_STATUS_PILL, "bg-[var(--cc-sem-success)]/10 text-[var(--cc-sem-success)]")}>
            All Finalized
          </span>
        )}
      {quiz.unfinalized_count !== undefined && Number(quiz.unfinalized_count) > 0 && (
        <span className={cn(AM_STATUS_PILL, "bg-[var(--cc-sem-warning)]/10 text-[var(--cc-sem-warning)]")}>
          {quiz.unfinalized_count} Unfinalized
        </span>
      )}
      <Badge
        variant="outline"
        className={cn(
          "text-xs border-0",
          quiz.is_active
            ? "bg-[var(--cc-sem-success)]/10 text-[var(--cc-sem-success)]"
            : "bg-muted text-[var(--cc-text-muted)]",
        )}
      >
        {quiz.is_active ? "Active" : "Inactive"}
      </Badge>
    </div>
  )
}

export type InstructorAssessmentCardProps = {
  quiz: InstructorAssessmentCardQuiz
  viewMode: AssessmentListViewMode
  moduleId: string
  listIndex?: number
  previewHref: string
  editHref: string
  releaseTargets: QuizReleaseTarget[]
  canPublishToStudents: boolean
  canEditAssessments: boolean
  isSupervisingInstructor: boolean
  togglingKey: string | null
  savingQuizId: number | null
  cloningQuizId: number | null
  autoFinalizingQuizId: number | null
  emailingMissedQuizId: number | null
  onToggleSession: (quizId: number, sessionCode: string, current: boolean) => void
  onToggleTa: (quizId: number, current: boolean) => void
  onDelete: (quiz: InstructorAssessmentCardQuiz) => void
  onToggleSaved: (quizId: number, isSaved: boolean) => void
  onClone: (quizId: number, title: string) => void
  onAutoFinalize: (quizId: number) => void
  onEmailMissed: (quizId: number) => void
  onBulkReeval: (quiz: InstructorAssessmentCardQuiz) => void
  onExport: (quizId: number, format: "json" | "csv") => void
}

export function InstructorAssessmentCard({
  quiz,
  viewMode,
  moduleId,
  listIndex = 0,
  previewHref,
  editHref,
  releaseTargets,
  canPublishToStudents,
  canEditAssessments,
  isSupervisingInstructor,
  togglingKey,
  savingQuizId,
  cloningQuizId,
  autoFinalizingQuizId,
  emailingMissedQuizId,
  onToggleSession,
  onToggleTa,
  onDelete,
  onToggleSaved,
  onClone,
  onAutoFinalize,
  onEmailMissed,
  onBulkReeval,
  onExport,
}: InstructorAssessmentCardProps) {
  const chrome = facultyEmbedChrome(moduleId)
  const stripe = portalListStripe(listIndex, chrome.theme.family)
  const created = new Date(quiz.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  const hasPerQuestionTimer = Number(quiz.time_per_question) > 0
  const publishedCount = releaseTargets.filter(
    (t) => quiz.session_access?.[t.sessionCode] === true,
  ).length

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={previewHref}>
        <Button size="sm" className={cn("h-9 gap-1.5", chrome.quiet)}>
          <Eye className="h-4 w-4" />
          Preview
        </Button>
      </Link>
      <Link href={editHref}>
        <Button size="sm" className={cn("h-9 gap-1.5", chrome.quiet)}>
          <Edit className="h-4 w-4" />
          Edit
        </Button>
      </Link>
      <Button size="sm" className={cn("h-9 gap-1.5", chrome.danger)} onClick={() => onDelete(quiz)}>
        <Trash2 className="h-4 w-4" />
        Delete
      </Button>
      <AssessmentMoreMenu
        quiz={quiz}
        savingQuizId={savingQuizId}
        cloningQuizId={cloningQuizId}
        autoFinalizingQuizId={autoFinalizingQuizId}
        emailingMissedQuizId={emailingMissedQuizId}
        onToggleSaved={onToggleSaved}
        onClone={onClone}
        onAutoFinalize={onAutoFinalize}
        onEmailMissed={onEmailMissed}
        onBulkReeval={onBulkReeval}
        onExport={onExport}
        triggerClass={facultyToolbarFilterButtonClass()}
      />
    </div>
  )

  if (viewMode === "list") {
    return (
      <article className={AM_LIST_ROW}>
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", stripe.iconBg, stripe.iconText)}>
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className={cn("truncate text-sm font-semibold sm:text-base", PORTAL_TEXT)}>{quiz.title}</h3>
                <p className={cn("mt-0.5 line-clamp-1 text-xs sm:text-sm", PORTAL_TEXT_MUTED)}>
                  {quiz.description || "No description"} · {quiz.question_count} questions · {created}
                </p>
                <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
                  {publishedCount}/{releaseTargets.length} sections published
                </p>
              </div>
              <StatusBadges quiz={quiz} />
            </div>
          </div>
        </div>
        <div className="shrink-0 sm:pl-2">{actionButtons}</div>
      </article>
    )
  }

  const stats = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[
        { icon: FileText, label: "Questions", value: quiz.question_count },
        {
          icon: Clock,
          label: hasPerQuestionTimer ? "Time per Q" : "Timer",
          value: hasPerQuestionTimer ? `${quiz.time_per_question}s` : "Pooled",
        },
        { icon: Calendar, label: "Created", value: created },
      ].map(({ icon: Icon, label, value }) => (
        <div key={label} className={AM_STAT_BOX}>
          <div className={cn("rounded-lg p-2", stripe.iconBg, stripe.iconText)}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{label}</p>
            <p className={cn("text-sm font-semibold tabular-nums", PORTAL_TEXT)}>{value}</p>
          </div>
        </div>
      ))}
    </div>
  )

  const sessionAccess = (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className={cn("h-4 w-4", chrome.accentIcon)} />
          <p className={cn("text-sm font-medium", PORTAL_TEXT)}>Publish to sections</p>
        </div>
        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Tap a section to publish or hide</p>
      </div>
      {quiz.ta_content_restricted ? (
        <p className="text-xs text-[var(--cc-sem-warning)]">
          Content hidden — your instructor has not enabled TA visibility for any section.
        </p>
      ) : null}
      <SessionAccessRow
        quiz={quiz}
        releaseTargets={releaseTargets}
        canPublishToStudents={canPublishToStudents}
        isSupervisingInstructor={isSupervisingInstructor}
        togglingKey={togglingKey}
        onToggleSession={onToggleSession}
        onToggleTa={onToggleTa}
      />
      {!canPublishToStudents && canEditAssessments ? (
        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
          You can create and edit assessments; publishing to students requires instructor publish access.
        </p>
      ) : null}
    </div>
  )

  return (
    <article className={cn(AM_TILE, "flex h-full flex-col space-y-4 p-4 sm:p-5")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1.5">
          <h3 className={cn("text-base font-semibold leading-snug sm:text-lg", PORTAL_TEXT)}>{quiz.title}</h3>
          {quiz.description ? (
            <p className={cn("line-clamp-2 text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>{quiz.description}</p>
          ) : (
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No description</p>
          )}
        </div>
        <StatusBadges quiz={quiz} />
      </div>

      {stats}
      <div className="flex-1">{sessionAccess}</div>

      <div className="mt-auto border-t border-[var(--border)]/60 pt-4">{actionButtons}</div>
    </article>
  )
}
