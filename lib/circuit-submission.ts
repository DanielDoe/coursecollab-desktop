/**
 * Circuit Submission — upload-only manual grading for textbook circuit problems.
 */

import type { SolutionUploadAttachment, SolutionUploadsMap } from "@/lib/solution-upload"
import { ROOT_SOLUTION_PART_KEY } from "@/lib/solution-upload"
import {
  parseCircuitWorkspace,
  workspaceHasContent,
  type CircuitSubmissionMode,
  type CircuitWorkspace,
} from "@/lib/circuit-workspace"
import { parseWorkspaceReplay, type WorkspaceReplay } from "@/lib/workspace-replay"
import { flattenStoredAiFeedback } from "@/lib/flatten-stored-ai-feedback"
import {
  applyCircuitDisplayScoreFloor,
  applyCircuitViableSubmissionFloor,
} from "@/lib/circuit-submission-grading-policy"

export type CircuitSubmissionStatus =
  | "not_started"
  | "draft"
  | "submitted"
  | "graded"
  | "returned"

/** How a circuit submission was resolved for scoring / instructor queues. */
export type CircuitSubmissionGradingOutcome =
  | "graded"
  | "missing_submission"
  | "evaluation_failed"
  | "instructor_review"

const CIRCUIT_EVALUATION_FAILED_ERRORS = new Set([
  "missing_api_key",
  "no_vision_assets",
  "api_error",
  "parse_error",
  "ai_failed",
])

export function isCircuitSubmissionEvaluationFailed(
  aiFeedback: { errorType?: string; technicalError?: string } | null | undefined,
): boolean {
  if (!aiFeedback) return false
  const err = String(aiFeedback.errorType ?? "").trim()
  return Boolean(err && CIRCUIT_EVALUATION_FAILED_ERRORS.has(err))
}

export function readCircuitSubmissionGradingOutcome(
  aiFeedback: unknown,
): CircuitSubmissionGradingOutcome | null {
  if (!aiFeedback || typeof aiFeedback !== "object") return null
  const raw = (aiFeedback as { gradingOutcome?: unknown }).gradingOutcome
  if (
    raw === "graded" ||
    raw === "missing_submission" ||
    raw === "evaluation_failed" ||
    raw === "instructor_review"
  ) {
    return raw
  }
  return null
}

export type CircuitSubmissionRubric = {
  setup?: number
  method?: number
  calculations?: number
  final_answer?: number
}

export type CircuitSubmissionRubricScores = {
  setup?: number | null
  method?: number | null
  calculations?: number | null
  final_answer?: number | null
}

export type CircuitSubmissionConfig = {
  /** Display title (e.g. "Problem 2.17 - Current Distribution") */
  title?: string
  submission_instructions?: string
  max_files?: number
  require_solution_upload?: boolean
  grading_type?: "manual"
  /** Instructor-only rubric (not shown to students) */
  rubric?: CircuitSubmissionRubric
}

export type CircuitSubmissionAnswer = {
  version: 1
  submission_status?: CircuitSubmissionStatus
  submission_mode?: CircuitSubmissionMode
  workspace?: CircuitWorkspace | null
  workspace_replay?: WorkspaceReplay | null
  solution_uploads?: SolutionUploadsMap
  instructor_feedback?: string | null
  manual_score?: number | null
  rubric_scores?: CircuitSubmissionRubricScores | null
  graded_at?: string | null
  graded_by?: string | null
}

export type { CircuitSubmissionMode, CircuitWorkspace }

export const CIRCUIT_SUBMISSION_DEFAULT_TOPIC = "Chapter 2: Resistive Circuits Submissions"

export const CIRCUIT_SUBMISSION_DEFAULT_INSTRUCTIONS =
  "Show all work. Upload a clear image or PDF of your complete solution. Answers without supporting calculations may receive reduced credit."

export const CIRCUIT_SUBMISSION_DEFAULT_RUBRIC: CircuitSubmissionRubric = {
  setup: 3,
  method: 3,
  calculations: 2,
  final_answer: 2,
}

export const CIRCUIT_SUBMISSION_RUBRIC_KEYS = [
  "setup",
  "method",
  "calculations",
  "final_answer",
] as const

export const CIRCUIT_SUBMISSION_RUBRIC_LABELS: Record<
  (typeof CIRCUIT_SUBMISSION_RUBRIC_KEYS)[number],
  string
> = {
  setup: "Setup",
  method: "Method",
  calculations: "Calculations",
  final_answer: "Final answer",
}

