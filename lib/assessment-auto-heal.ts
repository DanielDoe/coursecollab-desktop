/**
 * Assessment auto-heal — proactive repair for the most common resolved-issue patterns.
 *
 * Patterns addressed (from 547 resolved system log groups):
 *  1. requires_manual_review on circuit_submission (~55%) — stale flags after successful grade
 *  2. submission_failed (~6%) — network timeout left submissionFailed in answer_data
 *  3. workspace_export_missing (~1%) — workspace ink saved but PNG never exported
 *  4. incomplete attempts (~1%) — saved answers but never finalized past deadline
 *
 * Runs as a cron job and can be invoked manually via scripts/assessment-auto-heal.ts.
 */

import { sql } from "@/lib/db"
import { clearSubmissionFailedFlag } from "@/lib/clear-submission-failed-flag"
import {
  clearRequiresReviewForAutoGradedAnswers,
  clearRequiresReviewForEmptyAnswers,
} from "@/lib/finalize-recalc-cleanup"
import {
  circuitSubmissionNeedsWorkspaceExport,
} from "@/lib/circuit-submission-workspace-export-ui"
import {
  exportWorkspaceSubmissionForAnswer,
} from "@/lib/export-workspace-submission-for-answer"
import { finalizeAttempt } from "@/lib/finalize-utils"
import { canVerifyLocally } from "@/lib/local-answer-verification"
import { hasStudentAnswerContent } from "@/lib/student-answer-presence"
import {
  ANSWER_DATA_SUBMISSION_FAILED_BARE_SQL,
  ANSWER_DATA_SUBMISSION_FAILED_SQL,
} from "@/lib/quiz-answer-data-sql"

export type HealIssueKind =
  | "stale_submission_failed"
  | "missing_workspace_png"
  | "stale_requires_review_circuit"
  | "stale_requires_review_autogradable"
  | "stale_requires_review_empty"
  | "incomplete_past_deadline"

export type HealCandidate = {
  kind: HealIssueKind
  answerId?: number
  attemptId: number
  questionId?: number
  quizId?: number
  studentName?: string
  detail?: string
}

export type HealActionResult = {
  kind: HealIssueKind
  attemptId: number
  questionId?: number
  answerId?: number
  healed: boolean
  message: string
}

export type AutoHealRunResult = {
  scanned: Record<HealIssueKind, number>
  healed: HealActionResult[]
  skipped: HealActionResult[]
  errors: HealActionResult[]
  dryRun: boolean
  ranAt: string
}

const DEFAULT_LIMITS: Record<HealIssueKind, number> = {
  stale_submission_failed: 40,
  missing_workspace_png: 20,
  stale_requires_review_circuit: 15,
  stale_requires_review_autogradable: 50,
  stale_requires_review_empty: 50,
  incomplete_past_deadline: 10,
}

function parseAnswerData(raw: unknown): Record<string, unknown> {
  if (!raw) return {}
  if (typeof raw === "object") return raw as Record<string, unknown>
  try {
    return JSON.parse(String(raw)) as Record<string, unknown>
  } catch {
    return {}
  }
}

function hasSubmissionFailedFlag(answerData: unknown): boolean {
  const ad = parseAnswerData(answerData)
  return (
    ad.submissionFailed === true ||
    ad.submissionFailed === "true" ||
    String(ad.submissionFailed ?? "").toLowerCase() === "true"
  )
}

