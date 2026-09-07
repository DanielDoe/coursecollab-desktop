import { sql } from "@/lib/db"
import {
  getAttemptScoreScale,
  inferAttemptScoreScale,
  scoreToDisplayPercentage,
  type AttemptScoreScale,
} from "@/lib/attempt-score-scale"

export type AttemptScoreChangeSource =
  | "ai_evaluation"
  | "instructor_total_override"
  | "instructor_question_override"
  | "instructor_manual_grade"
  | "instructor_bulk_reevaluate"
  | "instructor_re_evaluate"
  | "student_re_evaluate"
  | "recalculate"
  | "finalize"
  | "submit_answer"
  | "bulk_reevaluate"
  | "final_attempt_selected"
  | "auto_finalize"
  | "admin_edit"
  | "system"

export type AttemptScoreActorType = "system" | "student" | "instructor" | "ai" | "admin"

export const ATTEMPT_SCORE_CHANGE_LABELS: Record<AttemptScoreChangeSource, string> = {
  ai_evaluation: "AI evaluation (Quiz Master)",
  instructor_total_override: "Instructor adjusted total score",
  instructor_question_override: "Instructor adjusted question grade",
  instructor_manual_grade: "Instructor manual grade",
  instructor_bulk_reevaluate: "Instructor bulk re-evaluation",
  instructor_re_evaluate: "Instructor re-evaluated answer",
  student_re_evaluate: "Student re-evaluated answer",
  recalculate: "Score recalculated",
  finalize: "Attempt finalized",
  submit_answer: "Answer submitted / graded",
  bulk_reevaluate: "Bulk re-evaluation",
  final_attempt_selected: "Final attempt selected (retake policy)",
  auto_finalize: "Auto-finalize policy applied",
  admin_edit: "Admin score edit",
  system: "System update",
}

let tableEnsured = false

export async function ensureAttemptScoreHistoryTable(): Promise<void> {
  if (tableEnsured) return
  await sql`
    CREATE TABLE IF NOT EXISTS quiz_attempt_score_history (
      id SERIAL PRIMARY KEY,
      attempt_id INTEGER NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
      quiz_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      previous_score NUMERIC,
      new_score NUMERIC NOT NULL,
      previous_percentage NUMERIC,
      new_percentage NUMERIC,
      total_points NUMERIC,
      change_source VARCHAR(64) NOT NULL,
      change_reason TEXT,
      actor_type VARCHAR(32) NOT NULL DEFAULT 'system',
      actor_id VARCHAR(64),
      actor_label TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_quiz_attempt_score_history_attempt
      ON quiz_attempt_score_history (attempt_id, created_at DESC)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_quiz_attempt_score_history_student_quiz
      ON quiz_attempt_score_history (student_id, quiz_id, created_at DESC)
  `
  tableEnsured = true
}

function pct(
  score: number,
  total: number | null | undefined,
  scale?: AttemptScoreScale | null,
): number | null {
  if (scale?.scoreIsPercentScale) {
    return scoreToDisplayPercentage(score, scale)
  }
  if (total == null || total <= 0) return null
  return Math.round((score / total) * 10000) / 100
}

export async function getAttemptScoreContext(attemptId: number): Promise<{
  attemptId: number
  quizId: number
  studentId: number
  score: number
  totalPoints: number | null
  scale: AttemptScoreScale
} | null> {
  const rows = await sql`
    SELECT
      qa.id,
      qa.quiz_id,
      qa.student_id,
      qa.score,
      qa.total_questions,
      q.assessment_type,
      q.section_config,
      (SELECT COUNT(*)::int FROM quiz_questions qq WHERE qq.quiz_id = qa.quiz_id) AS question_count,
      (SELECT COALESCE(SUM(COALESCE(qq.max_points, qq.points, 1)), 0)::numeric
       FROM quiz_questions qq WHERE qq.quiz_id = qa.quiz_id) AS quiz_total_points
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa.quiz_id
    WHERE qa.id = ${attemptId} AND qa.deleted_at IS NULL
    LIMIT 1
  `
  const row = rows[0] as {
    id: number
    quiz_id: number
    student_id: number
    score: unknown
    total_questions: unknown
    assessment_type: string
    section_config: unknown
    question_count: number
    quiz_total_points: unknown
  } | undefined
  if (!row) return null

  const scale = inferAttemptScoreScale({
    score: Number(row.score) || 0,
    totalQuestionsField: Number(row.total_questions) || 0,
    quizTotalRawPoints: Number(row.quiz_total_points) || 0,
    questionCount: Number(row.question_count) || 0,
    assessmentType: row.assessment_type,
    sectionConfig: row.section_config,
  })

  return {
    attemptId: row.id,
    quizId: row.quiz_id,
    studentId: row.student_id,
    score: Number(row.score) || 0,
    totalPoints: scale.totalPoints,
    scale,
  }
}

