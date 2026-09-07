/**
 * Optional "student picks N of M" section scoring — does not affect sections
 * where section_scoring_mode is unset or "all".
 */

import {
  parseAssessmentSectionConfig,
  type SectionConfig,
  type SectionScoringMode,
} from "@/lib/assessment-sections"

export type { SectionScoringMode }

/** Section index (0-based) → quiz_question ids selected for grading credit. */
export type SectionQuestionSelections = Record<number, number[]>

export function sectionUsesStudentPick(section: SectionConfig | null | undefined): boolean {
  if (!section) return false
  if (section.section_scoring_mode !== "student_pick") return false
  const n = Number(section.questions_required)
  return Number.isFinite(n) && n > 0
}

export function getSectionConfigForSectionIndex(
  sectionIndex: number,
  sectionConfig: SectionConfig[] | string | null | undefined,
): SectionConfig | null {
  const parsed = parseAssessmentSectionConfig(sectionConfig)
  if (!parsed?.length) return null

  const usePositionBased = parsed.some(
    (c) => c.question_order_start != null && c.question_order_end != null,
  )

  if (usePositionBased) {
    const sorted = [...parsed]
      .filter((c) => c.question_order_start != null && c.question_order_end != null)
      .sort((a, b) => (a.question_order_start ?? 0) - (b.question_order_start ?? 0))
    return sorted[sectionIndex] ?? null
  }

  return parsed[sectionIndex] ?? null
}

export function parseSectionQuestionSelections(raw: unknown): SectionQuestionSelections | null {
  if (raw == null) return null
  let obj: Record<string, unknown>
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return null
    }
  } else if (typeof raw === "object" && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>
  } else {
    return null
  }

  const out: SectionQuestionSelections = {}
  for (const [key, val] of Object.entries(obj)) {
    const sectionIdx = Number(key)
    if (!Number.isFinite(sectionIdx) || sectionIdx < 0) continue
    if (!Array.isArray(val)) continue
    const ids = val
      .map((x) => Number(x))
      .filter((id) => Number.isFinite(id) && id > 0)
    if (ids.length > 0) out[sectionIdx] = [...new Set(ids)]
  }
  return Object.keys(out).length > 0 ? out : null
}

export function serializeSectionQuestionSelections(
  selections: SectionQuestionSelections,
): Record<string, number[]> {
  const out: Record<string, number[]> = {}
  for (const [key, ids] of Object.entries(selections)) {
    const sectionIdx = Number(key)
    if (!Number.isFinite(sectionIdx) || sectionIdx < 0) continue
    const clean = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))]
    if (clean.length > 0) out[String(sectionIdx)] = clean
  }
  return out
}

/** Whether a question id counts toward section max/earned when student-pick is enabled. */
export function questionCountsForSectionPick(
  sectionIndex: number,
  questionId: number | undefined,
  sectionConfig: SectionConfig[] | null | undefined,
  selections: SectionQuestionSelections | null | undefined,
  countingQuestionIds?: ReadonlySet<number> | null,
): boolean {
  if (countingQuestionIds?.size) {
    return questionId != null && countingQuestionIds.has(questionId)
  }
  const cfg = getSectionConfigForSectionIndex(sectionIndex, sectionConfig)
  if (!sectionUsesStudentPick(cfg)) return true
  if (questionId == null) return false
  const selected = selections?.[sectionIndex]
  if (!selected?.length) return false
  return selected.includes(questionId)
}

export function countSelectedForSection(
  sectionIndex: number,
  selections: SectionQuestionSelections | null | undefined,
): number {
  return selections?.[sectionIndex]?.length ?? 0
}

export function sectionPickRequiredCount(
  sectionIndex: number,
  sectionConfig: SectionConfig[] | null | undefined,
): number | null {
  const cfg = getSectionConfigForSectionIndex(sectionIndex, sectionConfig)
  if (!sectionUsesStudentPick(cfg)) return null
  return Math.max(1, Math.floor(Number(cfg!.questions_required)))
}

export type StudentPickQuestionCandidate = {
  questionId: number
  effectivePoints: number
  maxPoints: number
  /** True when the attempt has at least one answer row for this question. */
  answered: boolean
}

/**
 * Mid-semester Section II: grade the best N answered questions (e.g. top 8 of 12).
 * Denominator is always N × per-question max, not the full section pool.
 */
export function computeStudentPickSectionEarnedMax(
  required: number,
  candidates: StudentPickQuestionCandidate[],
): { earned: number; max: number; countingQuestionIds: number[] } {
  const n = Math.max(1, Math.floor(Number(required) || 1))
  const answered = candidates.filter((c) => c.answered)
  const sorted = [...answered].sort((a, b) => {
    if (b.effectivePoints !== a.effectivePoints) {
      return b.effectivePoints - a.effectivePoints
    }
    return a.questionId - b.questionId
  })
  const top = sorted.slice(0, n)
  const earned = top.reduce((sum, c) => sum + c.effectivePoints, 0)
  const poolMax =
    candidates.length > 0
      ? Math.max(...candidates.map((c) => Math.max(0, Number(c.maxPoints) || 1)), 1)
      : 1
  const max = n * poolMax
  return { earned, max, countingQuestionIds: top.map((c) => c.questionId) }
}

export type StudentPickSectionSummary = {
  sectionIndex: number
  title: string
  questionsRequired: number
  totalTimeSeconds: number | null
}

/** Sections configured for student_pick — for instructions UI. */
export function getStudentPickSectionSummaries(
  sectionConfig: SectionConfig[] | null | undefined,
): StudentPickSectionSummary[] {
  const parsed = parseAssessmentSectionConfig(sectionConfig)
  if (!parsed?.length) return []
  const usePosition = parsed.some(
    (c) => c.question_order_start != null && c.question_order_end != null,
  )
  const list = usePosition
    ? [...parsed]
        .filter((c) => c.question_order_start != null && c.question_order_end != null)
        .sort((a, b) => (a.question_order_start ?? 0) - (b.question_order_start ?? 0))
    : parsed

  return list
    .map((section, sectionIndex) => {
      if (!sectionUsesStudentPick(section)) return null
      const required = Math.max(1, Math.floor(Number(section.questions_required)))
      return {
        sectionIndex,
        title: section.title,
        questionsRequired: required,
        totalTimeSeconds:
          typeof section.total_time_seconds === "number" ? section.total_time_seconds : null,
      }
    })
    .filter((x): x is StudentPickSectionSummary => x != null)
}

export function countQuestionsInSectionBand(
  section: SectionConfig,
  totalQuestions: number,
): number {
  const start = section.question_order_start
  const end = section.question_order_end
  if (start != null && end != null) {
    return Math.max(0, end - start + 1)
  }
  return totalQuestions
}