export const CIRCUIT_SUBMISSION_MAX_FILES = 10
export const CIRCUIT_SUBMISSION_MAX_BYTES = 25 * 1024 * 1024

/** Shown wherever students see a provisional circuit AI preview (not the final grade). */
export const CIRCUIT_PROVISIONAL_STUDENT_REASSURANCE =
  "This is a provisional AI preview — not your final grade. Your instructor will review your uploaded work and may adjust the score. You do not need to resubmit; please do not worry if the preview looks low."

export function isCircuitEvalProvisionalFeedback(af: unknown): boolean {
  if (!af || typeof af !== "object") return false
  const o = af as Record<string, unknown>
  return o.provisionalScore === true || o.requiresInstructorApproval === true
}

export const CIRCUIT_SUBMISSION_ACCEPT =
  "application/pdf,image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif,.heic,.heif"

export function parseCircuitSubmissionRubric(raw: unknown): CircuitSubmissionRubric | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const obj = raw as Record<string, unknown>
  const rubric: CircuitSubmissionRubric = {}
  for (const key of CIRCUIT_SUBMISSION_RUBRIC_KEYS) {
    const val = Number(obj[key])
    if (Number.isFinite(val) && val >= 0) rubric[key] = val
  }
  return Object.keys(rubric).length > 0 ? rubric : undefined
}

export function circuitSubmissionRubricMaxPoints(rubric?: CircuitSubmissionRubric | null): number {
  if (!rubric) return 0
  return CIRCUIT_SUBMISSION_RUBRIC_KEYS.reduce((sum, key) => sum + (rubric[key] ?? 0), 0)
}

export function sumCircuitSubmissionRubricScores(
  scores?: CircuitSubmissionRubricScores | null,
): number {
  if (!scores) return 0
  return CIRCUIT_SUBMISSION_RUBRIC_KEYS.reduce((sum, key) => {
    const val = scores[key]
    return sum + (typeof val === "number" && Number.isFinite(val) ? val : 0)
  }, 0)
}

export function parseCircuitSubmissionConfig(raw: unknown): CircuitSubmissionConfig {
  const base: CircuitSubmissionConfig = {
    require_solution_upload: true,
    grading_type: "manual",
    max_files: CIRCUIT_SUBMISSION_MAX_FILES,
    submission_instructions: CIRCUIT_SUBMISSION_DEFAULT_INSTRUCTIONS,
    rubric: CIRCUIT_SUBMISSION_DEFAULT_RUBRIC,
  }
  if (raw == null || raw === "") return base
  try {
    const obj =
      typeof raw === "string" ? (JSON.parse(raw) as Record<string, unknown>) : (raw as Record<string, unknown>)
    if (!obj || typeof obj !== "object") return base
    const maxFiles = Number(obj.max_files)
    const rubric = parseCircuitSubmissionRubric(obj.rubric) ?? base.rubric
    return {
      title: typeof obj.title === "string" && obj.title.trim() ? obj.title.trim() : undefined,
      submission_instructions:
        typeof obj.submission_instructions === "string" && obj.submission_instructions.trim()
          ? obj.submission_instructions.trim()
          : base.submission_instructions,
      max_files:
        Number.isFinite(maxFiles) && maxFiles >= 1 && maxFiles <= CIRCUIT_SUBMISSION_MAX_FILES
          ? maxFiles
          : CIRCUIT_SUBMISSION_MAX_FILES,
      require_solution_upload: obj.require_solution_upload !== false,
      grading_type: "manual",
      rubric,
    }
  } catch {
    return base
  }
}

export function buildCircuitSubmissionConfig(
  cfg: Partial<CircuitSubmissionConfig> = {},
): CircuitSubmissionConfig {
  return parseCircuitSubmissionConfig(cfg)
}

