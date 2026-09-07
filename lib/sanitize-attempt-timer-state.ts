/**
 * Sanitize persisted attempt timer JSON — circuit uploads must use section pool only.
 */

import {
  groupQuestionsBySections,
  parseAssessmentSectionConfig,
  type SectionConfig,
} from "@/lib/assessment-sections"
import {
  getSectionConfigForQuestionIndex,
  getExamSharedTimerSeconds,
  resolveSectionTotalTimeSeconds,
  usesPerQuestionCountdown,
  usesSectionCountdown,
  EXAM_SHARED_TIMER_SECTION_KEY,
} from "@/lib/assessment-timer"

type QuestionRow = { id: number; question_type?: string | null; question_order?: number | null }

export function sanitizeQuestionTimeRemainingForQuiz(
  raw: Record<string | number, number> | null | undefined,
  questions: QuestionRow[],
  sectionConfig: SectionConfig[] | null | undefined,
  assessmentType?: string | null,
): Record<string, number> {
  if (!raw || typeof raw !== "object") return {}
  const sections = groupQuestionsBySections(questions, sectionConfig)
  const indexById = new Map<number, number>()
  questions.forEach((q, idx) => indexById.set(q.id, idx))

  const out: Record<string, number> = {}
  for (const [key, val] of Object.entries(raw)) {
    const qid = Number(key)
    if (!Number.isFinite(qid) || val == null || Number(val) <= 0) continue
    const qi = indexById.get(qid)
    if (qi === undefined) continue
    const q = questions[qi]
    const secCfg = getSectionConfigForQuestionIndex(qi, sections, sectionConfig ?? null)
    if (!usesPerQuestionCountdown(q.question_type || "mcq", secCfg, sectionConfig, assessmentType)) continue
    out[String(qid)] = Math.floor(Number(val))
  }
  return out
}

export type SanitizeTimerOptions = {
  /** When false, do not inflate missing section keys to full section duration (resume / save-later). */
  fillMissingToFull?: boolean
}

export function sanitizeSectionTimeRemainingForQuiz(
  raw: Record<string | number, number> | null | undefined,
  questions: QuestionRow[],
  sectionConfig: SectionConfig[] | null | undefined,
  options?: SanitizeTimerOptions,
  assessmentType?: string | null,
): Record<string, number> {
  const fillMissingToFull = options?.fillMissingToFull !== false
  const parsed = parseAssessmentSectionConfig(sectionConfig)
  if (!parsed?.length) {
    if (!raw || typeof raw !== "object") return {}
    const out: Record<string, number> = {}
    for (const [key, val] of Object.entries(raw)) {
      if (Number(val) > 0) out[String(key)] = Math.floor(Number(val))
    }
    return out
  }

  const sections = groupQuestionsBySections(questions, parsed)
  const out: Record<string, number> = {}

  if (raw && typeof raw === "object") {
    for (const [key, val] of Object.entries(raw)) {
      const idx = Number(key)
      if (!Number.isFinite(idx) || Number(val) <= 0) continue
      const cfg = parsed[idx]
      if (cfg && usesSectionCountdown(cfg, assessmentType)) {
        out[String(idx)] = Math.floor(Number(val))
      }
    }
  }

  for (const sec of sections) {
    const cfg = parsed[sec.sectionIndex]
    if (!cfg || !usesSectionCountdown(cfg, assessmentType)) continue
    const key = String(sec.sectionIndex)
    if (out[key] !== undefined) {
      if (fillMissingToFull && out[key] <= 0) {
        const total = resolveSectionTotalTimeSeconds(cfg, {
          questionCountInSection: sec.questionIndices.length,
          allSections: parsed,
        })
        if (total > 0) out[key] = total
      }
      continue
    }
    if (!fillMissingToFull) continue
    const total = resolveSectionTotalTimeSeconds(cfg, {
      questionCountInSection: sec.questionIndices.length,
      allSections: parsed,
    })
    if (total > 0) out[key] = total
  }

  const examShared = getExamSharedTimerSeconds(parsed)
  if (examShared != null) {
    const sharedKey = String(EXAM_SHARED_TIMER_SECTION_KEY)
    let seconds = out[sharedKey]
    if (seconds == null || seconds <= 0) {
      for (const sec of sections) {
        const k = String(sec.sectionIndex)
        if (out[k] != null && out[k] > 0) {
          seconds = out[k]
          break
        }
      }
    }
    if (seconds == null || seconds <= 0) {
      seconds = fillMissingToFull ? examShared : Math.max(0, seconds ?? 0)
    }
    const mirrored: Record<string, number> = { [sharedKey]: seconds }
    parsed.forEach((cfg, idx) => {
      if (usesSectionCountdown(cfg, assessmentType)) mirrored[String(idx)] = seconds
    })
    return mirrored
  }

  return out
}

export function sanitizeAttemptTimerState(
  questions: QuestionRow[],
  sectionConfig: SectionConfig[] | null | undefined,
  questionTimeRemaining: Record<string | number, number> | null | undefined,
  sectionTimeRemaining: Record<string | number, number> | null | undefined,
  options?: SanitizeTimerOptions,
  assessmentType?: string | null,
): {
  questionTimeRemaining: Record<string, number>
  sectionTimeRemaining: Record<string, number>
} {
  return {
    questionTimeRemaining: sanitizeQuestionTimeRemainingForQuiz(
      questionTimeRemaining,
      questions,
      sectionConfig,
      assessmentType,
    ),
    sectionTimeRemaining: sanitizeSectionTimeRemainingForQuiz(
      sectionTimeRemaining,
      questions,
      sectionConfig,
      options,
      assessmentType,
    ),
  }
}
