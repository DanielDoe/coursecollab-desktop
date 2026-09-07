/**
 * Quiz interruption/resume grace period utilities.
 *
 * Policy:
 * - Within resume window: students can log back in and continue (internet/power cut recovery)
 * - After resume window:
 *   - Has retake access (Explorer/Trailblazer/donation): allow retake (new attempt)
 *   - No retake access: finalize partial score, submit whatever they have
 * - When the assessment has a due date (`available_until`), students may resume until that deadline
 * - When there is no due date, resume window = quiz duration + 15 min buffer, min 30 min, max 24 hours
 */

import { formatCentralDateTime } from "@/lib/timezone"

const RESUME_BUFFER_MINUTES = 15
const RESUME_MIN_MINUTES = 30
const RESUME_MAX_MINUTES = 24 * 60 // 24 hours

export type ResumeDeadlineInput = Date | string | null | undefined

/**
 * Compute resume grace period in minutes (used when no assessment due date is set).
 * Quiz duration = time_per_question (seconds) * num_questions.
 */
export function getResumeGraceMinutes(
  timePerQuestionSeconds: number,
  numQuestions: number
): number {
  const quizDurationSeconds = (timePerQuestionSeconds || 60) * Math.max(1, numQuestions)
  const quizDurationMinutes = quizDurationSeconds / 60
  const withBuffer = quizDurationMinutes + RESUME_BUFFER_MINUTES
  return Math.min(
    Math.max(withBuffer, RESUME_MIN_MINUTES),
    RESUME_MAX_MINUTES
  )
}

function parseResumeDeadline(value: ResumeDeadlineInput): Date | null {
  if (value == null) return null
  const deadline = value instanceof Date ? value : new Date(value)
  return Number.isNaN(deadline.getTime()) ? null : deadline
}

/**
 * Latest moment a student may resume an incomplete attempt.
 * Uses the assessment due date when set; otherwise falls back to start + grace minutes.
 */
export function getResumeCutoffDate(
  startedAt: Date,
  graceMinutes: number,
  availableUntil?: ResumeDeadlineInput,
): Date {
  const graceCutoff = new Date(startedAt)
  graceCutoff.setMinutes(graceCutoff.getMinutes() + graceMinutes)

  const deadline = parseResumeDeadline(availableUntil)
  return deadline ?? graceCutoff
}

/**
 * Check if an attempt started at startedAt is still within the resume window.
 */
export function isWithinResumeGrace(
  startedAt: Date,
  graceMinutes: number,
  availableUntil?: ResumeDeadlineInput,
): boolean {
  const cutoff = getResumeCutoffDate(startedAt, graceMinutes, availableUntil)
  return new Date() < cutoff
}

export function getContinueLaterDialogTitle(availableUntil?: ResumeDeadlineInput): string {
  return parseResumeDeadline(availableUntil)
    ? "Continue later — finish by the deadline"
    : "Continue later — 24 hour limit"
}

export function getContinueLaterDialogBody(availableUntil?: ResumeDeadlineInput): {
  lead: string
  emphasis: string
  footer: string
} {
  const deadline = parseResumeDeadline(availableUntil)
  if (deadline) {
    const formatted = formatCentralDateTime(deadline, "EEEE, MMM d, yyyy 'at' h:mm a z")
    return {
      lead: "Your answers will be saved so you can pick up where you left off.",
      emphasis: `Make sure you finish this assessment by ${formatted}.`,
      footer:
        "If you don't complete the assessment by the due date, your attempt may be automatically finalized and submitted with whatever is saved.",
    }
  }

  return {
    lead: "Your answers will be saved so you can pick up where you left off.",
    emphasis: "You have 24 hours from when you save to return and finish this attempt.",
    footer:
      "If you don't complete the assessment within that window, your attempt may be automatically finalized and submitted with whatever is saved.",
  }
}

export function getContinueLaterSavedToastDescription(
  availableUntil?: ResumeDeadlineInput,
): string {
  const deadline = parseResumeDeadline(availableUntil)
  if (deadline) {
    const formatted = formatCentralDateTime(deadline, "MMM d, yyyy 'at' h:mm a z")
    return `You can resume later. Finish by ${formatted}.`
  }
  return "You can resume this assessment later."
}