export function parseCircuitSubmissionAnswer(raw: unknown): CircuitSubmissionAnswer {
  const base: CircuitSubmissionAnswer = { version: 1, submission_status: "not_started", solution_uploads: {} }
  if (raw == null || raw === "") return base
  try {
    const obj =
      typeof raw === "string" ? (JSON.parse(raw) as Record<string, unknown>) : (raw as Record<string, unknown>)
    if (!obj || typeof obj !== "object") return base

    // Autosave wraps the circuit JSON in answer_data.answer — unwrap before reading uploads.
    if (
      !obj.solution_uploads &&
      typeof obj.answer === "string" &&
      obj.answer.trim().startsWith("{")
    ) {
      return parseCircuitSubmissionAnswer(obj.answer)
    }

    const uploads =
      obj.solution_uploads && typeof obj.solution_uploads === "object"
        ? (obj.solution_uploads as SolutionUploadsMap)
        : {}
    const status = obj.submission_status as CircuitSubmissionStatus | undefined
    const rubricRaw = obj.rubric_scores
    const rubric_scores =
      rubricRaw && typeof rubricRaw === "object"
        ? (rubricRaw as CircuitSubmissionRubricScores)
        : null
    const mode = obj.submission_mode as CircuitSubmissionMode | undefined
    const submission_mode =
      mode && ["upload", "photo", "workspace"].includes(mode) ? mode : undefined
    const workspace = parseCircuitWorkspace(obj.workspace)
    const workspace_replay = parseWorkspaceReplay(obj.workspace_replay)
    return {
      version: 1,
      submission_status: status ?? inferCircuitSubmissionStatus(uploads, workspace),
      submission_mode,
      workspace,
      workspace_replay,
      solution_uploads: uploads,
      instructor_feedback:
        typeof obj.instructor_feedback === "string" ? obj.instructor_feedback : obj.instructor_feedback ?? null,
      manual_score: typeof obj.manual_score === "number" ? obj.manual_score : null,
      rubric_scores,
      graded_at: typeof obj.graded_at === "string" ? obj.graded_at : null,
      graded_by: typeof obj.graded_by === "string" ? obj.graded_by : null,
    }
  } catch {
    return base
  }
}

export function inferCircuitSubmissionStatus(
  uploads: SolutionUploadsMap,
  workspace?: CircuitWorkspace | null,
): CircuitSubmissionStatus {
  const count = Object.keys(uploads).filter((k) => uploads[k]?.url?.trim()).length
  if (count === 0 && !workspaceHasContent(workspace)) return "not_started"
  return "draft"
}

export function circuitSubmissionFileCount(uploads: SolutionUploadsMap | undefined): number {
  if (!uploads) return 0
  return Object.values(uploads).filter((a) => a?.url?.trim()).length
}

export function circuitSubmissionHasRequiredUpload(
  answerRaw: unknown,
  cfg?: CircuitSubmissionConfig,
): boolean {
  const config = cfg ?? parseCircuitSubmissionConfig(null)
  if (config.require_solution_upload === false) return true
  const parsed = parseCircuitSubmissionAnswer(answerRaw)
  if (circuitSubmissionFileCount(parsed.solution_uploads) >= 1) return true
  if (parsed.submission_mode === "workspace" && workspaceHasContent(parsed.workspace)) return true
  return false
}

/** Indexed part keys: f0, f1, … for multi-file uploads */
export function circuitSubmissionPartKey(index: number): string {
  return index === 0 ? ROOT_SOLUTION_PART_KEY : `f${index}`
}

export function listCircuitSubmissionFiles(uploads: SolutionUploadsMap | undefined): SolutionUploadAttachment[] {
  if (!uploads) return []
  return Object.entries(uploads)
    .filter(([, att]) => att?.url?.trim())
    .sort(([a], [b]) => {
      const order = (k: string) => (k === ROOT_SOLUTION_PART_KEY ? 0 : Number.parseInt(k.replace(/^f/, ""), 10) || 999)
      return order(a) - order(b)
    })
    .map(([, att]) => att)
}

export function isCircuitSubmissionQuestionType(questionType: string | null | undefined): boolean {
  return (questionType || "").toLowerCase() === "circuit_submission"
}

/**
 * Drop heavy workspace ink / replay from API payloads when PNG uploads exist.
 * Prevents submit/eval timeouts from multi‑hundred‑KB JSON bodies.
 */
export function compactCircuitSubmissionForSubmit(answerRaw: unknown): string {
  const parsed = parseCircuitSubmissionAnswer(answerRaw)
  const uploads = parsed.solution_uploads ?? {}
  const hasUploads = circuitSubmissionFileCount(uploads) > 0
  if (!hasUploads) {
    return typeof answerRaw === "string" ? answerRaw : JSON.stringify(parsed)
  }
  return JSON.stringify({
    version: 1 as const,
    submission_status: parsed.submission_status ?? "submitted",
    submission_mode: parsed.submission_mode,
    solution_uploads: uploads,
  })
}

/**
 * Lightweight autosave payload — keeps workspace ink + uploads but drops workspace_replay.
 * Replay stays in-memory until submit/export so debounced saves do not duplicate every stroke.
 */