export async function recordAttemptScoreChange(params: {
  attemptId: number
  previousScore: number | null
  newScore: number
  totalPoints?: number | null
  source: AttemptScoreChangeSource
  reason?: string
  actorType?: AttemptScoreActorType
  actorId?: string | number | null
  actorLabel?: string
  metadata?: Record<string, unknown>
  /** Log even when score unchanged (e.g. first finalize). */
  force?: boolean
}): Promise<void> {
  const prev = params.previousScore
  const next = params.newScore
  if (!params.force && prev != null && Math.abs(prev - next) < 0.001) {
    return
  }

  try {
    await ensureAttemptScoreHistoryTable()
    const ctx = await getAttemptScoreContext(params.attemptId)
    if (!ctx) return

    const total =
      params.totalPoints ??
      ctx.totalPoints

    const scale =
      params.totalPoints === 100
        ? ({ scoreIsPercentScale: true, totalPoints: 100, quizTotalRawPoints: ctx.scale.quizTotalRawPoints } satisfies AttemptScoreScale)
        : ctx.scale

    await sql`
      INSERT INTO quiz_attempt_score_history (
        attempt_id,
        quiz_id,
        student_id,
        previous_score,
        new_score,
        previous_percentage,
        new_percentage,
        total_points,
        change_source,
        change_reason,
        actor_type,
        actor_id,
        actor_label,
        metadata
      )
      VALUES (
        ${ctx.attemptId},
        ${ctx.quizId},
        ${ctx.studentId},
        ${prev},
        ${next},
        ${prev != null ? pct(prev, total, scale) : null},
        ${pct(next, total, scale)},
        ${total},
        ${params.source},
        ${params.reason ?? null},
        ${params.actorType ?? "system"},
        ${params.actorId != null ? String(params.actorId) : null},
        ${params.actorLabel ?? null},
        ${JSON.stringify(params.metadata ?? {})}::jsonb
      )
    `
  } catch (e) {
    console.warn("[attempt-score-history] Failed to record change:", e)
  }
}

export type AttemptScoreHistoryRow = {
  id: number
  attempt_id: number
  attempt_number: number | null
  quiz_id: number
  student_id: number
  previous_score: number | null
  new_score: number
  previous_percentage: number | null
  new_percentage: number | null
  total_points: number | null
  change_source: AttemptScoreChangeSource
  change_reason: string | null
  actor_type: string
  actor_id: string | null
  actor_label: string | null
  metadata: Record<string, unknown>
  created_at: string
  source_label: string
}

function historyRowScale(
  row: Record<string, unknown>,
  quizScale: AttemptScoreScale | null | undefined,
  score: number | null,
): AttemptScoreScale | null {
  if (!quizScale) return null
  const storedTotal = row.total_points != null ? Number(row.total_points) : null
  if (storedTotal === 100) {
    return { scoreIsPercentScale: true, totalPoints: 100, quizTotalRawPoints: quizScale.quizTotalRawPoints }
  }
  if (!quizScale.scoreIsPercentScale || score == null || storedTotal == null || storedTotal <= 0) {
    return quizScale
  }
  if (score > storedTotal && score <= 100) {
    return { scoreIsPercentScale: true, totalPoints: 100, quizTotalRawPoints: quizScale.quizTotalRawPoints }
  }
  if (score <= storedTotal) {
    return {
      scoreIsPercentScale: false,
      totalPoints: storedTotal,
      quizTotalRawPoints: quizScale.quizTotalRawPoints,
    }
  }
  return quizScale
}

