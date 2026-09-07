/**
 * Shared create-assessment-from-bank — used by Cora confirm (and eventually the UI route).
 * Links Question Bank items into a quiz/homework shell without snapshotting content.
 */

import { sql } from "@/lib/db"
import { minimalBankLinkedQuizQuestionFields } from "@/lib/resolve-quiz-question-from-bank"
import { getDefaultTimeLimit } from "@/lib/config/quizSettings"
import { parseClientAvailabilityToUtcIso, utcIsoToDbTimestamp } from "@/lib/timezone"
import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"

const DEFAULT_TIME_LIMITS: Record<string, number> = {
  true_false: 30,
  mcq: 50,
  select_all: 60,
  fill_blank: 45,
  code_output: 75,
  code_debug: 90,
  fill_code: 60,
  trace_logic: 80,
  scenario_match: 70,
  multi_output: 80,
  code_reorder: 100,
  code_problem: 420,
  trace_output: 90,
  debug_code: 120,
  code_write: 420,
  code_explain: 120,
}

export type AssessmentFromBankType = "quiz" | "homework" | "mid_semester" | "final"

export type CreateAssessmentFromBankInput = {
  instructorId: number
  courseId: number
  title: string
  description?: string | null
  questionIds: number[]
  assessmentType?: AssessmentFromBankType
  timeLimit?: number | null
  customTimeLimits?: Record<number, number>
  availableFrom?: string | null
  availableUntil?: string | null
  /** When true, assessment is visible to students (publish). Default false = draft shell. */
  publish?: boolean
}

export type CreateAssessmentFromBankResult = {
  quizId: number
  questionsAdded: number
  assessmentType: AssessmentFromBankType
  title: string
  published: boolean
}

async function assessmentTypeColumnExists(): Promise<boolean> {
  try {
    await sql`SELECT assessment_type FROM quizzes LIMIT 1`
    return true
  } catch {
    return false
  }
}