export function compactCircuitSubmissionForAutoSave(answerRaw: unknown): string {
  const parsed = parseCircuitSubmissionAnswer(answerRaw)
  const payload: CircuitSubmissionAnswer = {
    version: 1,
    submission_status: parsed.submission_status ?? "draft",
    submission_mode: parsed.submission_mode,
    solution_uploads: parsed.solution_uploads ?? {},
  }
  if (parsed.submission_mode === "workspace" && parsed.workspace) {
    payload.workspace = parsed.workspace
  }
  return JSON.stringify(payload)
}

function countWorkspaceStrokes(workspace: CircuitWorkspace | null | undefined): number {
  if (!workspace?.pages?.length) return 0
  return workspace.pages.reduce((sum, page) => sum + (page.strokes?.length ?? 0), 0)
}

/**
 * Merge incoming autosave with existing DB row — never drop richer workspace ink or uploads.
 * Mirrors code-answer data-loss prevention in save-answer.
 */
export function mergeCircuitSubmissionForAutoSave(
  incomingRaw: unknown,
  existingRaw: unknown,
): string {
  const incoming = parseCircuitSubmissionAnswer(incomingRaw)
  const existing = parseCircuitSubmissionAnswer(existingRaw)

  const incomingStrokes = countWorkspaceStrokes(incoming.workspace)
  const existingStrokes = countWorkspaceStrokes(existing.workspace)
  const workspace =
    incomingStrokes >= existingStrokes ? incoming.workspace : existing.workspace

  const solution_uploads: SolutionUploadsMap = {
    ...(existing.solution_uploads ?? {}),
    ...(incoming.solution_uploads ?? {}),
  }

  const hasWorkspace = countWorkspaceStrokes(workspace) > 0
  const hasUploads = circuitSubmissionFileCount(solution_uploads) > 0
  const submission_mode: CircuitSubmissionMode | undefined = hasWorkspace
    ? "workspace"
    : hasUploads
      ? incoming.submission_mode ?? existing.submission_mode
      : incoming.submission_mode ?? existing.submission_mode

  return compactCircuitSubmissionForAutoSave({
    version: 1,
    submission_status: incoming.submission_status ?? existing.submission_status ?? "draft",
    submission_mode,
    solution_uploads,
    workspace: workspace ?? incoming.workspace ?? existing.workspace,
  })
}

/** Build answer JSON; include replay only when persisting for final submit. */
export function buildCircuitSubmissionAnswerJson(
  answer: CircuitSubmissionAnswer,
  options?: { includeReplay?: boolean; replay?: WorkspaceReplay | null },
): string {
  const payload: CircuitSubmissionAnswer = { ...answer, version: 1 }
  if (options?.includeReplay && options.replay) {
    payload.workspace_replay = options.replay
  } else {
    delete payload.workspace_replay
  }
  return JSON.stringify(payload)
}

type CircuitAnswerEvalSource =
  | string
  | null
  | undefined
  | { selectedAnswer?: unknown; answerData?: unknown }

function circuitAnswerRichness(parsed: CircuitSubmissionAnswer): number {
  const uploadCount = circuitSubmissionFileCount(parsed.solution_uploads)
  const strokeCount =
    parsed.submission_mode === "workspace" ? countWorkspaceStrokes(parsed.workspace) : 0
  return uploadCount * 10000 + strokeCount
}

/**
 * Pick the richest circuit payload among client + server sources.
 * Used at quiz finalize when uploads were saved via API but debounced client state is stale.
 */
export function resolveCircuitAnswerJsonForEval(sources: CircuitAnswerEvalSource[]): string {
  let best = parseCircuitSubmissionAnswer("{}")
  let bestScore = -1

  const consider = (parsed: CircuitSubmissionAnswer) => {
    const score = circuitAnswerRichness(parsed)
    if (score > bestScore) {
      best = parsed
      bestScore = score
    }
  }

  for (const src of sources) {
    if (src == null) continue
    if (typeof src === "object" && ("selectedAnswer" in src || "answerData" in src)) {
      consider(resolveCircuitSubmissionForGrading(src.selectedAnswer, src.answerData))
      continue
    }
    const raw = String(src).trim()
    if (!raw) continue
    consider(parseCircuitSubmissionAnswer(raw))
  }

  return compactCircuitSubmissionForSubmit({
    ...best,
    submission_status: "submitted",
  })
}

