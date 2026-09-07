/**
 * Shared assessment results analysis for Faculty Cora (read-only).
 * Powers remediation workflows without giving the model raw SQL.
 */

import { sql } from "@/lib/db"
import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"

export type WeakQuestionInsight = {
  questionId: number
  stem: string
  topic: string | null
  accuracyPct: number
  attempts: number
}

export type AssessmentResultsAnalysis = {
  assessmentId: number
  title: string
  assessmentType: string | null
  averageScore: number
  completedAttempts: number
  uniqueStudents: number
  weakQuestions: WeakQuestionInsight[]
  weakTopics: { topic: string; accuracyPct: number; attempts: number }[]
  summaryText: string
}

/** Most recently completed quiz/homework in the course (by latest attempt completion). */
export async function findMostRecentlyCompletedAssessment(input: {
  instructorId: number
  courseId: number
}): Promise<{ id: number; title: string; completedAttempts: number; lastCompletedAt: string } | null> {
  const allowed = await instructorCanAccessCourse(input.instructorId, input.courseId)
  if (!allowed) {
    throw new Error("Instructor cannot analyze results for this course.")
  }

  const rows = (await sql`
    SELECT
      q.id,
      q.title,
      COUNT(qa.id)::int as completed_attempts,
      MAX(qa.completed_at)::text as last_completed_at
    FROM quizzes q
    INNER JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.completed_at IS NOT NULL
    WHERE q.course_id = ${input.courseId}
    GROUP BY q.id, q.title
    HAVING COUNT(qa.id) > 0
    ORDER BY MAX(qa.completed_at) DESC NULLS LAST
    LIMIT 1
  `) as unknown as Array<{
    id: number
    title: string
    completed_attempts: number
    last_completed_at: string
  }>

  const row = rows[0]
  if (!row) return null
  return {
    id: Number(row.id),
    title: String(row.title ?? "Quiz"),
    completedAttempts: Number(row.completed_attempts ?? 0),
    lastCompletedAt: String(row.last_completed_at ?? ""),
  }
}

