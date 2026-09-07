import { sql } from "@/lib/db"
import {
  recalculateAndSaveGrade,
  getGradeWeights,
  getGradeRolloverDeductions,
} from "@/lib/grades"
import { isSingleSittingExamAssessmentDbType } from "@/lib/final-exam-policy"
import { getSessionCodesWithAll, normalizeSessionForStorage } from "@/lib/session-catalog"

export const TRADE_CENTER_SOURCE_CATEGORIES = [
  "quiz",
  "homework",
  "midterm",
  "final",
  "attendance",
  "project",
  "classroom",
  "engagement",
] as const

export type TradeCenterSourceCategory = (typeof TRADE_CENTER_SOURCE_CATEGORIES)[number]

export const EXTRA_ATTEMPT_COSTS = { 1: 10, 2: 18 } as const

export type TradeCenterCategoryBreakdown = Record<
  TradeCenterSourceCategory,
  { score: number; deduction: number; available: number; weight: number }
>

export type TradeCenterAssessmentOption = {
  id: number
  title: string
  assessment_type: string
  available_until: string | null
}

export async function ensureGradeExtraAttemptTradesTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS grade_extra_attempt_trades (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      session VARCHAR(64) NOT NULL,
      quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      additional_attempts INTEGER NOT NULL DEFAULT 1 CHECK (additional_attempts > 0),
      points_cost INTEGER NOT NULL CHECK (points_cost > 0),
      source_category VARCHAR(32) NOT NULL,
      points_deducted INTEGER NOT NULL CHECK (points_deducted > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_grade_extra_attempt_trades_student
    ON grade_extra_attempt_trades (student_id, created_at DESC)
  `
}

export async function normalizeTradeSession(session: string): Promise<string> {
  return normalizeSessionForStorage(session || "ALL")
}

export async function getTradeCenterStudentContext(studentId: number) {
  const rows = await sql`
    SELECT s.id, s.section, s.session_id, s.course_id, sess.code as session_code
    FROM students s
    LEFT JOIN sessions sess ON s.session_id = sess.id
    WHERE s.id = ${studentId}
    LIMIT 1
  `
  if (rows.length === 0) return null
  const row = rows[0] as {
    id: number
    section: string | null
    session_id: number | null
    course_id: number | null
    session_code: string | null
  }
  return {
    studentId: row.id,
    sectionCode: row.session_code || row.section || "ALL",
    sessionId: row.session_id,
    courseId: row.course_id,
  }
}

const CATEGORY_TO_COLUMN: Record<TradeCenterSourceCategory, string> = {
  quiz: "quiz_score",
  homework: "homework_score",
  midterm: "midterm_score",
  final: "final_score",
  attendance: "attendance_score",
  project: "project_score",
  classroom: "classroom_score",
  engagement: "engagement_credits",
}

const CATEGORY_SCORE_KEYS: Record<TradeCenterSourceCategory, keyof Awaited<ReturnType<typeof recalculateAndSaveGrade>>> = {
  quiz: "quiz_score",
  homework: "homework_score",
  midterm: "midterm_score",
  final: "final_score",
  attendance: "attendance_score",
  project: "project_score",
  classroom: "classroom_score",
  engagement: "engagement_credits",
}

const CATEGORY_WEIGHT_KEYS: Record<TradeCenterSourceCategory, string> = {
  quiz: "quiz_weight",
  homework: "homework_weight",
  midterm: "midterm_weight",
  final: "final_weight",
  attendance: "attendance_weight",
  project: "project_weight",
  classroom: "classroom_weight",
  engagement: "engagement_weight",
}

export async function buildTradeCenterCategoryBreakdown(
  studentId: number,
  studentSection: string,
): Promise<{ categories: TradeCenterCategoryBreakdown; weights: Awaited<ReturnType<typeof getGradeWeights>> } | null> {
  const grade = await recalculateAndSaveGrade(studentId, studentSection)
  const weights = await getGradeWeights(studentSection)
  const deductions = await getGradeRolloverDeductions(studentId, studentSection)

  if (!grade || !weights) return null

  const categories = {} as TradeCenterCategoryBreakdown
  for (const cat of TRADE_CENTER_SOURCE_CATEGORIES) {
    const score = Number(grade[CATEGORY_SCORE_KEYS[cat]]) || 0
    categories[cat] = {
      score,
      deduction: deductions[cat],
      available: score,
      weight: Number(weights[CATEGORY_WEIGHT_KEYS[cat] as keyof typeof weights]) || 0,
    }
  }

  return { categories, weights }
}

export async function loadStudentGradeRow(
  studentId: number,
  session: string,
  studentSessionCode?: string | null,
): Promise<Record<string, number> | null> {
  const storedStudentSession = studentSessionCode
    ? await normalizeSessionForStorage(String(studentSessionCode))
    : null
  const gradeSessionSet = new Set(await getSessionCodesWithAll())
  const sessionsToTry = [
    session,
    ...(session !== "ALL" ? ["ALL"] : []),
    ...(storedStudentSession &&
    storedStudentSession !== session &&
    gradeSessionSet.has(storedStudentSession)
      ? [storedStudentSession]
      : []),
  ]
  const uniqueSessions = [...new Set(sessionsToTry)]

  for (const sess of uniqueSessions) {
    if (!gradeSessionSet.has(sess)) continue
    const rows = await sql`
      SELECT quiz_score, homework_score, midterm_score, final_score,
             attendance_score, project_score, classroom_score, engagement_credits
      FROM student_grades
      WHERE student_id = ${studentId} AND session = ${sess}
      LIMIT 1
    `
    if (rows.length > 0) {
      return rows[0] as Record<string, number>
    }
  }
  return null
}

export function categoryScoreFromGradeRow(
  grade: Record<string, number>,
  sourceCategory: TradeCenterSourceCategory,
): number {
  const col = CATEGORY_TO_COLUMN[sourceCategory]
  return Number(grade[col]) || 0
}

export async function listSessionAccessibleAssessments(
  sessionId: number | null,
  studentSection: string,
  mode: "rollover" | "extra_attempts",
): Promise<TradeCenterAssessmentOption[]> {
  let resolvedSessionId = sessionId
  if (!resolvedSessionId) {
    const sessionIdByCode = await sql`
      SELECT id FROM sessions WHERE code = ${studentSection} LIMIT 1
    `
    resolvedSessionId = sessionIdByCode[0]?.id != null ? Number(sessionIdByCode[0].id) : null
  }
  if (!resolvedSessionId) return []

  const rows =
    mode === "rollover"
      ? await sql`
          SELECT q.id, q.title, q.assessment_type, q.available_until
          FROM quizzes q
          JOIN quiz_session_access qsa ON q.id = qsa.quiz_id AND qsa.session_id = ${resolvedSessionId} AND qsa.is_active = true
          WHERE q.deleted_at IS NULL
            AND q.assessment_type IS NOT NULL
            AND LOWER(TRIM(q.assessment_type::text)) NOT IN ('final', 'finals', 'final_exam', 'mid_semester', 'mid-semester', 'midsem')
            AND COALESCE(q.rollover_enabled, false) = true
            AND q.available_until IS NOT NULL
            AND q.available_until < NOW()
          ORDER BY q.assessment_type, q.title
        `
      : await sql`
          SELECT q.id, q.title, q.assessment_type, q.available_until
          FROM quizzes q
          JOIN quiz_session_access qsa ON q.id = qsa.quiz_id AND qsa.session_id = ${resolvedSessionId} AND qsa.is_active = true
          WHERE q.deleted_at IS NULL
            AND q.assessment_type IS NOT NULL
            AND LOWER(TRIM(q.assessment_type::text)) NOT IN ('final', 'finals', 'final_exam', 'mid_semester', 'mid-semester', 'midsem')
          ORDER BY q.assessment_type, q.title
        `

  return (rows as TradeCenterAssessmentOption[]).map((a) => ({
    id: a.id,
    title: a.title,
    assessment_type: a.assessment_type,
    available_until: a.available_until != null ? String(a.available_until) : null,
  }))
}

export async function grantTradeCenterExtraAttempts(params: {
  studentId: number
  quizId: number
  additionalAttempts: number
  reason: string
}): Promise<void> {
  const existingOverride = await sql`
    SELECT id, additional_attempts FROM attempt_overrides
    WHERE student_id = ${params.studentId} AND quiz_id = ${params.quizId} AND is_active = true
    LIMIT 1
  `

  if (existingOverride.length > 0) {
    const current = Number((existingOverride[0] as { additional_attempts: number }).additional_attempts) || 0
    await sql`
      UPDATE attempt_overrides
      SET additional_attempts = ${current + params.additionalAttempts},
          reason = ${params.reason},
          updated_at = CURRENT_TIMESTAMP
      WHERE student_id = ${params.studentId} AND quiz_id = ${params.quizId}
    `
  } else {
    await sql`
      INSERT INTO attempt_overrides (quiz_id, student_id, additional_attempts, reason, expires_at)
      VALUES (${params.quizId}, ${params.studentId}, ${params.additionalAttempts}, ${params.reason}, NULL)
    `
  }
}

export function isTradeCenterSourceCategory(raw: string): raw is TradeCenterSourceCategory {
  return (TRADE_CENTER_SOURCE_CATEGORIES as readonly string[]).includes(raw)
}

export async function validateAssessmentForTrade(params: {
  quizId: number
  blockFinals?: boolean
}): Promise<
  | { ok: true; quiz: { id: number; title: string; assessment_type?: string | null; rollover_enabled?: boolean | null } }
  | { ok: false; error: string; status: number; semesterAssessmentsClosed?: boolean }
> {
  const quizRows = await sql`
    SELECT id, title, rollover_enabled, rollover_hours, assessment_type
    FROM quizzes
    WHERE id = ${params.quizId} AND deleted_at IS NULL
    LIMIT 1
  `
  if (quizRows.length === 0) {
    return { ok: false, error: "Assessment not found", status: 404 }
  }
  const quiz = quizRows[0] as {
    id: number
    title: string
    rollover_enabled: boolean | null
    rollover_hours: number | null
    assessment_type?: string | null
  }

  if (isSingleSittingExamAssessmentDbType(quiz.assessment_type)) {
    return { ok: false, error: "Mid-semester and final exams cannot use this trade.", status: 403 }
  }

  return { ok: true, quiz }
}