export function mergeCircuitSubmissionGrading(
  answerRaw: unknown,
  patch: {
    manual_score?: number | null
    instructor_feedback?: string | null
    rubric_scores?: CircuitSubmissionRubricScores | null
    graded_by?: string | null
    graded_at?: string | null
    submission_status?: CircuitSubmissionStatus
  },
): CircuitSubmissionAnswer {
  const parsed = parseCircuitSubmissionAnswer(answerRaw)
  return {
    ...parsed,
    manual_score: patch.manual_score ?? parsed.manual_score ?? null,
    instructor_feedback: patch.instructor_feedback ?? parsed.instructor_feedback ?? null,
    rubric_scores: patch.rubric_scores ?? parsed.rubric_scores ?? null,
    graded_by: patch.graded_by ?? parsed.graded_by ?? null,
    graded_at: patch.graded_at ?? parsed.graded_at ?? new Date().toISOString(),
    submission_status: patch.submission_status ?? "graded",
  }
}

export type CircuitSubmissionAiFeedbackHints = {
  rubricScores?: CircuitSubmissionRubricScores | null
  totalScore?: number | null
  feedback?: string | null
  strengths?: string[]
  improvements?: string[]
  confidence?: string | null
  aiGraded?: boolean
}

function emptyRubricScoreValues(): CircuitSubmissionRubricScores {
  return { setup: null, method: null, calculations: null, final_answer: null }
}

function hasAnyRubricScore(scores?: CircuitSubmissionRubricScores | null): boolean {
  if (!scores) return false
  return CIRCUIT_SUBMISSION_RUBRIC_KEYS.some(
    (key) => typeof scores[key] === "number" && Number.isFinite(scores[key]),
  )
}

function mergeRubricScoreValues(
  a?: CircuitSubmissionRubricScores | null,
  b?: CircuitSubmissionRubricScores | null,
): CircuitSubmissionRubricScores {
  const result = emptyRubricScoreValues()
  for (const key of CIRCUIT_SUBMISSION_RUBRIC_KEYS) {
    const av = a?.[key]
    const bv = b?.[key]
    if (typeof av === "number" && Number.isFinite(av)) result[key] = av
    else if (typeof bv === "number" && Number.isFinite(bv)) result[key] = bv
  }
  return result
}

function parseAiFeedbackHints(raw: unknown): CircuitSubmissionAiFeedbackHints | null {
  if (raw == null || raw === "") return null
  try {
    const o = flattenStoredAiFeedback(raw)
    if (!o || typeof o !== "object") return null
    const rubricRaw =
      o.rubricScores ?? o.rubricScoresPreview ?? o.rubric_scores
    const rubricScores =
      rubricRaw && typeof rubricRaw === "object" ? (rubricRaw as CircuitSubmissionRubricScores) : null
    const totalScore =
      typeof o.totalScore === "number"
        ? o.totalScore
        : typeof o.totalScorePreview === "number"
          ? o.totalScorePreview
          : null
    const feedback = typeof o.feedback === "string" && o.feedback.trim() ? o.feedback.trim() : null
    const strengths = Array.isArray(o.strengths)
      ? (o.strengths as unknown[]).map((s) => String(s)).filter(Boolean)
      : []
    const improvements = Array.isArray(o.improvements)
      ? (o.improvements as unknown[]).map((s) => String(s)).filter(Boolean)
      : []
    const confidence = typeof o.confidence === "string" ? o.confidence : null
    const aiGraded = o.aiGraded === true
    if (!rubricScores && totalScore == null && !feedback && !aiGraded) return null
    return { rubricScores, totalScore, feedback, strengths, improvements, confidence, aiGraded }
  } catch {
    return null
  }
}

/** Ignore corrupt override_points=0 when AI rubric indicates a positive score. */
export function effectiveCircuitOverridePoints(
  overridePoints: number | null | undefined,
  suggestedScore: number,
): number | null | undefined {
  if (overridePoints == null) return null
  if (overridePoints === 0 && suggestedScore > 0) return null
  return overridePoints
}

