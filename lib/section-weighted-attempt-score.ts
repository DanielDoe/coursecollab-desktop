/**
 * Shared section-weighted attempt scoring (homework, quiz, mid-semester, final).
 * Uses override_points when present and caps each question at max_points.
 */

import {
  groupQuestionsBySections,
  calculateWeightedScore,
  type SectionConfig,
} from "@/lib/assessment-sections"
import {
  computeStudentPickSectionEarnedMax,
  getSectionConfigForSectionIndex,
  questionCountsForSectionPick,
  sectionPickRequiredCount,
  sectionUsesStudentPick,
  type SectionQuestionSelections,
} from "@/lib/section-pick-scoring"

export function capQuestionPoints(
  overridePoints: unknown,
  pointsEarned: unknown,
  maxPoints: unknown,
): number {
  const max = Math.max(0, Number(maxPoints) || 1)
  const raw = Number(overridePoints ?? pointsEarned ?? 0)
  if (!Number.isFinite(raw)) return 0
  return Math.min(Math.max(0, raw), max)
}

export type SectionScoreRow = {
  earned: number
  max: number
  weightPercent: number
  title?: string
}

function isPerQuestionAnswered(
  questionId: number,
  q: PerQuestionScoreRow,
  answeredQuestionIds: ReadonlySet<number> | null | undefined,
): boolean {
  if (q.answered === true) return true
  if (q.answered === false) return false
  if (answeredQuestionIds?.has(questionId)) return true
  return q.effective_points > 0
}

export type PerQuestionScoreRow = {
  max_points: number
  effective_points: number
  /** When set, used for student_pick best-N (includes zero-point attempts). */
  answered?: boolean
}

export type SectionWeightedScoreOptions = {
  /** Per-attempt student selections for student_pick sections (section index → question ids). */
  sectionQuestionSelections?: SectionQuestionSelections | null
  /** Question ids with a quiz_answer row — used when per-question `answered` is omitted. */
  answeredQuestionIds?: ReadonlySet<number> | null
}

export function computeSectionScoreRows(
  questions: Array<{ question_type?: string; question_order?: number; id?: number }>,
  perQuestion: PerQuestionScoreRow[],
  sectionConfig: SectionConfig[] | null | undefined,
  options?: SectionWeightedScoreOptions,
): SectionScoreRow[] {
  const selections = options?.sectionQuestionSelections ?? null
  const answeredQuestionIds = options?.answeredQuestionIds ?? null
  const sections = groupQuestionsBySections(questions, sectionConfig)
  return sections.map((s) => {
    const required = sectionPickRequiredCount(s.sectionIndex, sectionConfig)
    const cfg = getSectionConfigForSectionIndex(s.sectionIndex, sectionConfig)
    const usesPick = sectionUsesStudentPick(cfg) && required != null

    if (usesPick) {
      const candidates = s.questionIndices.flatMap((idx) => {
        const qRow = questions[idx]
        const q = perQuestion[idx]
        if (!q || qRow?.id == null) return []
        const questionId = qRow.id
        const answered = isPerQuestionAnswered(questionId, q, answeredQuestionIds)
        return [
          {
            questionId,
            effectivePoints: q.effective_points,
            maxPoints: q.max_points,
            answered,
          },
        ]
      })
      const { earned, max } = computeStudentPickSectionEarnedMax(required!, candidates)
      return { earned, max, weightPercent: s.weightPercent, title: s.title }
    }

    let earned = 0
    let max = 0
    for (const idx of s.questionIndices) {
      const qRow = questions[idx]
      const q = perQuestion[idx]
      if (!q) continue
      if (
        !questionCountsForSectionPick(
          s.sectionIndex,
          qRow?.id,
          sectionConfig,
          selections,
        )
      ) {
        continue
      }
      earned += q.effective_points
      max += q.max_points
    }
    return { earned, max, weightPercent: s.weightPercent, title: s.title }
  })
}

export function computeSectionWeightedScore(
  questions: Array<{ question_type?: string; question_order?: number; id?: number }>,
  perQuestion: Array<{ max_points: number; effective_points: number }>,
  sectionConfig: SectionConfig[] | null | undefined,
  options?: SectionWeightedScoreOptions,
): number {
  const rows = computeSectionScoreRows(questions, perQuestion, sectionConfig, options)
  return Math.round(calculateWeightedScore(rows) * 100) / 100
}

export type SectionWeightedBreakdownRow = {
  id?: number
  question_type?: string
  question_order?: number
  points_earned: number
  max_points: number
  answered?: boolean
}

/** Recompute 0–100 course % from per-question earned/max rows (sorted by question_order). */
export function sectionWeightedPercentFromBreakdown(
  breakdown: SectionWeightedBreakdownRow[],
  sectionConfig: SectionConfig[] | null | undefined,
  options?: SectionWeightedScoreOptions,
): number {
  if (!breakdown.length) return 0
  const sorted = [...breakdown].sort(
    (a, b) => (a.question_order ?? 999) - (b.question_order ?? 999),
  )
  const answeredQuestionIds =
    options?.answeredQuestionIds ??
    new Set(
      sorted
        .filter((q) => q.answered === true || (q.answered !== false && q.id != null && Number(q.points_earned) > 0))
        .map((q) => q.id!)
        .filter((id): id is number => id != null),
    )
  const perQuestion = sorted.map((q) => ({
    max_points: Math.max(0, Number(q.max_points) || 1),
    effective_points: capQuestionPoints(null, q.points_earned, q.max_points),
    answered: q.answered,
  }))
  return computeSectionWeightedScore(sorted, perQuestion, sectionConfig, {
    ...options,
    answeredQuestionIds,
  })
}

export function buildPerQuestionEffectivePoints(
  questions: Array<{ max_points: number }>,
  answersByQuestionId: Map<
    number,
    { override_points?: number | null; points_earned?: number | null }
  >,
  questionIds: number[],
): PerQuestionScoreRow[] {
  return questions.map((q, idx) => {
    const qid = questionIds[idx]
    const ans = qid != null ? answersByQuestionId.get(qid) : undefined
    const max = Math.max(0, Number(q.max_points) || 1)
    return {
      max_points: max,
      effective_points: capQuestionPoints(ans?.override_points, ans?.points_earned, max),
      answered: ans != null,
    }
  })
}