export async function createAssessmentFromBank(
  input: CreateAssessmentFromBankInput,
): Promise<CreateAssessmentFromBankResult> {
  const title = String(input.title ?? "").trim()
  if (!title) throw new Error("Title is required.")

  const questionIds = (input.questionIds ?? [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0)
  if (questionIds.length === 0) throw new Error("At least one Question Bank item is required.")
  if (questionIds.length > 50) throw new Error("Max 50 questions per assessment from bank.")

  const allowed = await instructorCanAccessCourse(input.instructorId, input.courseId)
  if (!allowed) {
    throw new Error("Instructor cannot create assessments for this course.")
  }

  const assessmentType: AssessmentFromBankType =
    input.assessmentType === "homework" ||
    input.assessmentType === "mid_semester" ||
    input.assessmentType === "final"
      ? input.assessmentType
      : "quiz"

  const availableFromUTC = utcIsoToDbTimestamp(
    parseClientAvailabilityToUtcIso(input.availableFrom ?? null),
  )
  const availableUntilUTC = utcIsoToDbTimestamp(
    parseClientAvailabilityToUtcIso(input.availableUntil ?? null),
  )
  const timeLimit = input.timeLimit ?? 30
  const published = input.publish === true
  const hasAssessmentType = await assessmentTypeColumnExists()

  const [quiz] = (
    hasAssessmentType
      ? await sql`
        INSERT INTO quizzes (
          title, description, created_by, is_public, time_per_question,
          available_from, available_until, assessment_type, created_at, updated_at
        )
        VALUES (
          ${title},
          ${input.description?.trim() || null},
          ${input.instructorId},
          ${published},
          ${timeLimit},
          ${availableFromUTC},
          ${availableUntilUTC},
          ${assessmentType},
          NOW(),
          NOW()
        )
        RETURNING id
      `
      : await sql`
        INSERT INTO quizzes (
          title, description, created_by, is_public, time_per_question,
          available_from, available_until, created_at, updated_at
        )
        VALUES (
          ${title},
          ${input.description?.trim() || null},
          ${input.instructorId},
          ${published},
          ${timeLimit},
          ${availableFromUTC},
          ${availableUntilUTC},
          NOW(),
          NOW()
        )
        RETURNING id
      `
  ) as unknown as { id: number }[]

  const quizId = Number(quiz.id)

  try {
    const selectedQuestions = (await sql`
      SELECT
        id,
        question_text,
        question_type,
        difficulty,
        topic,
        options::text as options,
        correct_answer::text as correct_answer,
        hint,
        question_media,
        subquestions,
        solution_upload_config
      FROM question_bank
      WHERE id = ANY(${questionIds})
        AND (course_id = ${input.courseId} OR course_id IS NULL)
    `) as unknown as Array<Record<string, unknown> & { id: number; question_type: string }>

    if (!selectedQuestions?.length) {
      throw new Error("No matching Question Bank items found for this course.")
    }

    const byId = new Map(selectedQuestions.map((q) => [Number(q.id), q]))
    const ordered = questionIds
      .map((id) => byId.get(id))
      .filter(Boolean) as typeof selectedQuestions
    if (ordered.length === 0) {
      throw new Error("No matching Question Bank items found for this course.")
    }

    const inserted: { id: number; bank_question_id: number }[] = []
    for (let i = 0; i < ordered.length; i++) {
      const q = ordered[i]!
      const timeForQ =
        input.customTimeLimits?.[Number(q.id)] ??
        DEFAULT_TIME_LIMITS[String(q.question_type)] ??
        getDefaultTimeLimit(String(q.question_type || "mcq"))
      const linked = minimalBankLinkedQuizQuestionFields(q as Record<string, unknown>, {
        questionOrder: i + 1,
        timeLimit: timeForQ,
      })

      const rows = (await sql`
        INSERT INTO quiz_questions (
          quiz_id, question_text, question_order, bank_question_id, time_limit,
          question_type, points, max_points, created_at
        ) VALUES (
          ${quizId},
          '',
          ${linked.question_order},
          ${linked.bank_question_id},
          ${linked.time_limit},
          ${linked.question_type},
          ${linked.points ?? 1},
          ${linked.max_points ?? 1},
          NOW()
        )
        RETURNING id, bank_question_id
      `) as unknown as { id: number; bank_question_id: number }[]
      const row = rows[0]
      if (!row) continue
      inserted.push({ id: Number(row.id), bank_question_id: Number(row.bank_question_id) })
    }

    for (const row of inserted) {
      await sql`
        INSERT INTO question_bank_usage (quiz_id, bank_question_id, question_id, used_at)
        VALUES (${quizId}, ${row.bank_question_id}, ${row.id}, NOW())
      `
    }

    let sessions: { id: number }[] = []
    try {
      sessions = (await sql`
        SELECT id FROM sessions WHERE course_id = ${input.courseId}
      `) as unknown as { id: number }[]
    } catch {
      sessions = []
    }
    if (sessions.length === 0) {
      sessions = (await sql`SELECT id FROM sessions`) as unknown as { id: number }[]
    }

    for (const session of sessions) {
      await sql`
        INSERT INTO quiz_session_access (quiz_id, session_id, is_active, updated_at)
        VALUES (${quizId}, ${session.id}, true, CURRENT_TIMESTAMP)
        ON CONFLICT (quiz_id, session_id) DO NOTHING
      `
    }

    return {
      quizId,
      questionsAdded: inserted.length,
      assessmentType,
      title,
      published,
    }
  } catch (error) {
    await sql`DELETE FROM quizzes WHERE id = ${quizId}`.catch(() => {})
    throw error
  }
}

/** Resolve bank question IDs by topic for proposal helpers. */
export async function findQuestionBankIdsByTopic(input: {
  courseId: number
  topic: string
  limit?: number
}): Promise<{ id: number; topic: string | null; difficulty: string | null }[]> {
  const topic = input.topic.trim()
  if (!topic) return []
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 30)
  const rows = (await sql`
    SELECT id, topic, difficulty
    FROM question_bank
    WHERE course_id = ${input.courseId}
      AND (
        topic ILIKE ${"%" + topic + "%"}
        OR question_text ILIKE ${"%" + topic + "%"}
      )
    ORDER BY id DESC
    LIMIT ${limit}
  `) as unknown as { id: number; topic: string | null; difficulty: string | null }[]
  return rows.map((r) => ({
    id: Number(r.id),
    topic: r.topic,
    difficulty: r.difficulty,
  }))
}