/** Initial rubric/score/feedback for instructor grading panel (AI + stored answer). */
export function resolveCircuitSubmissionInstructorGrading(input: {
  selectedAnswer?: unknown
  answerData?: unknown
  aiFeedback?: unknown
  pointsEarned?: number | null
  overridePoints?: number | null
}): {
  parsed: CircuitSubmissionAnswer
  aiHints: CircuitSubmissionAiFeedbackHints | null
  rubricScores: CircuitSubmissionRubricScores
  suggestedScore: number
  instructorFeedback: string
  aiFeedbackText: string | null
} {
  const parsed = parseCircuitSubmissionAnswerMerged(input.selectedAnswer, input.answerData)
  const aiHints = parseAiFeedbackHints(input.aiFeedback)
  const parsedRubric = hasAnyRubricScore(parsed.rubric_scores) ? parsed.rubric_scores : null
  const rubricScores = mergeRubricScoreValues(parsedRubric, aiHints?.rubricScores)
  const rubricSum = sumCircuitSubmissionRubricScores(rubricScores)
  const earned = input.pointsEarned
  const manualScore =
    parsed.manual_score != null && parsed.manual_score > 0 ? parsed.manual_score : null
  const aiTotal =
    aiHints?.totalScore != null && Number.isFinite(aiHints.totalScore) ? aiHints.totalScore : null
  const baseSuggested =
    manualScore ??
    (earned != null && earned > 0 ? earned : null) ??
    aiTotal ??
    (rubricSum > 0 ? rubricSum : null) ??
    0
  const suggestedScore =
    effectiveCircuitOverridePoints(input.overridePoints, Number(baseSuggested) || 0) ??
    baseSuggested
  const instructorFeedback = parsed.instructor_feedback?.trim() ?? ""
  const aiFeedbackText = aiHints?.feedback ?? (parsed.graded_by === "ai" ? instructorFeedback : null) ?? null
  const feedbackForEditor =
    instructorFeedback || (parsed.graded_by !== "ai" && parsed.graded_by ? "" : aiFeedbackText ?? "")

  const af =
    input.aiFeedback && typeof input.aiFeedback === "object"
      ? (flattenStoredAiFeedback(input.aiFeedback) as Record<string, unknown> | null)
      : null
  const rubricMax = circuitSubmissionRubricMaxPoints(CIRCUIT_SUBMISSION_DEFAULT_RUBRIC) || 10
  let finalSuggested = Number(suggestedScore) || 0
  let finalRubric = rubricScores
  if (af && finalSuggested > 0 && input.override_points == null) {
    const flooredTotal = applyCircuitDisplayScoreFloor(finalSuggested, rubricMax, af)
    if (flooredTotal > finalSuggested) {
      finalSuggested = flooredTotal
      const floored = applyCircuitViableSubmissionFloor(
        rubricScores,
        CIRCUIT_SUBMISSION_DEFAULT_RUBRIC,
        rubricSum > 0 ? rubricSum : finalSuggested,
        rubricMax,
      )
      finalRubric = floored.rubricScores
    }
  }

  return {
    parsed,
    aiHints,
    rubricScores: finalRubric,
    suggestedScore: finalSuggested,
    instructorFeedback: feedbackForEditor,
    aiFeedbackText,
  }
}

/**
 * override_points=0 with AI rubric/total but zero stored points is a corrupt row (not a real instructor zero).
 * Repairs display fields in place; does not write to DB.
 */
export function repairStaleCircuitZeroOverride(q: {
  question_type?: string
  override_points?: number | null
  points_earned?: number | null
  max_points?: number
  points?: number
  ai_feedback?: unknown
  answer_data?: unknown
  selected_answer?: unknown
}): void {
  if ((q.question_type || "").toLowerCase() !== "circuit_submission") return
  if (q.override_points !== 0) return
  if (Number(q.points_earned ?? 0) > 0) return

  const { suggestedScore } = resolveCircuitSubmissionInstructorGrading({
    selectedAnswer: q.selected_answer,
    answerData: q.answer_data,
    aiFeedback: q.ai_feedback,
    pointsEarned: q.points_earned,
    overridePoints: null,
  })
  if (suggestedScore <= 0) return

  const max = Number(q.max_points || q.points || 1) || 1
  q.override_points = null
  q.points_earned = parseFloat(Math.min(max, suggestedScore).toFixed(2))
}

function pickRicherUploads(
  a: SolutionUploadsMap | undefined,
  b: SolutionUploadsMap | undefined,
): SolutionUploadsMap {
  const countA = circuitSubmissionFileCount(a)
  const countB = circuitSubmissionFileCount(b)
  if (countB > countA) return b ?? {}
  return a ?? {}
}

