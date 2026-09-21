/**
 * Server-authoritative sitting deadline for assessment attempts.
 *
 * The monotonic clamp on timer saves stops remaining-time inflation, but a student who blocks
 * all progress saves can still stall the clock indefinitely. `deadline_at` is a hard outer
 * bound armed once when the sitting starts (take route) and cleared only by
 * save-and-finish-later, which legitimately pauses the clock; resuming re-arms it.
 *
 * The deadline is deliberately generous (25% + 5 min buffer over the summed timer budget):
 * client timers remain the primary clock and auto-submit at zero — the server deadline only
 * stops gross stalling. Returns null (no deadline) for untimed assessment types or whenever
 * any question lacks a resolvable timer, because a false lockout is worse than the exploit.
 */

import { groupQuestionsBySections, parseAssessmentSectionConfig, type SectionConfig } from "@/lib/assessment-sections"
import {
  getExamSharedTimerSeconds,
  isUntimedAssessmentType,
  resolveQuestionTimeLimitSeconds,
  resolveSectionTotalTimeSeconds,
  usesPerQuestionCountdown,
  usesSectionCountdown,
} from "@/lib/assessment-timer"

/** Grace after deadline_at before writes are rejected (network lag, final auto-submit save). */
export const ATTEMPT_DEADLINE_GRACE_MS = 60_000

const DEADLINE_BUFFER_RATIO = 0.25
const DEADLINE_BUFFER_MIN_SECONDS = 300

type DeadlineQuestionRow = {
  id: number
  question_type?: string | null
  question_order?: number | null
  time_limit?: number | null
}

function withBuffer(totalSeconds: number): number {
  const buffer = Math.max(DEADLINE_BUFFER_MIN_SECONDS, Math.ceil(totalSeconds * DEADLINE_BUFFER_RATIO))
  return Math.ceil(totalSeconds) + buffer
}

export function computeAttemptDeadlineSeconds(input: {
  questions: DeadlineQuestionRow[]
  sectionConfigRaw: unknown
  assessmentType: string | null | undefined
  quizTimePerQuestion?: number | null
  /** Superpower bonus seconds per question (already resolved server-side). */
  extraTimePerQuestion?: number
}): number | null {
  const { questions, assessmentType } = input
  if (!questions.length) return null
  if (isUntimedAssessmentType(assessmentType)) return null
  const normalized = String(assessmentType ?? "").trim().toLowerCase()
  if (normalized === "practice" || normalized === "points" || normalized === "") return null

  const parsed = parseAssessmentSectionConfig(input.sectionConfigRaw as SectionConfig[] | null | undefined)
  const extraPerQuestion = Math.max(0, Number(input.extraTimePerQuestion) || 0)

  // Exam-shared pool: one clock for the whole sitting.
  const examShared = getExamSharedTimerSeconds(parsed)
  if (examShared != null && examShared > 0) {
    return withBuffer(examShared + extraPerQuestion * questions.length)
  }

  const sections = groupQuestionsBySections(questions, parsed)
  let totalSeconds = 0

  for (const sec of sections) {
    const cfg = parsed?.[sec.sectionIndex] ?? null

    if (cfg && usesSectionCountdown(cfg, assessmentType)) {
      const sectionTotal = resolveSectionTotalTimeSeconds(cfg, {
        questionCountInSection: sec.questionIndices.length,
        allSections: parsed ?? undefined,
      })
      if (!(sectionTotal > 0)) return null
      totalSeconds += sectionTotal + extraPerQuestion * sec.questionIndices.length
      continue
    }

    for (const questionIndex of sec.questionIndices) {
      const question = input.questions[questionIndex]
      if (!question) return null
      const questionType = question.question_type || "mcq"
      if (!usesPerQuestionCountdown(questionType, cfg, parsed, assessmentType)) {
        // Untimed question in the mix — no hard bound is derivable for this sitting.
        return null
      }
      const limit = resolveQuestionTimeLimitSeconds(
        questionType,
        question.time_limit,
        input.quizTimePerQuestion ?? null,
        cfg,
      )
      if (!(limit > 0)) return null
      totalSeconds += limit + extraPerQuestion
    }
  }

  if (!(totalSeconds > 0)) return null
  return withBuffer(totalSeconds)
}

/** True when the attempt's hard deadline (plus grace) has passed. */
export function isAttemptDeadlineExpired(deadlineAt: unknown): boolean {
  if (!deadlineAt) return false
  const deadlineMs = new Date(deadlineAt as string | number | Date).getTime()
  if (!Number.isFinite(deadlineMs)) return false
  return Date.now() > deadlineMs + ATTEMPT_DEADLINE_GRACE_MS
}