/** Scan for healable assessment defects in the last N days. */
export async function scanHealCandidates(options?: {
  lookbackDays?: number
  limits?: Partial<Record<HealIssueKind, number>>
}): Promise<HealCandidate[]> {
  const lookbackDays = options?.lookbackDays ?? 45
  const limits = { ...DEFAULT_LIMITS, ...options?.limits }
  const candidates: HealCandidate[] = []

  // 1. Stale submissionFailed on completed attempts with real answer content
  const staleFailed = await sql`
    SELECT
      qa.id AS answer_id,
      qa.attempt_id,
      qa.question_id,
      qa.answer_data,
      qa.selected_answer,
      qq.question_type,
      s.full_name AS student_name
    FROM quiz_answers qa
    JOIN quiz_attempts att ON att.id = qa.attempt_id
    JOIN quiz_questions qq ON qq.id = qa.question_id
    JOIN students s ON s.id = att.student_id
    WHERE att.completed_at IS NOT NULL
      AND att.deleted_at IS NULL
      AND qa.answered_at >= NOW() - (${lookbackDays} || ' days')::interval
      AND ${sql.unsafe(ANSWER_DATA_SUBMISSION_FAILED_SQL)}
    ORDER BY qa.answered_at DESC
    LIMIT ${limits.stale_submission_failed}
  `
  for (const row of staleFailed as Array<{
    answer_id: number
    attempt_id: number
    question_id: number
    answer_data: unknown
    selected_answer: unknown
    question_type: string
    student_name: string
  }>) {
    if (
      hasStudentAnswerContent({
        question_type: row.question_type,
        selected_answer: row.selected_answer,
        answer_data: row.answer_data,
        code: null,
      })
    ) {
      candidates.push({
        kind: "stale_submission_failed",
        answerId: row.answer_id,
        attemptId: row.attempt_id,
        questionId: row.question_id,
        studentName: row.student_name,
        detail: "submissionFailed flag with saved answer on completed attempt",
      })
    }
  }

  // 2. Circuit submissions missing workspace PNG export
  const circuitRows = await sql`
    SELECT
      qa.id AS answer_id,
      qa.attempt_id,
      qa.question_id,
      qa.selected_answer,
      qa.answer_data,
      qa.ai_feedback,
      att.quiz_id,
      s.full_name AS student_name
    FROM quiz_answers qa
    JOIN quiz_attempts att ON att.id = qa.attempt_id
    JOIN quiz_questions qq ON qq.id = qa.question_id
    JOIN students s ON s.id = att.student_id
    WHERE qq.question_type = 'circuit_submission'
      AND att.deleted_at IS NULL
      AND qa.answered_at >= NOW() - (${lookbackDays} || ' days')::interval
    ORDER BY qa.answered_at DESC
    LIMIT 200
  `
  let missingPngCount = 0
  for (const row of circuitRows as Array<{
    answer_id: number
    attempt_id: number
    question_id: number
    selected_answer: unknown
    answer_data: unknown
    ai_feedback: unknown
    quiz_id: number
    student_name: string
  }>) {
    if (missingPngCount >= limits.missing_workspace_png) break
    if (
      circuitSubmissionNeedsWorkspaceExport(row.selected_answer, row.answer_data, row.ai_feedback)
    ) {
      missingPngCount++
      candidates.push({
        kind: "missing_workspace_png",
        answerId: row.answer_id,
        attemptId: row.attempt_id,
        questionId: row.question_id,
        quizId: row.quiz_id,
        studentName: row.student_name,
        detail: "workspace ink present but no PNG uploads",
      })
    }
  }

  // 3. Stale requires_review on circuit with AI grade already recorded
  const staleCircuitReview = await sql`
    SELECT
      qa.id AS answer_id,
      qa.attempt_id,
      qa.question_id,
      qa.points_earned,
      qa.ai_feedback,
      s.full_name AS student_name
    FROM quiz_answers qa
    JOIN quiz_attempts att ON att.id = qa.attempt_id
    JOIN quiz_questions qq ON qq.id = qa.question_id
    JOIN students s ON s.id = att.student_id
    WHERE qa.requires_review = true
      AND qq.question_type = 'circuit_submission'
      AND att.completed_at IS NOT NULL
      AND att.deleted_at IS NULL
      AND qa.reviewed_at IS NULL
      AND qa.ai_feedback IS NOT NULL
      AND COALESCE(qa.points_earned, 0) > 0
      AND qa.answered_at >= NOW() - (${lookbackDays} || ' days')::interval
    ORDER BY qa.answered_at DESC
    LIMIT ${limits.stale_requires_review_circuit}
  `
  for (const row of staleCircuitReview as Array<{
    answer_id: number
    attempt_id: number
    question_id: number
    points_earned: number
    student_name: string
  }>) {
    candidates.push({
      kind: "stale_requires_review_circuit",
      answerId: row.answer_id,
      attemptId: row.attempt_id,
      questionId: row.question_id,
      studentName: row.student_name,
      detail: `requires_review with ${row.points_earned} pts and AI feedback`,
    })
  }

  // 4 & 5. Stale requires_review on auto-gradable / empty — grouped by attempt for batch cleanup
  const reviewAttempts = await sql`
    SELECT DISTINCT qa.attempt_id
    FROM quiz_answers qa
    JOIN quiz_attempts att ON att.id = qa.attempt_id
    WHERE qa.requires_review = true
      AND att.completed_at IS NOT NULL
      AND att.deleted_at IS NULL
      AND qa.answered_at >= NOW() - (${lookbackDays} || ' days')::interval
    ORDER BY qa.attempt_id DESC
    LIMIT ${Math.max(limits.stale_requires_review_autogradable, limits.stale_requires_review_empty)}
  `
  let autoGradableCount = 0
  let emptyCount = 0
  for (const { attempt_id } of reviewAttempts as { attempt_id: number }[]) {
    const answers = await sql`
      SELECT qa.id, qa.selected_answer, qa.answer_data, qa.is_correct, qa.points_earned,
             qa.reviewed_at, qa.reviewed_by, qq.question_type
      FROM quiz_answers qa
      JOIN quiz_questions qq ON qq.id = qa.question_id
      WHERE qa.attempt_id = ${attempt_id} AND qa.requires_review = true
    `
    for (const ans of answers as Array<{
      id: number
      selected_answer: unknown
      answer_data: unknown
      is_correct: boolean | null
      points_earned: number | null
      reviewed_at: string | null
      reviewed_by: string | null
      question_type: string
    }>) {
      if (
        !hasStudentAnswerContent({
          question_type: ans.question_type,
          selected_answer: ans.selected_answer,
          answer_data: ans.answer_data,
          code: null,
        })
      ) {
        if (emptyCount < limits.stale_requires_review_empty) {
          emptyCount++
          candidates.push({
            kind: "stale_requires_review_empty",
            answerId: ans.id,
            attemptId: attempt_id,
            detail: "requires_review on empty answer",
          })
        }
        continue
      }
      if (canVerifyLocally(ans.question_type) && autoGradableCount < limits.stale_requires_review_autogradable) {
        autoGradableCount++
        candidates.push({
          kind: "stale_requires_review_autogradable",
          answerId: ans.id,
          attemptId: attempt_id,
          questionId: undefined,
          detail: `requires_review on auto-gradable ${ans.question_type}`,
        })
      }
    }
  }

  // 6. Incomplete attempts past deadline with saved answers
  const incomplete = await sql`
    SELECT
      att.id AS attempt_id,
      att.quiz_id,
      q.title AS quiz_title,
      s.full_name AS student_name,
      COUNT(qa.id)::int AS answer_count
    FROM quiz_attempts att
    JOIN quizzes q ON q.id = att.quiz_id
    JOIN students s ON s.id = att.student_id
    LEFT JOIN quiz_answers qa ON qa.attempt_id = att.id
    WHERE att.completed_at IS NULL
      AND att.deleted_at IS NULL
      AND q.deleted_at IS NULL
      AND q.available_until IS NOT NULL
      AND q.available_until < NOW()
      AND q.available_until > NOW() - INTERVAL '14 days'
    GROUP BY att.id, att.quiz_id, q.title, s.full_name, q.available_until
    HAVING COUNT(qa.id) > 0
    ORDER BY q.available_until DESC
    LIMIT ${limits.incomplete_past_deadline}
  `
  for (const row of incomplete as Array<{
    attempt_id: number
    quiz_id: number
    quiz_title: string
    student_name: string
    answer_count: number
  }>) {
    candidates.push({
      kind: "incomplete_past_deadline",
      attemptId: row.attempt_id,
      quizId: row.quiz_id,
      studentName: row.student_name,
      detail: `${row.answer_count} saved answers on expired "${row.quiz_title}"`,
    })
  }

  return candidates
}