/** Merge grading fields from answer_data into the parsed selected_answer (AI stores graded status in answer_data). */
export function parseCircuitSubmissionAnswerMerged(
  selectedAnswer?: unknown,
  answerData?: unknown,
): CircuitSubmissionAnswer {
  const fromSelected = parseCircuitSubmissionAnswer(selectedAnswer)
  if (answerData == null || answerData === "") return fromSelected
  try {
    const ad =
      typeof answerData === "string"
        ? (JSON.parse(answerData) as Record<string, unknown>)
        : (answerData as Record<string, unknown>)
    if (!ad || typeof ad !== "object") return fromSelected
    const fromData = parseCircuitSubmissionAnswer(ad)
    return parseCircuitSubmissionAnswer({
      ...fromSelected,
      submission_mode: fromData.submission_mode ?? fromSelected.submission_mode,
      workspace: fromData.workspace ?? fromSelected.workspace,
      workspace_replay: fromData.workspace_replay ?? fromSelected.workspace_replay,
      solution_uploads: pickRicherUploads(fromSelected.solution_uploads, fromData.solution_uploads),
      instructor_feedback:
        typeof ad.instructor_feedback === "string"
          ? ad.instructor_feedback
          : fromSelected.instructor_feedback,
      manual_score:
        typeof ad.manual_score === "number" ? ad.manual_score : fromSelected.manual_score,
      graded_at: typeof ad.graded_at === "string" ? ad.graded_at : fromSelected.graded_at,
      graded_by: typeof ad.graded_by === "string" ? ad.graded_by : fromSelected.graded_by,
      submission_status:
        (ad.submission_status as CircuitSubmissionStatus) || fromSelected.submission_status,
      rubric_scores:
        ad.rubric_scores && typeof ad.rubric_scores === "object"
          ? (ad.rubric_scores as CircuitSubmissionRubricScores)
          : fromSelected.rubric_scores,
    })
  } catch {
    return fromSelected
  }
}

/** Best-effort answer for grading — merges selected_answer + answer_data uploads/workspace. */
export function resolveCircuitSubmissionForGrading(
  selectedAnswer?: unknown,
  answerData?: unknown,
): CircuitSubmissionAnswer {
  return parseCircuitSubmissionAnswerMerged(selectedAnswer, answerData)
}

/** True when AI returned a provisional score awaiting instructor confirmation. */
export function isCircuitSubmissionProvisional(q: {
  question_type?: string
  override_points?: number | null
  reviewed_at?: string | null
  reviewed_by?: string | null
  ai_feedback?: unknown
}): boolean {
  if ((q.question_type || "").toLowerCase() !== "circuit_submission") return false
  if (q.override_points != null && q.override_points !== undefined) return false
  if (q.reviewed_at != null && q.reviewed_at !== "") return false
  if (q.reviewed_by != null && String(q.reviewed_by).trim() !== "") return false

  const af =
    q.ai_feedback && typeof q.ai_feedback === "object"
      ? (flattenStoredAiFeedback(q.ai_feedback) as Record<string, unknown> | null)
      : null
  if (!af) return false
  if (af.circuitSubmissionAiGraded === true) return false
  if (af.provisionalScore === true || af.requiresInstructorApproval === true) return true
  if (
    af.gradingOutcome === "instructor_review" &&
    af.aiGraded === true &&
    (typeof af.totalScorePreview === "number" ||
      typeof af.totalScore === "number" ||
      (typeof af.feedback === "string" && af.feedback.trim().length > 0))
  ) {
    return true
  }
  return false
}

/** Provisional AI score (points) shown to students before instructor approval. */
export function resolveCircuitSubmissionProvisionalScore(q: {
  question_type?: string
  override_points?: number | null
  reviewed_at?: string | null
  reviewed_by?: string | null
  ai_feedback?: unknown
  max_points?: number
  points?: number
}): number | null {
  if (!isCircuitSubmissionProvisional(q)) return null
  const af =
    q.ai_feedback && typeof q.ai_feedback === "object"
      ? (flattenStoredAiFeedback(q.ai_feedback) as Record<string, unknown> | null)
      : null
  if (!af) return null

  const previewRaw = af.totalScorePreview ?? af.totalScore
  if (typeof previewRaw === "number" && Number.isFinite(previewRaw)) {
    const max = Number(q.max_points ?? q.points ?? af.maxPoints ?? previewRaw) || previewRaw
    const raw = parseFloat(Math.min(max, Math.max(0, previewRaw)).toFixed(2))
    return applyCircuitDisplayScoreFloor(raw, max, af)
  }

  const rubricRaw = af.rubricScoresPreview ?? af.rubricScores
  if (rubricRaw && typeof rubricRaw === "object") {
    const sum = sumCircuitSubmissionRubricScores(rubricRaw as CircuitSubmissionRubricScores)
    if (Number.isFinite(sum)) {
      const max = Number(q.max_points ?? q.points ?? af.maxPoints ?? sum) || sum
      const raw = parseFloat(Math.min(max, Math.max(0, sum)).toFixed(2))
      return applyCircuitDisplayScoreFloor(raw, max, af)
    }
  }
  return null
}

