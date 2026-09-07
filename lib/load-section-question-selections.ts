import { sql } from "@/lib/db"
import {
  groupQuestionsBySections,
  parseAssessmentSectionConfig,
  type SectionConfig,
} from "@/lib/assessment-sections"
import {
  computeStudentPickSectionEarnedMax,
  getStudentPickSectionSummaries,
  parseSectionQuestionSelections,
  serializeSectionQuestionSelections,
  type SectionQuestionSelections,
} from "@/lib/section-pick-scoring"
import { capQuestionPoints } from "@/lib/section-weighted-attempt-score"
import { ensureSectionQuestionSelectionSchema } from "@/lib/ensure-section-question-selection-schema"

/** Load parsed section question selections for an attempt (null when unset). */
export async function loadSectionQuestionSelectionsForAttempt(
  attemptId: number,
): Promise<SectionQuestionSelections | null> {
  await ensureSectionQuestionSelectionSchema()
  const rows = await sql`
    SELECT section_question_selections
    FROM quiz_attempts
    WHERE id = ${attemptId}
    LIMIT 1
  `
  if (!rows.length) return null
  return parseSectionQuestionSelections(
    (rows[0] as { section_question_selections?: unknown }).section_question_selections,
  )
}

/**
 * Stored student picks, or inferred from submitted answers when missing.
 * Section II mid-semester: best N scored answers (e.g. top 8 of 12).
 */
export async function resolveSectionQuestionSelectionsForAttempt(
  attemptId: number,
  quizId: number,
  sectionConfig: SectionConfig[] | string | null | undefined,
): Promise<SectionQuestionSelections | null> {
  const stored = await loadSectionQuestionSelectionsForAttempt(attemptId)
  const parsed = parseAssessmentSectionConfig(sectionConfig)
  const pickSections = getStudentPickSectionSummaries(parsed)
  if (!pickSections.length) return stored

  const missingPick = pickSections.some(
    (s) => !stored?.[s.sectionIndex]?.length,
  )
  if (!missingPick) return stored

  const questions = (await sql`
    SELECT id, question_type, question_order, COALESCE(max_points, points, 1) as max_pts
    FROM quiz_questions
    WHERE quiz_id = ${quizId}
    ORDER BY question_order ASC NULLS LAST, id ASC
  `) as Array<{
    id: number
    question_type: string
    question_order: number | null
    max_pts: number
  }>

  const answerRows = (await sql`
    WITH latest_per_question AS (
      SELECT DISTINCT ON (qa.question_id)
        qa.question_id,
        qa.override_points,
        qa.points_earned
      FROM quiz_answers qa
      WHERE qa.attempt_id = ${attemptId}
      ORDER BY qa.question_id, qa.id DESC
    )
    SELECT * FROM latest_per_question
  `) as Array<{
    question_id: number
    override_points: number | null
    points_earned: number | null
  }>

  const answeredIds = new Set(answerRows.map((r) => r.question_id))
  const effectiveByQid = new Map<number, number>()
  for (const a of answerRows) {
    const q = questions.find((row) => row.id === a.question_id)
    const max = Number(q?.max_pts) || 1
    effectiveByQid.set(
      a.question_id,
      capQuestionPoints(a.override_points, a.points_earned, max),
    )
  }

  const sections = groupQuestionsBySections(questions, parsed)
  const resolved: SectionQuestionSelections = { ...(stored ?? {}) }

  for (const pick of pickSections) {
    if (resolved[pick.sectionIndex]?.length) continue
    const section = sections.find((s) => s.sectionIndex === pick.sectionIndex)
    if (!section) continue

    const candidates = section.questionIndices.flatMap((idx) => {
      const q = questions[idx]
      if (!q || !answeredIds.has(q.id)) return []
      return [
        {
          questionId: q.id,
          effectivePoints: effectiveByQid.get(q.id) ?? 0,
          maxPoints: Number(q.max_pts) || 1,
          answered: true,
        },
      ]
    })

    const { countingQuestionIds } = computeStudentPickSectionEarnedMax(
      pick.questionsRequired,
      candidates,
    )
    if (countingQuestionIds.length > 0) {
      resolved[pick.sectionIndex] = countingQuestionIds
    }
  }

  return Object.keys(resolved).length > 0 ? resolved : stored
}

/** Persist inferred picks when the attempt row has none (mid-semester Section II recovery). */
export async function persistInferredSectionQuestionSelections(
  attemptId: number,
  quizId: number,
  sectionConfig: SectionConfig[] | string | null | undefined,
): Promise<SectionQuestionSelections | null> {
  const stored = await loadSectionQuestionSelectionsForAttempt(attemptId)
  const resolved = await resolveSectionQuestionSelectionsForAttempt(
    attemptId,
    quizId,
    sectionConfig,
  )
  if (!resolved) return null

  const changed =
    !stored ||
    pickSectionsMissing(stored, resolved) ||
    JSON.stringify(stored) !== JSON.stringify(resolved)

  if (changed) {
    await ensureSectionQuestionSelectionSchema()
    await sql`
      UPDATE quiz_attempts
      SET section_question_selections = ${JSON.stringify(serializeSectionQuestionSelections(resolved))}::jsonb
      WHERE id = ${attemptId}
    `
  }
  return resolved
}

function pickSectionsMissing(
  before: SectionQuestionSelections,
  after: SectionQuestionSelections,
): boolean {
  for (const [key, ids] of Object.entries(after)) {
    const idx = Number(key)
    if (!before[idx]?.length && ids.length > 0) return true
  }
  return false
}