/**
 * Lightweight per-attempt cleanup after successful finalize or evaluate.
 * Clears stale flags without AI re-grading (heavy work stays in cron).
 */
export async function runInlineAttemptCleanup(attemptId: number): Promise<{
  clearedSubmissionFailed: number
  clearedEmptyReview: number
  clearedAutoGradableReview: number
}> {
  let clearedSubmissionFailed = 0
  const rows = await sql`
    SELECT question_id, answer_data
    FROM quiz_answers
    WHERE attempt_id = ${attemptId}
      AND ${sql.unsafe(ANSWER_DATA_SUBMISSION_FAILED_BARE_SQL)}
  `
  for (const row of rows as { question_id: number }[]) {
    const ok = await clearSubmissionFailedFlag(attemptId, row.question_id)
    if (ok) clearedSubmissionFailed++
  }

  const clearedEmptyReview = await clearRequiresReviewForEmptyAnswers(attemptId)
  const clearedAutoGradableReview = await clearRequiresReviewForAutoGradedAnswers(attemptId)

  return { clearedSubmissionFailed, clearedEmptyReview, clearedAutoGradableReview }
}

async function healStaleSubmissionFailed(c: HealCandidate): Promise<HealActionResult> {
  const base = {
    kind: c.kind,
    attemptId: c.attemptId,
    questionId: c.questionId,
    answerId: c.answerId,
  }
  if (!c.questionId) {
    return { ...base, healed: false, message: "Missing questionId" }
  }
  const cleared = await clearSubmissionFailedFlag(c.attemptId, c.questionId)
  return {
    ...base,
    healed: cleared,
    message: cleared
      ? "Cleared stale submissionFailed flag"
      : "Flag already clear or answer missing",
  }
}

