import { sql } from "@/lib/db"
import { finalizePracticeAttemptFromSavedAnswers } from "@/lib/practice-finalize-from-answers"

/** Increment topic stats when a single practice answer is saved (live hub progress). */
export async function incrementStudentTopicProgress(
  studentDbId: number,
  topic: string,
  isCorrect: boolean,
): Promise<void> {
  const normalizedTopic = String(topic ?? "").trim()
  if (!normalizedTopic) return

  await sql`
    INSERT INTO student_topic_progress (
      student_id,
      topic,
      questions_completed,
      questions_correct,
      accuracy,
      last_practiced
    ) VALUES (
      ${studentDbId},
      ${normalizedTopic},
      1,
      ${isCorrect ? 1 : 0},
      ${isCorrect ? 100 : 0},
      NOW()
    )
    ON CONFLICT (student_id, topic)
    DO UPDATE SET
      questions_completed = student_topic_progress.questions_completed + 1,
      questions_correct = student_topic_progress.questions_correct + ${isCorrect ? 1 : 0},
      accuracy = ROUND(
        (student_topic_progress.questions_correct + ${isCorrect ? 1 : 0})::NUMERIC /
        (student_topic_progress.questions_completed + 1) * 100
      ),
      last_practiced = NOW()
  `
}

export async function getPracticeAttemptAnswerProgress(attemptId: number): Promise<{
  answered: number
  total: number
  completed: boolean
}> {
  const [row] = await sql`
    SELECT
      pa.total_questions::int AS total,
      pa.completed_at,
      COUNT(pans.id)::int AS answered
    FROM practice_attempts pa
    LEFT JOIN practice_answers pans ON pans.attempt_id = pa.id
    WHERE pa.id = ${attemptId}
    GROUP BY pa.id, pa.total_questions, pa.completed_at
    LIMIT 1
  `
  if (!row) {
    return { answered: 0, total: 0, completed: false }
  }
  const total = Number(row.total) || 0
  const answered = Number(row.answered) || 0
  return {
    answered,
    total,
    completed: row.completed_at != null,
  }
}

/** Live hub progress + optional auto-finalize when every question in the session is answered. */
export async function recordPracticeAnswerSideEffects(opts: {
  attemptId: number
  studentDbId: number
  topic: string
  isCorrect: boolean
}): Promise<{
  progress: { answered: number; total: number; completed: boolean }
  finalized: boolean
  score?: number
  correctCount?: number
}> {
  const { attemptId, studentDbId, topic, isCorrect } = opts
  await incrementStudentTopicProgress(studentDbId, topic, isCorrect)

  const progress = await getPracticeAttemptAnswerProgress(attemptId)
  if (
    !progress.completed &&
    progress.total > 0 &&
    progress.answered >= progress.total
  ) {
    const result = await finalizePracticeAttemptFromSavedAnswers(attemptId, studentDbId)
    if (result.success) {
      return {
        progress: { ...progress, completed: true },
        finalized: true,
        score: result.score,
        correctCount: result.correctCount,
      }
    }
  }

  return { progress, finalized: false }
}