function mapHistoryRow(
  row: Record<string, unknown>,
  quizScale?: AttemptScoreScale | null,
): AttemptScoreHistoryRow {
  const source = String(row.change_source ?? "system") as AttemptScoreChangeSource
  const previousScore = row.previous_score != null ? Number(row.previous_score) : null
  const newScore = Number(row.new_score)
  const storedTotal = row.total_points != null ? Number(row.total_points) : null

  let previous_percentage =
    row.previous_percentage != null ? Number(row.previous_percentage) : null
  let new_percentage = row.new_percentage != null ? Number(row.new_percentage) : null

  if (quizScale) {
    if (previousScore != null) {
      const prevScale = historyRowScale(row, quizScale, previousScore) ?? quizScale
      previous_percentage = pct(previousScore, storedTotal ?? prevScale.totalPoints, prevScale)
    }
    const nextScale = historyRowScale(row, quizScale, newScore) ?? quizScale
    new_percentage = pct(newScore, storedTotal ?? nextScale.totalPoints, nextScale)
  }

  return {
    id: Number(row.id),
    attempt_id: Number(row.attempt_id),
    attempt_number: row.attempt_number != null ? Number(row.attempt_number) : null,
    quiz_id: Number(row.quiz_id),
    student_id: Number(row.student_id),
    previous_score: previousScore,
    new_score: newScore,
    previous_percentage,
    new_percentage,
    total_points: row.total_points != null ? Number(row.total_points) : null,
    change_source: source,
    change_reason: row.change_reason != null ? String(row.change_reason) : null,
    actor_type: String(row.actor_type ?? "system"),
    actor_id: row.actor_id != null ? String(row.actor_id) : null,
    actor_label: row.actor_label != null ? String(row.actor_label) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
    source_label: ATTEMPT_SCORE_CHANGE_LABELS[source] ?? source,
  }
}

export async function getAttemptScoreHistory(attemptId: number): Promise<AttemptScoreHistoryRow[]> {
  try {
    await ensureAttemptScoreHistoryTable()
    const scale = await getAttemptScoreScale(attemptId)
    const rows = await sql`
      SELECT h.*, qa.attempt_number
      FROM quiz_attempt_score_history h
      LEFT JOIN quiz_attempts qa ON qa.id = h.attempt_id
      WHERE h.attempt_id = ${attemptId}
      ORDER BY h.created_at DESC, h.id DESC
    `
    return (rows as Record<string, unknown>[]).map((row) => mapHistoryRow(row, scale))
  } catch {
    return []
  }
}

export async function getStudentQuizScoreHistory(
  studentId: number,
  quizId: number,
  limit = 100,
): Promise<AttemptScoreHistoryRow[]> {
  try {
    await ensureAttemptScoreHistoryTable()
    const scaleRows = await sql`
      SELECT q.assessment_type, q.section_config,
        (SELECT COALESCE(SUM(COALESCE(qq.max_points, qq.points, 1)), 0)::numeric
         FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS quiz_total_points
      FROM quizzes q WHERE q.id = ${quizId} LIMIT 1
    `
    const quizScale =
      scaleRows.length > 0
        ? inferAttemptScoreScale({
            score: 0,
            totalQuestionsField: 100,
            quizTotalRawPoints: Number((scaleRows[0] as { quiz_total_points: unknown }).quiz_total_points) || 0,
            questionCount: 0,
            assessmentType: String((scaleRows[0] as { assessment_type: string }).assessment_type),
            sectionConfig: (scaleRows[0] as { section_config: unknown }).section_config,
          })
        : null
    const rows = await sql`
      SELECT h.*, qa.attempt_number
      FROM quiz_attempt_score_history h
      LEFT JOIN quiz_attempts qa ON qa.id = h.attempt_id
      WHERE h.student_id = ${studentId}
        AND h.quiz_id = ${quizId}
      ORDER BY h.created_at DESC, h.id DESC
      LIMIT ${limit}
    `
    return (rows as Record<string, unknown>[]).map((row) => mapHistoryRow(row, quizScale))
  } catch {
    return []
  }
}