/** Points to display in quiz-taker evaluate toasts / feedback (provisional when applicable). */
export function resolveCircuitEvalDisplayPoints(
  evalData: Record<string, unknown> | null | undefined,
  maxPoints?: number,
): number | null {
  if (!evalData) return null
  const provisional =
    evalData.provisionalScore === true || evalData.requiresInstructorApproval === true
  if (!provisional) return null

  const previewRaw = evalData.totalScorePreview ?? evalData.totalScore
  if (typeof previewRaw === "number" && Number.isFinite(previewRaw)) {
    const max = Number(maxPoints ?? evalData.maxPoints ?? previewRaw) || previewRaw
    const raw = parseFloat(Math.min(max, Math.max(0, previewRaw)).toFixed(2))
    return applyCircuitDisplayScoreFloor(raw, max, evalData)
  }

  const rubricRaw = evalData.rubricScoresPreview ?? evalData.rubricScores
  if (rubricRaw && typeof rubricRaw === "object") {
    const sum = sumCircuitSubmissionRubricScores(rubricRaw as CircuitSubmissionRubricScores)
    const max = Number(maxPoints ?? evalData.maxPoints ?? sum) || sum
    const raw = parseFloat(Math.min(max, Math.max(0, sum)).toFixed(2))
    return applyCircuitDisplayScoreFloor(raw, max, evalData)
  }
  return null
}

/** True when a circuit submission still needs instructor grading (PND%). */
export function isCircuitSubmissionPendingReview(q: {
  question_type?: string
  requires_review?: boolean
  override_points?: number | null
  selected_answer?: unknown
  answer_data?: unknown
  ai_feedback?: {
    aiGraded?: boolean
    requiresManualReview?: boolean
    circuitSubmissionAiGraded?: boolean
    gradingOutcome?: CircuitSubmissionGradingOutcome
    errorType?: string
    feedback?: string
    totalScore?: number
    totalScorePreview?: number
  } | null
  points_earned?: number | null
  reviewed_at?: string | null
  reviewed_by?: string | null
}): boolean {
  if ((q.question_type || "").toLowerCase() !== "circuit_submission") return false
  if (isCircuitSubmissionProvisional(q)) return false
  if (q.override_points != null && q.override_points !== undefined) return false
  if (q.reviewed_at != null && q.reviewed_at !== "") return false
  if (q.reviewed_by != null && String(q.reviewed_by).trim() !== "") return false

  const parsed = parseCircuitSubmissionAnswerMerged(q.selected_answer, q.answer_data)
  if (parsed.submission_status === "graded" || parsed.submission_status === "returned") return false
  if (parsed.manual_score != null) return false

  const af =
    q.ai_feedback && typeof q.ai_feedback === "object"
      ? q.ai_feedback
      : null
  const outcome = readCircuitSubmissionGradingOutcome(af)

  if (outcome === "graded" || outcome === "missing_submission") return false
  if (outcome === "evaluation_failed" || outcome === "instructor_review") return true

  if (isCircuitSubmissionEvaluationFailed(af)) return true

  if (af?.aiGraded === true && af.requiresManualReview !== true) return false
  if (af?.circuitSubmissionAiGraded === true) return false
  if (
    af?.aiGraded === true &&
    typeof af.feedback === "string" &&
    af.feedback.trim().length > 0 &&
    !isCircuitSubmissionEvaluationFailed(af)
  ) {
    return false
  }

  if (q.requires_review === true) {
    const pts = Number(q.points_earned ?? 0)
    if (pts > 0) return false
    if (af?.aiGraded === true && af.requiresManualReview !== true) return false
    if (
      typeof af?.totalScore === "number" ||
      typeof af?.totalScorePreview === "number"
    ) {
      return af?.circuitSubmissionAiGraded === false && af?.requiresManualReview === true
    }
    return true
  }

  const hasUpload = circuitSubmissionFileCount(parsed.solution_uploads) > 0
  if (!hasUpload) return false

  const pts = Number(q.points_earned ?? 0)
  return pts <= 0 && af?.aiGraded !== true
}