export async function analyzeAssessmentResults(input: {
  instructorId: number
  courseId: number
  assessmentId: number
}): Promise<AssessmentResultsAnalysis> {
  const allowed = await instructorCanAccessCourse(input.instructorId, input.courseId)
  if (!allowed) {
    throw new Error("Instructor cannot analyze results for this course.")
  }

  const assessmentId = Number(input.assessmentId)
  if (!Number.isFinite(assessmentId) || assessmentId <= 0) {
    throw new Error("Valid assessmentId is required.")
  }

  let assessmentRows = (await sql`
    SELECT id, title, assessment_type, created_by
    FROM quizzes
    WHERE id = ${assessmentId} AND deleted_at IS NULL
    LIMIT 1
  `.catch(async () => [])) as unknown as Array<{
    id: number
    title: string
    assessment_type: string | null
    created_by: number
  }>

  if (!assessmentRows.length) {
    assessmentRows = (await sql`
      SELECT id, title, NULL::text as assessment_type, created_by
      FROM quizzes
      WHERE id = ${assessmentId}
      LIMIT 1
    `) as unknown as typeof assessmentRows
  }

  if (!assessmentRows.length) {
    throw new Error("Assessment not found.")
  }
  const assessment = assessmentRows[0]!

  const attemptStatsRows = (await sql`
    SELECT
      COUNT(*)::int as total_attempts,
      COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END)::int as completed_attempts,
      COUNT(DISTINCT student_id)::int as unique_students,
      COALESCE(AVG(score), 0)::float as average_score
    FROM quiz_attempts
    WHERE quiz_id = ${assessmentId}
  `) as unknown as Array<{
    total_attempts: number
    completed_attempts: number
    unique_students: number
    average_score: number
  }>
  const attemptStats = attemptStatsRows[0] ?? {
    total_attempts: 0,
    completed_attempts: 0,
    unique_students: 0,
    average_score: 0,
  }

  let questionPerf = (await sql`
    SELECT
      qq.id,
      COALESCE(NULLIF(TRIM(qq.question_text), ''), qb.question_text, 'Question') as question_text,
      COALESCE(qq.topic, qb.topic) as topic,
      COUNT(qa.id)::int as total_attempts,
      ROUND(
        COUNT(CASE WHEN qa.is_correct = true THEN 1 END) * 100.0 / NULLIF(COUNT(qa.id), 0),
        1
      )::float as accuracy_percentage
    FROM quiz_questions qq
    LEFT JOIN question_bank qb ON qb.id = qq.bank_question_id
    LEFT JOIN quiz_answers qa ON qa.question_id = qq.id
    WHERE qq.quiz_id = ${assessmentId}
    GROUP BY qq.id, qq.question_text, qb.question_text, qq.topic, qb.topic
    HAVING COUNT(qa.id) > 0
    ORDER BY accuracy_percentage ASC NULLS LAST
    LIMIT 12
  `.catch(async () => [])) as unknown as Array<{
    id: number
    question_text: string
    topic: string | null
    total_attempts: number
    accuracy_percentage: number | null
  }>

  if (!questionPerf.length) {
    questionPerf = (await sql`
      SELECT
        qq.id,
        COALESCE(NULLIF(TRIM(qq.question_text), ''), 'Question') as question_text,
        qq.topic,
        COUNT(qa.id)::int as total_attempts,
        ROUND(
          COUNT(CASE WHEN qa.is_correct = true THEN 1 END) * 100.0 / NULLIF(COUNT(qa.id), 0),
          1
        )::float as accuracy_percentage
      FROM quiz_questions qq
      LEFT JOIN quiz_answers qa ON qa.question_id = qq.id
      WHERE qq.quiz_id = ${assessmentId}
      GROUP BY qq.id, qq.question_text, qq.topic
      HAVING COUNT(qa.id) > 0
      ORDER BY accuracy_percentage ASC NULLS LAST
      LIMIT 12
    `.catch(async () => [])) as unknown as typeof questionPerf
  }

  const weakQuestions: WeakQuestionInsight[] = questionPerf
    .filter((q) => (q.accuracy_percentage ?? 100) < 70)
    .slice(0, 8)
    .map((q) => ({
      questionId: Number(q.id),
      stem: String(q.question_text ?? "Question").slice(0, 160),
      topic: q.topic,
      accuracyPct: Number(q.accuracy_percentage ?? 0),
      attempts: Number(q.total_attempts ?? 0),
    }))

  const topicMap = new Map<string, { sum: number; n: number; attempts: number }>()
  for (const q of questionPerf) {
    const topic = String(q.topic ?? "").trim() || "Untagged"
    const cur = topicMap.get(topic) ?? { sum: 0, n: 0, attempts: 0 }
    cur.sum += Number(q.accuracy_percentage ?? 0)
    cur.n += 1
    cur.attempts += Number(q.total_attempts ?? 0)
    topicMap.set(topic, cur)
  }
  const weakTopics = [...topicMap.entries()]
    .map(([topic, v]) => ({
      topic,
      accuracyPct: Math.round((v.sum / Math.max(v.n, 1)) * 10) / 10,
      attempts: v.attempts,
    }))
    .filter((t) => t.accuracyPct < 70)
    .sort((a, b) => a.accuracyPct - b.accuracyPct)
    .slice(0, 6)

  const avg = Math.round(Number(attemptStats.average_score ?? 0) * 10) / 10
  const lines = [
    `## ${assessment.title} analysis`,
    "",
    `Average score: **${avg}%**`,
    `Completed attempts: **${attemptStats.completed_attempts}** · Unique students: **${attemptStats.unique_students}**`,
    `Type: ${assessment.assessment_type || "quiz"}`,
    "",
  ]

  if (weakQuestions.length) {
    lines.push("### Weakest questions")
    for (const q of weakQuestions.slice(0, 5)) {
      lines.push(
        `- Q${q.questionId}${q.topic ? ` (${q.topic})` : ""}: **${q.accuracyPct}%** accuracy · ${q.stem}`,
      )
    }
    lines.push("")
  }

  if (weakTopics.length) {
    lines.push("### Weak topics")
    for (const t of weakTopics) {
      lines.push(`- **${t.topic}**: ${t.accuracyPct}% accuracy`)
    }
    lines.push("")
  }

  if (weakTopics.length || weakQuestions.length) {
    lines.push("### Suggested next actions")
    lines.push("- Create remediation practice / quiz from weak topics (propose_assessment_from_bank)")
    lines.push("- Add Question Bank coverage for gaps (propose_question_bank_create)")
    lines.push("- Message affected students after confirmation (propose_message_send)")
  } else if (attemptStats.completed_attempts === 0) {
    lines.push("No completed attempts yet — nothing to remediate.")
  } else {
    lines.push("No major weak spots detected (all scored questions ≥ 70% accuracy).")
  }

  return {
    assessmentId,
    title: String(assessment.title),
    assessmentType: assessment.assessment_type,
    averageScore: avg,
    completedAttempts: Number(attemptStats.completed_attempts ?? 0),
    uniqueStudents: Number(attemptStats.unique_students ?? 0),
    weakQuestions,
    weakTopics,
    summaryText: lines.join("\n"),
  }
}
