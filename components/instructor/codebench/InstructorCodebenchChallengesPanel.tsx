"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowUpRight,
  Code2,
  FolderOpen,
  Loader2,
  Plus,
  RefreshCw,
  Target,
} from "lucide-react"
import {
  ClassroomAssignmentAvailabilityFields,
  ClassroomAssignmentFormFields,
  classroomAssignmentFormToApiPayload,
  emptyClassroomAssignmentForm,
  type ClassroomAssignmentFormValues,
} from "@/components/classroom-assignment-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useInstructorClassroomAssignments } from "@/hooks/use-instructor-classroom-assignments"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { defaultFacultySessionFilter } from "@/hooks/use-instructor-scope-key"
import { useToast } from "@/hooks/use-toast"
import {
  classroomAssignmentToHandoff,
  classroomAssignmentTopic,
  extractClassroomQuestionText,
  type ClassroomAssignmentRow,
  type InstructorClassroomHandoff,
} from "@/lib/codebench-instructor-classroom"
import {
  loadInstructorLibrary,
  type InstructorLibraryItem,
} from "@/lib/codebench-instructor-library"
import { CLASSROOM_SUBMISSION_KIND_CODE } from "@/lib/classroom-solution-submission"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { studentApiFetch } from "@/lib/auth"
import { InstructorClassroomAssignmentActions } from "@/components/instructor/InstructorClassroomAssignmentActions"
import {
  CODEBENCH_CHALLENGES_PAGE_SIZE,
  CodebenchListPagination,
  paginateCodebenchList,
} from "@/components/instructor/codebench/CodebenchListPagination"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

type Props = {
  onOpenClassroomInIde: (handoff: InstructorClassroomHandoff) => void
  onOpenLibraryInIde: (item: InstructorLibraryItem) => void
}

const CLASSROOM_POINTS_HREF = "/faculty/dashboard/assessments/classroom-points"

function questionPreview(text: string, max = 160) {
  const plain = text.replace(/\s+/g, " ").trim()
  if (plain.length <= max) return plain
  return `${plain.slice(0, max).trim()}…`
}

function ChallengeCard({
  row,
  onOpen,
  sessions,
  onMutated,
}: {
  row: ClassroomAssignmentRow
  onOpen: (handoff: InstructorClassroomHandoff) => void
  sessions: string[]
  onMutated: () => void
}) {
  const chrome = facultyEmbedChrome("codebench")
  const handoff = classroomAssignmentToHandoff(row)
  const preview = questionPreview(extractClassroomQuestionText(row))

  return (
    <article className={cn(chrome.card, "instructor-lift-card flex flex-col gap-3 p-4")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className={cn("text-sm font-semibold leading-snug", PORTAL_TEXT)}>{row.title}</p>
          <p className={cn("line-clamp-3 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>{preview}</p>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          <InstructorClassroomAssignmentActions
            submission={row}
            sessions={sessions}
            onMutated={onMutated}
          />
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--cc-accent)_12%,var(--card))] text-[var(--cc-accent)]">
            <Code2 className="h-4 w-4" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="text-[10px]">
          Coding challenge
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {classroomAssignmentTopic(row)}
        </Badge>
        {row.session ? (
          <Badge variant="outline" className="text-[10px]">
            {row.session}
          </Badge>
        ) : null}
        <Badge
          variant="outline"
          className={cn(
            "text-[10px]",
            row.is_active ? "border-emerald-500/35 text-emerald-700 dark:text-emerald-300" : "",
          )}
        >
          {row.is_active ? "Active" : "Closed"}
        </Badge>
      </div>

      <div className="mt-auto flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => onOpen(handoff)}>
          <FolderOpen className="mr-1 h-3.5 w-3.5" />
          Teach in IDE
        </Button>
      </div>
    </article>
  )
}