async function healMissingWorkspacePng(c: HealCandidate): Promise<HealActionResult> {
  const base = {
    kind: c.kind,
    attemptId: c.attemptId,
    questionId: c.questionId,
    answerId: c.answerId,
  }
  if (!c.answerId) {
    return { ...base, healed: false, message: "Missing answerId" }
  }
  try {
    const result = await exportWorkspaceSubmissionForAnswer({
      answerId: c.answerId,
      reGrade: true,
    })
    return {
      ...base,
      healed: result.exportedPages > 0,
      message: result.message,
    }
  } catch (e) {
    return {
      ...base,
      healed: false,
      message: e instanceof Error ? e.message : String(e),
    }
  }
}

async function healStaleCircuitReview(c: HealCandidate): Promise<HealActionResult> {
  const base = {
    kind: c.kind,
    attemptId: c.attemptId,
    questionId: c.questionId,
    answerId: c.answerId,
  }
  if (!c.answerId) {
    return { ...base, healed: false, message: "Missing answerId" }
  }
  const updated = await sql`
    UPDATE quiz_answers
    SET requires_review = false,
        reviewed_by = 'auto-heal:circuit-graded',
        reviewed_at = NOW()
    WHERE id = ${c.answerId}
      AND requires_review = true
      AND COALESCE(points_earned, 0) > 0
      AND ai_feedback IS NOT NULL
    RETURNING id
  `
  return {
    ...base,
    healed: updated.length > 0,
    message:
      updated.length > 0
        ? "Cleared stale requires_review (AI grade already recorded)"
        : "No update needed",
  }
}

async function healStaleAutogradableReview(c: HealCandidate): Promise<HealActionResult> {
  const cleared = await clearRequiresReviewForAutoGradedAnswers(c.attemptId)
  return {
    kind: c.kind,
    attemptId: c.attemptId,
    answerId: c.answerId,
    healed: cleared > 0,
    message:
      cleared > 0
        ? `Cleared requires_review on ${cleared} auto-gradable answer(s)`
        : "No stale auto-gradable flags",
  }
}

