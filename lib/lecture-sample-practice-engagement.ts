import { sql } from "@/lib/db"
import { syncActivityPointsAfterAction } from "@/lib/trade-center-sync"

export type RecordSamplePracticeAttemptInput = {
  studentDbId: number
  sessionCode: string
  lectureId: number
  questionId: string
  scorePercentage: number
  isCorrect: boolean
  studentAnswer?: unknown
}

export type SamplePracticeAttemptRow = {
  question_id: string
  is_correct: boolean
  score_percentage: number
  student_answer: unknown
  completed_at: string
}

/** Load a student's saved attempt for one sample-practice question (if any). */
export async function getSamplePracticeAttempt(
  studentDbId: number,
  lectureId: number,
  questionId: string,
): Promise<SamplePracticeAttemptRow | null> {
  try {
    const rows = await sql`
      SELECT question_id, is_correct, score_percentage, student_answer, completed_at
      FROM lecture_sample_practice_attempts
      WHERE student_id = ${studentDbId}
        AND lecture_id = ${lectureId}
        AND question_id = ${questionId}
      LIMIT 1
    `
    if (!rows.length) return null
    return rows[0] as SamplePracticeAttemptRow
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code
    if (code === "42P01" || code === "42703") return null
    throw error
  }
}

/** Persist a sample-practice submission (first attempt per question earns practice points). */
export async function recordSamplePracticeAttempt(
  input: RecordSamplePracticeAttemptInput,
): Promise<{ recorded: boolean; pointsSynced: boolean }> {
  const { studentDbId, sessionCode, lectureId, questionId, scorePercentage, isCorrect, studentAnswer } = input

  const answerJson = studentAnswer == null ? null : JSON.stringify(studentAnswer)

  let recorded = false
  let firstAttempt = false
  try {
    const rows = await sql`
      INSERT INTO lecture_sample_practice_attempts (
        student_id, lecture_id, question_id, is_correct, score_percentage, student_answer, completed_at
      )
      VALUES (
        ${studentDbId},
        ${lectureId},
        ${questionId},
        ${isCorrect},
        ${scorePercentage},
        ${answerJson}::jsonb,
        NOW()
      )
      ON CONFLICT (student_id, lecture_id, question_id) DO NOTHING
      RETURNING id, (xmax = 0) AS inserted
    `
    recorded = rows.length > 0
    firstAttempt = rows.length > 0 && Boolean((rows[0] as { inserted?: boolean }).inserted)
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code
    if (code === "42P01" || code === "42703") {
      // Table/column not migrated yet — skip silently
      return { recorded: false, pointsSynced: false }
    }
    throw error
  }

  let pointsSynced = false
  if (firstAttempt) {
    try {
      await syncActivityPointsAfterAction(studentDbId, sessionCode, "practice")
      pointsSynced = true
    } catch {
      pointsSynced = false
    }
  }

  return { recorded, pointsSynced }
}