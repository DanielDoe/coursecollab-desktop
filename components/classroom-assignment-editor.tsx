"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { QuestionMediaPanel } from "@/components/question-media-panel"
import { QuestionMediaDisplay } from "@/components/question-media-display"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { parseQuestionMedia, type QuestionMedia } from "@/lib/question-media"
import {
  assignmentNeverExpires,
  datetimeLocalToDueAtIso,
  dueAtToDatetimeLocal,
} from "@/lib/classroom-submission-availability"
import {
  buildClassroomCircuitQuestionConfig,
  CLASSROOM_SUBMISSION_KIND_CODE,
  CLASSROOM_SUBMISSION_KIND_SOLUTION,
  isClassroomSolutionAssignment,
  parseClassroomSolutionQuestionConfig,
  type ClassroomSolutionQuestionConfig,
  type ClassroomSubmissionKind,
} from "@/lib/classroom-solution-submission"
import { buildCircuitSubmissionConfig, parseCircuitSubmissionConfig } from "@/lib/circuit-submission"

/** Deduplicated session list for UI — always includes "all" first when present. */
export function uniqueSessionOptions(sessions: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  const add = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    result.push(trimmed)
  }
  if (sessions.some((s) => s.trim().toLowerCase() === "all")) add("all")
  for (const session of sessions) {
    if (session.trim().toLowerCase() === "all") continue
    add(session)
  }
  if (!seen.has("all")) result.unshift("all")
  return result
}

export type ClassroomAssignmentFormValues = {
  title: string
  description: string
  submissionKind: ClassroomSubmissionKind
  questionConfig: ClassroomSolutionQuestionConfig | null
  session: string | null
  neverExpires: boolean
  dueAtLocal: string
  restartAvailability: boolean
}

export function emptyClassroomAssignmentForm(): ClassroomAssignmentFormValues {
  return {
    title: "",
    description: "",
    submissionKind: CLASSROOM_SUBMISSION_KIND_CODE,
    questionConfig: null,
    session: null,
    neverExpires: false,
    dueAtLocal: "",
    restartAvailability: false,
  }
}

export function emptySolutionQuestionConfig(title = ""): ClassroomSolutionQuestionConfig {
  return buildClassroomCircuitQuestionConfig({
    title: title || "Assignment problem",
    question_text: "",
    submission_instructions:
      "Show all work. Upload a PDF or photo, or use the ink workspace to write your solution.",
    points_hint: 2.5,
  })
}

export function assignmentFormFromSubmission(submission: {
  title?: string
  description?: string | null
  submission_kind?: string
  question_config?: unknown
  session?: string | null
  due_at?: string | null
  duration_hours?: number | null
  expires_at?: string | null
}): ClassroomAssignmentFormValues {
  const kind = isClassroomSolutionAssignment(submission.submission_kind)
    ? CLASSROOM_SUBMISSION_KIND_SOLUTION
    : CLASSROOM_SUBMISSION_KIND_CODE
  const parsed = parseClassroomSolutionQuestionConfig(submission.question_config)
  const neverExpires = assignmentNeverExpires(submission)
  return {
    title: submission.title?.trim() || "",
    description: submission.description?.trim() || "",
    submissionKind: kind,
    questionConfig:
      kind === CLASSROOM_SUBMISSION_KIND_SOLUTION
        ? parsed ?? emptySolutionQuestionConfig(submission.title)
        : null,
    session: submission.session ?? null,
    neverExpires,
    dueAtLocal: neverExpires
      ? ""
      : dueAtToDatetimeLocal(submission.due_at ?? submission.expires_at),
    restartAvailability: false,
  }
}