async function healStaleEmptyReview(c: HealCandidate): Promise<HealActionResult> {
  const cleared = await clearRequiresReviewForEmptyAnswers(c.attemptId)
  return {
    kind: c.kind,
    attemptId: c.attemptId,
    answerId: c.answerId,
    healed: cleared > 0,
    message:
      cleared > 0
        ? `Cleared requires_review on ${cleared} empty answer(s)`
        : "No empty requires_review flags",
  }
}

async function healIncompletePastDeadline(c: HealCandidate): Promise<HealActionResult> {
  const base = { kind: c.kind, attemptId: c.attemptId, quizId: c.quizId }
  if (!c.quizId) {
    return { ...base, healed: false, message: "Missing quizId" }
  }
  const result = await finalizeAttempt(c.attemptId, c.quizId, { forceOnBehalfSubmit: true })
  if (result.finalized) {
    await sql`
      UPDATE quiz_attempts SET is_final_grade = true WHERE id = ${c.attemptId}
    `
    return { ...base, healed: true, message: "Finalized incomplete attempt on behalf of student" }
  }
  if (result.softDeleted) {
    return { ...base, healed: false, message: "Attempt soft-deleted (0 answers)" }
  }
  return { ...base, healed: false, message: "Could not finalize attempt" }
}

/** Apply healing actions for scanned candidates. Dedupes by kind+attempt+question. */
export async function runAssessmentAutoHeal(options?: {
  dryRun?: boolean
  lookbackDays?: number
  limits?: Partial<Record<HealIssueKind, number>>
}): Promise<AutoHealRunResult> {
  const dryRun = options?.dryRun === true
  const candidates = await scanHealCandidates(options)

  const scanned: Record<HealIssueKind, number> = {
    stale_submission_failed: 0,
    missing_workspace_png: 0,
    stale_requires_review_circuit: 0,
    stale_requires_review_autogradable: 0,
    stale_requires_review_empty: 0,
    incomplete_past_deadline: 0,
  }
  for (const c of candidates) scanned[c.kind]++

  const healed: HealActionResult[] = []
  const skipped: HealActionResult[] = []
  const errors: HealActionResult[] = []

  const seen = new Set<string>()
  const deduped = candidates.filter((c) => {
    const key = `${c.kind}:${c.attemptId}:${c.questionId ?? ""}:${c.answerId ?? ""}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Batch autogradable/empty by attempt (functions operate per-attempt)
  const attemptBatchKinds = new Set<HealIssueKind>([
    "stale_requires_review_autogradable",
    "stale_requires_review_empty",
  ])
  const batchedAttempts = new Set<number>()

  for (const c of deduped) {
    if (dryRun) {
      skipped.push({
        kind: c.kind,
        attemptId: c.attemptId,
        questionId: c.questionId,
        answerId: c.answerId,
        healed: false,
        message: `[dry-run] would heal: ${c.detail ?? c.kind}`,
      })
      continue
    }

    if (attemptBatchKinds.has(c.kind)) {
      if (batchedAttempts.has(c.attemptId)) continue
      batchedAttempts.add(c.attemptId)
    }

    try {
      let result: HealActionResult
      switch (c.kind) {
        case "stale_submission_failed":
          result = await healStaleSubmissionFailed(c)
          break
        case "missing_workspace_png":
          result = await healMissingWorkspacePng(c)
          break
        case "stale_requires_review_circuit":
          result = await healStaleCircuitReview(c)
          break
        case "stale_requires_review_autogradable":
          result = await healStaleAutogradableReview(c)
          break
        case "stale_requires_review_empty":
          result = await healStaleEmptyReview(c)
          break
        case "incomplete_past_deadline":
          result = await healIncompletePastDeadline(c)
          break
        default:
          result = {
            kind: c.kind,
            attemptId: c.attemptId,
            healed: false,
            message: "Unknown kind",
          }
      }
      if (result.healed) healed.push(result)
      else skipped.push(result)
    } catch (e) {
      errors.push({
        kind: c.kind,
        attemptId: c.attemptId,
        questionId: c.questionId,
        answerId: c.answerId,
        healed: false,
        message: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return {
    scanned,
    healed,
    skipped,
    errors,
    dryRun,
    ranAt: new Date().toISOString(),
  }
}