function DraftChallengeCard({
  item,
  onOpen,
}: {
  item: InstructorLibraryItem
  onOpen: (item: InstructorLibraryItem) => void
}) {
  const chrome = facultyEmbedChrome("codebench")
  return (
    <article className={cn(chrome.card, "instructor-lift-card flex flex-col gap-3 p-4")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className={cn("text-sm font-semibold leading-snug", PORTAL_TEXT)}>{item.title}</p>
          <p className={cn("line-clamp-2 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>{item.description}</p>
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          Draft
        </Badge>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-[10px]">
          {item.languageId.toUpperCase()}
        </Badge>
        {item.topic ? (
          <Badge variant="outline" className="text-[10px]">
            {item.topic}
          </Badge>
        ) : null}
      </div>
      <Button type="button" size="sm" className="mt-auto w-full sm:w-auto" onClick={() => onOpen(item)}>
        Open draft in IDE
      </Button>
    </article>
  )
}

export function InstructorCodebenchChallengesPanel({ onOpenClassroomInIde, onOpenLibraryInIde }: Props) {
  const chrome = facultyEmbedChrome("codebench")
  const { toast } = useToast()
  const { courseScopeVersion } = useInstructorDashboardV2()
  const [sessionFilter, setSessionFilter] = useState<string>(defaultFacultySessionFilter)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [sessions, setSessions] = useState<string[]>(["all"])
  const [formValues, setFormValues] = useState<ClassroomAssignmentFormValues>(() => ({
    ...emptyClassroomAssignmentForm(),
    submissionKind: CLASSROOM_SUBMISSION_KIND_CODE,
    neverExpires: true,
  }))
  const [listPage, setListPage] = useState(1)

  const { submissions, loading, error, reload } = useInstructorClassroomAssignments(sessionFilter)
  const libraryDrafts = useMemo(
    () => loadInstructorLibrary().items.filter((item) => item.category === "challenges"),
    [],
  )

  useEffect(() => {
    setSessionFilter(defaultFacultySessionFilter())
  }, [courseScopeVersion])

  const codeChallenges = useMemo(
    () =>
      submissions.filter(
        (row) => String(row.submission_kind ?? CLASSROOM_SUBMISSION_KIND_CODE).toLowerCase() === CLASSROOM_SUBMISSION_KIND_CODE,
      ),
    [submissions],
  )

  const challengePaging = paginateCodebenchList(codeChallenges, listPage, CODEBENCH_CHALLENGES_PAGE_SIZE)

  useEffect(() => {
    setListPage(1)
  }, [sessionFilter, submissions.length])

  const sessionOptions = useMemo(() => {
    const set = new Set<string>(["all"])
    for (const row of submissions) {
      if (row.session?.trim()) set.add(row.session.trim())
    }
    return Array.from(set)
  }, [submissions])

  useEffect(() => {
    void (async () => {
      try {
        const response = await instructorApiFetch("/api/instructor/sessions", {
          headers: buildInstructorAuthorizedApiHeaders(),
        })
        if (!response.ok) return
        const data = (await response.json()) as { sessions?: Array<{ code?: string }> }
        const codes = [
          ...new Set((data.sessions?.map((entry) => entry.code).filter(Boolean) as string[]) ?? []),
        ]
        setSessions(["all", ...codes])
      } catch {
        setSessions(["all"])
      }
    })()
  }, [courseScopeVersion])

  const handleCreate = useCallback(async () => {
    if (!formValues.title.trim()) {
      toast({
        title: "Title required",
        description: "Give the coding challenge a title students will recognize.",
        variant: "destructive",
      })
      return
    }

    if (!formValues.description.trim()) {
      toast({
        title: "Description required",
        description: "Describe what students should implement — this drives AI validation of submissions.",
        variant: "destructive",
      })
      return
    }

    if (!formValues.neverExpires && !formValues.dueAtLocal.trim()) {
      toast({
        title: "Due date required",
        description: "Set a due date or choose “No due date (never expires)”.",
        variant: "destructive",
      })
      return
    }

    const instructorId =
      typeof window !== "undefined" ? Number(window.localStorage.getItem("instructorId")) : NaN
    if (!Number.isFinite(instructorId)) {
      toast({
        title: "Session error",
        description: "Could not resolve your instructor session. Sign in again and retry.",
        variant: "destructive",
      })
      return
    }

    try {
      setCreating(true)
      const response = await studentApiFetch("/api/classroom-points/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildInstructorAuthorizedApiHeaders(),
        },
        body: JSON.stringify({
          ...classroomAssignmentFormToApiPayload({
            ...formValues,
            submissionKind: CLASSROOM_SUBMISSION_KIND_CODE,
          }),
          instructorId,
        }),
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { error?: string; details?: string }
        throw new Error(errorData.error || errorData.details || "Failed to create challenge")
      }

      toast({
        title: "Coding challenge published",
        description: "Students can submit from Classroom Points. Open it in the IDE to prepare starter code.",
      })
      setFormValues({
        ...emptyClassroomAssignmentForm(),
        submissionKind: CLASSROOM_SUBMISSION_KIND_CODE,
        neverExpires: true,
      })
      setShowCreate(false)
      await reload()
    } catch (createError) {
      toast({
        title: "Could not create challenge",
        description: createError instanceof Error ? createError.message : "Try again from Classroom Points.",
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }, [formValues, reload, toast])

  return (
    <div className="instructor-challenges-panel flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-1">
      <div className={cn(chrome.card, "space-y-3 p-4 sm:p-5")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 shrink-0 text-[var(--cc-accent)]" />
              <h2 className={cn("text-base font-semibold", PORTAL_TEXT)}>Coding challenges</h2>
            </div>
            <p className={cn("max-w-2xl text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>
              Publish assignable coding problems through{" "}
              <strong className="font-medium text-[var(--cc-text)]">Classroom Points</strong>. Students submit code
              there; you approve submissions and award points. Use the IDE here to write starter code and demo live.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void reload()} disabled={loading}>
              {loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
              Refresh
            </Button>
            <Button type="button" size="sm" onClick={() => setShowCreate((value) => !value)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              {showCreate ? "Cancel" : "New challenge"}
            </Button>
          </div>
        </div>

        <ol className={cn("instructor-steps-grid text-xs", PORTAL_TEXT_MUTED)}>
          <li className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2">
            <span className="font-semibold text-[var(--cc-text)]">1. Create</span> — title + problem description
          </li>
          <li className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2">
            <span className="font-semibold text-[var(--cc-text)]">2. Teach</span> — open in IDE with starter code
          </li>
          <li className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2">
            <span className="font-semibold text-[var(--cc-text)]">3. Grade</span> — approve in Classroom Points
          </li>
        </ol>

        <Link
          href={CLASSROOM_POINTS_HREF}
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--cc-accent)] hover:underline"
        >
          Manage submissions & approvals in Classroom Points
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {showCreate ? (
        <div className={cn(chrome.card, "space-y-5 p-4 sm:p-5")}>
          <div>
            <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>New coding challenge</p>
            <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
              This creates a <strong>Code assignment</strong> in Classroom Points. Solution uploads use the Classroom
              Points module directly.
            </p>
          </div>

          <ClassroomAssignmentFormFields
            values={{ ...formValues, submissionKind: CLASSROOM_SUBMISSION_KIND_CODE }}
            onChange={(next) => setFormValues({ ...next, submissionKind: CLASSROOM_SUBMISSION_KIND_CODE })}
            showKindSelector={false}
          />

          <ClassroomAssignmentAvailabilityFields
            values={formValues}
            onChange={setFormValues}
            sessions={sessions}
          />

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void handleCreate()} disabled={creating}>
              {creating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Publish challenge
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)} disabled={creating}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>Published challenges</h3>
          {sessionOptions.length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              {sessionOptions.map((session) => (
                <Button
                  key={session}
                  type="button"
                  size="sm"
                  variant={sessionFilter === session ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setSessionFilter(session)}
                >
                  {session === "all" ? "All sections" : session}
                </Button>
              ))}
            </div>
          ) : null}
        </div>

        {error ? (
          <div className={cn(chrome.card, "p-4 text-sm text-red-600 dark:text-red-400")}>{error}</div>
        ) : loading ? (
          <div className={cn(chrome.card, "flex items-center gap-2 p-6 text-sm", PORTAL_TEXT_MUTED)}>
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading course challenges…
          </div>
        ) : codeChallenges.length === 0 ? (
          <div className={cn(chrome.card, "space-y-3 p-6 text-center")}>
            <p className={cn("text-sm font-medium", PORTAL_TEXT)}>No coding challenges yet</p>
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
              Create one above, or open Classroom Points to import existing assignments.
            </p>
            <Button type="button" size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Create your first challenge
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="instructor-challenges-grid grid grid-cols-1 gap-4">
              {challengePaging.rows.map((row) => (
                <ChallengeCard
                  key={row.id}
                  row={row}
                  onOpen={onOpenClassroomInIde}
                  sessions={sessions.length > 0 ? sessions : sessionOptions}
                  onMutated={() => void reload()}
                />
              ))}
            </div>
            <CodebenchListPagination
              page={challengePaging.page}
              pageSize={CODEBENCH_CHALLENGES_PAGE_SIZE}
              totalItems={challengePaging.total}
              onPageChange={setListPage}
            />
          </div>
        )}
      </section>

      {libraryDrafts.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>Teaching library drafts</h3>
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
              Local challenge templates saved under category “Challenges” in your teaching library.
            </p>
          </div>
          <div className="instructor-challenges-grid grid grid-cols-1 gap-4">
            {libraryDrafts.map((item) => (
              <DraftChallengeCard key={item.id} item={item} onOpen={onOpenLibraryInIde} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