export function ClassroomAssignmentProblemFields({
  values,
  onChange,
  variant = "stacked",
}: {
  values: ClassroomAssignmentFormValues
  onChange: (next: ClassroomAssignmentFormValues) => void
  /** stacked = single column (modals); split = text | media side-by-side on xl */
  variant?: "stacked" | "split"
}) {
  const qc = values.questionConfig ?? emptySolutionQuestionConfig(values.title)

  const setQuestionConfig = (patch: Partial<ClassroomSolutionQuestionConfig>) => {
    onChange({
      ...values,
      questionConfig: patchQuestionConfig(values.questionConfig, patch, values.title),
    })
  }

  const media = parseQuestionMedia(qc.question_media)

  const textFields = (
    <div className="space-y-5 min-w-0">
      <div className="space-y-1.5">
        <Label>
          Problem statement <span className="text-red-500">*</span>
        </Label>
        <Textarea
          rows={5}
          value={qc.question_text}
          onChange={(e) => setQuestionConfig({ question_text: e.target.value })}
          placeholder="Exercise 3-3: Apply the supernode concept to determine the current I in the circuit of Fig. E3.3."
          className="min-h-[120px] resize-y"
        />
        <p className="text-xs text-muted-foreground">Supports LaTeX, e.g. \\(I\\) and \\(\\Omega\\).</p>
      </div>

      <div className="space-y-1.5">
        <Label>Submission instructions (shown to students)</Label>
        <Textarea
          rows={3}
          value={qc.solution_upload_config?.submission_instructions ?? ""}
          onChange={(e) =>
            setQuestionConfig({
              solution_upload_config: buildCircuitSubmissionConfig({
                ...parseCircuitSubmissionConfig(qc.solution_upload_config),
                title: values.title || qc.question_text.slice(0, 80),
                submission_instructions: e.target.value,
                require_solution_upload: true,
                grading_type: "manual",
              }),
            })
          }
          className="min-h-[88px] resize-y"
        />
      </div>

      <div className="max-w-md space-y-1.5">
        <Label>Expected answer (instructor reference only)</Label>
        <Input
          value={qc.expected_answer ?? ""}
          onChange={(e) => setQuestionConfig({ expected_answer: e.target.value || null })}
          placeholder="e.g., I = 0.5 A"
        />
      </div>
    </div>
  )

  const mediaPanel = (
    <QuestionMediaPanel
      media={media}
      onChange={(next: QuestionMedia) => {
        setQuestionConfig({
          question_media:
            next.media_enabled && next.media_url
              ? {
                  ...next,
                  media_placement: next.media_placement ?? "above_question",
                  media_allow_zoom: next.media_allow_zoom !== false,
                }
              : null,
        })
      }}
      allowUpload
      layout={variant === "stacked" ? "stacked" : "default"}
      embedded
    />
  )

  if (variant === "split") {
    return (
      <div className="grid gap-8 xl:grid-cols-2 xl:items-start">
        {textFields}
        <div className="min-w-0 xl:sticky xl:top-0">{mediaPanel}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {textFields}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Circuit figure</Label>
        {mediaPanel}
      </div>
    </div>
  )
}

function patchQuestionConfig(
  current: ClassroomSolutionQuestionConfig | null,
  patch: Partial<ClassroomSolutionQuestionConfig>,
  title: string,
): ClassroomSolutionQuestionConfig {
  const base = current ?? emptySolutionQuestionConfig(title)
  return { ...base, ...patch }
}

export function ClassroomAssignmentFormFields({
  values,
  onChange,
  showKindSelector = true,
  previewMode = false,
}: {
  values: ClassroomAssignmentFormValues
  onChange: (next: ClassroomAssignmentFormValues) => void
  showKindSelector?: boolean
  previewMode?: boolean
}) {
  const isSolution = values.submissionKind === CLASSROOM_SUBMISSION_KIND_SOLUTION

  const setKind = (kind: ClassroomSubmissionKind) => {
    onChange({
      ...values,
      submissionKind: kind,
      questionConfig:
        kind === CLASSROOM_SUBMISSION_KIND_SOLUTION
          ? values.questionConfig ?? emptySolutionQuestionConfig(values.title)
          : null,
    })
  }

  if (previewMode && isSolution) {
    const qc = values.questionConfig ?? emptySolutionQuestionConfig(values.title)
    return (
      <div className="space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Solution assignment</Badge>
          {qc.expected_answer ? (
            <Badge variant="outline" className="text-xs">
              Ref: {qc.expected_answer}
            </Badge>
          ) : null}
        </div>
        <QuestionMediaDisplay question={{ question_media: qc.question_media }} size="medium" />
        <QuestionTextRenderer
          text={qc.question_text}
          className="text-sm leading-relaxed text-slate-800 dark:text-slate-100"
        />
        {qc.solution_upload_config?.submission_instructions ? (
          <p className="text-xs text-muted-foreground">{qc.solution_upload_config.submission_instructions}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {showKindSelector ? (
        <div className="space-y-1.5">
          <Label>Assignment type</Label>
          <Select value={values.submissionKind} onValueChange={(v) => setKind(v as ClassroomSubmissionKind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CLASSROOM_SUBMISSION_KIND_CODE}>Code assignment</SelectItem>
              <SelectItem value={CLASSROOM_SUBMISSION_KIND_SOLUTION}>
                Solution assignment (upload / photo / workspace)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label>
          Title <span className="text-red-500">*</span>
        </Label>
        <Input
          value={values.title}
          onChange={(e) => onChange({ ...values, title: e.target.value })}
          placeholder="e.g., Exercise 3-1 — Nodal Analysis"
        />
      </div>

      <div className="space-y-1.5">
        <Label>{isSolution ? "Instructor notes (optional)" : "Assignment description"}</Label>
        <Textarea
          rows={3}
          value={values.description}
          onChange={(e) => onChange({ ...values, description: e.target.value })}
          placeholder={
            isSolution
              ? "Internal notes for faculty — not shown as the problem statement."
              : "Describe what students should implement. Used for AI validation of code submissions."
          }
        />
      </div>

      {isSolution ? (
        <div className="space-y-3 rounded-xl border border-violet-200/60 bg-violet-50/30 p-4 dark:border-violet-500/20 dark:bg-violet-500/5">
          <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">Problem content</p>
          <ClassroomAssignmentProblemFields values={values} onChange={onChange} variant="split" />
        </div>
      ) : null}
    </div>
  )
}

export function ClassroomAssignmentAvailabilityFields({
  values,
  onChange,
  sessions,
  showRestartOption = false,
}: {
  values: ClassroomAssignmentFormValues
  onChange: (next: ClassroomAssignmentFormValues) => void
  sessions: string[]
  showRestartOption?: boolean
}) {
  const sessionOptions = uniqueSessionOptions(sessions)
  const selectedSession = values.session ?? "all"

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Session</Label>
          <Select
            value={selectedSession}
            onValueChange={(value) =>
              onChange({
                ...values,
                session: value === "all" ? null : value,
              })
            }
          >
            <SelectTrigger className="w-full sm:max-w-md">
              <SelectValue placeholder="Select session" />
            </SelectTrigger>
            <SelectContent>
              {sessionOptions.map((session) => (
                <SelectItem key={`session-opt-${session}`} value={session}>
                  {session === "all" ? "All sections" : session}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-slate-200/80 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/40">
          <Checkbox
            id="assignment-never-expires"
            checked={values.neverExpires}
            onCheckedChange={(checked) =>
              onChange({
                ...values,
                neverExpires: checked === true,
                dueAtLocal: checked === true ? "" : values.dueAtLocal,
              })
            }
            className="mt-0.5"
          />
          <label
            htmlFor="assignment-never-expires"
            className="cursor-pointer text-sm leading-snug text-slate-700 dark:text-slate-300"
          >
            No due date — keep in library (students will not see it until you set a due date)
          </label>
        </div>

        {!values.neverExpires ? (
          <div className="space-y-1.5">
            <Label>
              Due by <span className="text-red-500">*</span>
            </Label>
            <Input
              type="datetime-local"
              value={values.dueAtLocal}
              onChange={(e) => onChange({ ...values, dueAtLocal: e.target.value })}
              className="w-full"
            />
          </div>
        ) : (
          <div className="hidden sm:block" aria-hidden />
        )}
      </div>

      {!values.neverExpires ? (
        <p className="text-xs text-muted-foreground -mt-2">
          Times use your local timezone. Students cannot submit after the due time.
        </p>
      ) : null}

      {showRestartOption ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200/80 bg-amber-50/50 p-3 dark:border-amber-800/40 dark:bg-amber-950/20">
          <Checkbox
            id="assignment-restart"
            checked={values.restartAvailability}
            onCheckedChange={(checked) =>
              onChange({ ...values, restartAvailability: checked === true })
            }
            className="mt-0.5"
          />
          <label
            htmlFor="assignment-restart"
            className="text-sm text-slate-700 dark:text-slate-300 leading-snug cursor-pointer"
          >
            Reopen from now — resets when the assignment was posted (for reusing expired items).
          </label>
        </div>
      ) : null}
    </div>
  )
}

export function classroomAssignmentFormToApiPayload(values: ClassroomAssignmentFormValues) {
  const payload: Record<string, unknown> = {
    title: values.title.trim(),
    description: values.description.trim() || null,
    submissionKind: values.submissionKind,
    session: values.session,
  }

  if (values.neverExpires) {
    payload.dueAt = null
    payload.durationHours = null
  } else if (values.dueAtLocal.trim()) {
    payload.dueAt = datetimeLocalToDueAtIso(values.dueAtLocal)
    payload.durationHours = null
  }

  if (values.restartAvailability) {
    payload.restartAvailability = true
  }
  if (values.submissionKind === CLASSROOM_SUBMISSION_KIND_SOLUTION && values.questionConfig) {
    const qc = values.questionConfig
    payload.questionConfig = {
      ...qc,
      solution_upload_config: buildCircuitSubmissionConfig({
        ...(qc.solution_upload_config ?? {}),
        title: values.title.trim() || qc.question_text.slice(0, 80),
        require_solution_upload: true,
        grading_type: "manual",
      }),
    }
  } else {
    payload.questionConfig = null
  }
  return payload
}
