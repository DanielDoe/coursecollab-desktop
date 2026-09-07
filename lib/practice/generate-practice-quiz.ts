import { sql } from "@/lib/db"
import { formatQuestionBankRowForRenderer } from "@/lib/resolve-quiz-question-from-bank"
import {
  listPracticeTopicsForCourse,
  resolveStudentPracticeContextFromParams,
} from "@/lib/student-practice-scope"
import { matchPracticeTopicName } from "@/lib/cora/platform-search"

export type GeneratePracticeQuizInput = {
  studentDbId: number
  topicQuery: string
  count?: number
  difficulty?: string
  courseId?: number | null
}

export type GeneratePracticeQuizResult = {
  attemptId: number
  topic: string
  questionCount: number
  questions: unknown[]
  href: string
}

export async function generatePracticeQuizForStudent(
  input: GeneratePracticeQuizInput,
): Promise<GeneratePracticeQuizResult> {
  const { studentDbId, topicQuery, courseId } = input
  const scope = await resolveStudentPracticeContextFromParams(
    String(studentDbId),
    null,
    courseId != null ? String(courseId) : null,
  )
  if (!scope.ok) {
    throw new Error("Could not resolve your course context")
  }

  const topics = (await listPracticeTopicsForCourse(
    scope.ctx.courseId,
    scope.ctx.practiceSession,
    scope.ctx.sessionVariants,
  )) as { name: string; question_count: number }[]

  const matchedTopic = matchPracticeTopicName(topicQuery, topics)
  if (!matchedTopic) {
    const suggestions = topics.slice(0, 5).map((t) => t.name)
    const hint =
      suggestions.length > 0
        ? ` Available topics include: ${suggestions.join(", ")}.`
        : ""
    throw new Error(`No practice topic matched "${topicQuery}".${hint}`)
  }

  const topicsArr = [matchedTopic]
  const difficulty = input.difficulty?.trim() || "mixed"
  const questionCount = Math.min(Math.max(input.count ?? 10, 5), 50)
  const session = scope.ctx.practiceSession
  const variants = scope.ctx.sessionVariants

  let query
  if (difficulty && difficulty !== "mixed") {
    query = sql`
      SELECT
        id, question_text, question_type, hint, difficulty, topic,
        options, correct_answer, question_media, subquestions, solution_upload_config
      FROM question_bank
      WHERE topic = ANY(${topicsArr})
        AND difficulty = ${difficulty}
        AND course_id = ${scope.ctx.courseId}
        AND deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM practice_question_availability pqa
          WHERE pqa.question_id = question_bank.id AND pqa.is_available = false
            AND (
              TRIM(pqa.session::text) = 'ALL'
              OR TRIM(pqa.session::text) = TRIM(${session ?? scope.ctx.practiceSession}::text)
              OR TRIM(pqa.session::text) = ANY(${variants}::text[])
            )
        )
      ORDER BY RANDOM()
      LIMIT ${questionCount}
    `
  } else {
    query = sql`
      SELECT
        id, question_text, question_type, hint, difficulty, topic,
        options, correct_answer, question_media, subquestions, solution_upload_config
      FROM question_bank
      WHERE topic = ANY(${topicsArr})
        AND course_id = ${scope.ctx.courseId}
        AND deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM practice_question_availability pqa
          WHERE pqa.question_id = question_bank.id AND pqa.is_available = false
            AND (
              TRIM(pqa.session::text) = 'ALL'
              OR TRIM(pqa.session::text) = TRIM(${session ?? scope.ctx.practiceSession}::text)
              OR TRIM(pqa.session::text) = ANY(${variants}::text[])
            )
        )
      ORDER BY RANDOM()
      LIMIT ${questionCount}
    `
  }

  const questions = (await query) as Record<string, unknown>[]
  if (questions.length === 0) {
    throw new Error(
      `No practice questions available for **${matchedTopic}**. Try another topic or difficulty.`,
    )
  }

  const attemptResult = (await sql`
    INSERT INTO practice_attempts (student_id, topics, difficulty, total_questions, correct_answers, started_at)
    VALUES (${studentDbId}, ${topicsArr}, ${difficulty}, ${questions.length}, 0, NOW())
    RETURNING id
  `) as { id: number }[]

  const attemptId = Number(attemptResult[0]!.id)
  const formatted = questions
    .map((q) => formatQuestionBankRowForRenderer(q))
    .filter(Boolean)

  return {
    attemptId,
    topic: matchedTopic,
    questionCount: formatted.length,
    questions: formatted,
    href: "/student/dashboard-v2/practice/quiz",
  }
}
