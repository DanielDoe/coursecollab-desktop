import "server-only"

import { sql } from "@/lib/db"
import { attachMediaToProblem } from "@/lib/cora/attach-question-media"
import { coraContextFromQuestion } from "@/lib/cora/question-context"
import type { CoraImportableItem } from "@/lib/cora/question-import-types"
import { importRef, previewText } from "@/lib/cora/question-import-types"
import type { CoraProblemContext, CoraProblemSource } from "@/lib/cora/types"
import {
  buildInstructorOwnedCourseScopeSqlFragment,
} from "@/lib/instructor-default-courses"
import type {
  FacultyImportContainerOption,
  FacultyImportSourceKey,
  FacultyImportSourceOption,
} from "@/lib/cora/faculty-question-import-types"

export type {
  FacultyImportContainerOption,
  FacultyImportSourceKey,
  FacultyImportSourceOption,
} from "@/lib/cora/faculty-question-import-types"

const ASSESSMENT_TYPES: Record<Exclude<FacultyImportSourceKey, "question_bank">, string[]> = {
  quizzes: ["quiz"],
  homework: ["homework"],
  mid_semester: ["mid_semester", "midsem"],
  final: ["final", "finals"],
}

function assessmentLabel(key: FacultyImportSourceKey): string {
  if (key === "question_bank") return "Question Bank"
  if (key === "homework") return "Homework"
  if (key === "mid_semester") return "Mid-Semester Exams"
  if (key === "final") return "Final Exams"
  return "Quizzes"
}

export async function listFacultyImportSources(input: {
  courseId: number
  instructorId: number
}): Promise<FacultyImportSourceOption[]> {
  const qbScope = buildInstructorOwnedCourseScopeSqlFragment(
    "question_bank",
    "course_id",
    input.courseId,
    input.instructorId,
  )

  const [topicRowsRaw, quizRowsRaw] = await Promise.all([
    sql`
      SELECT COUNT(DISTINCT topic)::int AS count
      FROM question_bank
      WHERE deleted_at IS NULL
        AND topic IS NOT NULL AND topic != ''
        AND (${qbScope})
    `.catch(() => [{ count: 0 }]),
    sql`
      SELECT assessment_type, COUNT(*)::int AS count
      FROM quizzes
      WHERE course_id = ${input.courseId}
        AND deleted_at IS NULL
      GROUP BY assessment_type
    `.catch(() => []),
  ])

  const topicRows = topicRowsRaw as Array<{ count?: number }>
  const quizRows = quizRowsRaw as Array<{ assessment_type: string | null; count: number }>
  const topicCount = Number(topicRows[0]?.count ?? 0)
  const byType = new Map<string, number>()
  for (const row of quizRows) {
    byType.set(String(row.assessment_type ?? "quiz").toLowerCase(), Number(row.count ?? 0))
  }

  const countFor = (key: Exclude<FacultyImportSourceKey, "question_bank">) =>
    ASSESSMENT_TYPES[key].reduce((sum, type) => sum + (byType.get(type) ?? 0), 0)

  const sources: FacultyImportSourceOption[] = [
    {
      key: "question_bank",
      label: "Question Bank",
      description: "Topics and standalone bank items",
      count: topicCount,
    },
    {
      key: "quizzes",
      label: "Quizzes",
      description: "Quiz assessments in this course",
      count: countFor("quizzes"),
    },
    {
      key: "homework",
      label: "Homework",
      description: "Homework assessments",
      count: countFor("homework"),
    },
    {
      key: "mid_semester",
      label: "Mid-Semester Exams",
      description: "Mid-semester assessments",
      count: countFor("mid_semester"),
    },
    {
      key: "final",
      label: "Final Exams",
      description: "Final assessments",
      count: countFor("final"),
    },
  ]

  return sources.filter((source) => source.count > 0)
}

export async function listFacultyImportContainers(
  input: { courseId: number; instructorId: number },
  sourceKey: FacultyImportSourceKey,
): Promise<FacultyImportContainerOption[]> {
  if (sourceKey === "question_bank") {
    const qbScope = buildInstructorOwnedCourseScopeSqlFragment(
      "question_bank",
      "course_id",
      input.courseId,
      input.instructorId,
    )
    const rows = await sql`
      SELECT topic AS name, COUNT(*)::int AS question_count
      FROM question_bank
      WHERE deleted_at IS NULL
        AND topic IS NOT NULL AND topic != ''
        AND (${qbScope})
      GROUP BY topic
      ORDER BY topic
    `
    return (rows as Array<{ name: string; question_count: number }>).map((row) => ({
      id: row.name,
      label: row.name,
      subtitle: `${row.question_count} question${row.question_count === 1 ? "" : "s"}`,
      count: row.question_count,
    }))
  }

  const types = ASSESSMENT_TYPES[sourceKey]
  const rows = await sql`
    SELECT id, title, (
      SELECT COUNT(*)::int FROM quiz_questions qq WHERE qq.quiz_id = q.id
    ) AS question_count
    FROM quizzes q
    WHERE course_id = ${input.courseId}
      AND deleted_at IS NULL
      AND LOWER(COALESCE(assessment_type, 'quiz')) = ANY(${types})
    ORDER BY created_at DESC NULLS LAST, id DESC
  `
  return (rows as Array<{ id: number; title: string; question_count: number }>).map((row) => ({
    id: String(row.id),
    label: row.title,
    subtitle: `${row.question_count} question${row.question_count === 1 ? "" : "s"}`,
    count: row.question_count,
  }))
}

export async function listFacultyImportItems(
  input: { courseId: number; instructorId: number },
  sourceKey: FacultyImportSourceKey,
  containerId: string,
): Promise<CoraImportableItem[]> {
  if (sourceKey === "question_bank") {
    const qbScope = buildInstructorOwnedCourseScopeSqlFragment(
      "question_bank",
      "course_id",
      input.courseId,
      input.instructorId,
    )
    const rows = await sql`
      SELECT id, question_text, topic
      FROM question_bank
      WHERE deleted_at IS NULL
        AND topic = ${containerId}
        AND (${qbScope})
      ORDER BY id DESC
      LIMIT 200
    `
    return (rows as Array<{ id: number; question_text: string; topic: string | null }>).map((row) => ({
      ref: importRef({ source: "question_bank", bankQuestionId: row.id }),
      source: "question_bank" as CoraProblemSource,
      group: containerId,
      label: `Q${row.id}${row.topic ? ` · ${row.topic}` : ""}`,
      preview: previewText(row.question_text),
      bankQuestionId: row.id,
      questionId: row.id,
    }))
  }

  const quizId = Number(containerId)
  if (!Number.isFinite(quizId)) return []

  const rows = await sql`
    SELECT qq.id, qq.question_text, qq.bank_question_id, qq.question_order, q.title
    FROM quiz_questions qq
    JOIN quizzes q ON q.id = qq.quiz_id
    WHERE qq.quiz_id = ${quizId}
      AND q.course_id = ${input.courseId}
      AND q.deleted_at IS NULL
    ORDER BY qq.question_order ASC NULLS LAST, qq.id ASC
  `

  return (
    rows as Array<{
      id: number
      question_text: string
      bank_question_id: number | null
      question_order: number | null
      title: string
    }>
  ).map((row, index) => ({
    ref: importRef({
      source: "quiz",
      questionId: row.id,
      quizId,
      bankQuestionId: row.bank_question_id ?? undefined,
    }),
    source: "quiz" as CoraProblemSource,
    group: row.title,
    label: `Q${index + 1}${row.question_order != null ? ` (#${row.question_order})` : ""}`,
    preview: previewText(row.question_text),
    questionId: row.id,
    quizId,
    bankQuestionId: row.bank_question_id ?? undefined,
  }))
}

export async function resolveFacultyImportedQuestion(input: {
  courseId: number
  instructorId: number
  source: CoraProblemSource | string
  questionId?: number | string
  quizId?: number
  bankQuestionId?: number
}): Promise<CoraProblemContext> {
  if (input.source === "question_bank" || (input.bankQuestionId != null && input.quizId == null)) {
    const bankId = Number(input.bankQuestionId ?? input.questionId)
    if (!Number.isFinite(bankId)) throw new Error("bankQuestionId required")
    const qbScope = buildInstructorOwnedCourseScopeSqlFragment(
      "question_bank",
      "course_id",
      input.courseId,
      input.instructorId,
    )
    const rows = (await sql`
      SELECT id, question_text, question_type, expected_answer, sample_answer, hint, explanation, topic, question_media
      FROM question_bank
      WHERE id = ${bankId}
        AND deleted_at IS NULL
        AND (${qbScope})
      LIMIT 1
    `) as Array<{
      id: number
      question_text: string
      question_type: string
      expected_answer: string | null
      sample_answer: string | null
      hint: string | null
      explanation: string | null
      topic: string | null
      question_media: unknown
    }>
    if (!rows.length) throw new Error("Question bank item not found")
    const row = rows[0]
    let problem = coraContextFromQuestion({
      source: "question_bank",
      title: row.topic || `Question ${row.id}`,
      topic: row.topic,
      questionText: row.question_text,
      questionType: row.question_type,
      expectedAnswer: row.expected_answer ?? row.sample_answer,
      hint: row.hint,
      explanation: row.explanation,
      bankQuestionId: row.id,
      questionId: row.id,
    })
    problem = attachMediaToProblem(problem, { question_media: row.question_media })
    return problem
  }

  if (!input.questionId || !input.quizId) {
    throw new Error("quiz question requires questionId and quizId")
  }

  const rows = (await sql`
    SELECT qq.question_text, qq.question_type, qq.expected_answer, qq.correct_answer, qq.hint, qq.explanation,
           qq.bank_question_id, qq.question_media,
           qb.question_media AS bank_question_media,
           q.title AS quiz_title, q.assessment_type
    FROM quiz_questions qq
    JOIN quizzes q ON q.id = qq.quiz_id
    LEFT JOIN question_bank qb ON qb.id = qq.bank_question_id AND qb.deleted_at IS NULL
    WHERE qq.id = ${Number(input.questionId)}
      AND qq.quiz_id = ${Number(input.quizId)}
      AND q.course_id = ${input.courseId}
    LIMIT 1
  `) as Array<{
    question_text: string
    question_type: string
    expected_answer: string | null
    correct_answer: string | null
    hint: string | null
    explanation: string | null
    bank_question_id: number | null
    question_media: unknown
    bank_question_media: unknown
    quiz_title: string
    assessment_type: string | null
  }>
  if (!rows.length) throw new Error("Assessment question not found")
  const row = rows[0]

  let problem = coraContextFromQuestion({
    source: "quiz",
    title: `${assessmentLabel(
      row.assessment_type === "homework"
        ? "homework"
        : row.assessment_type === "mid_semester" || row.assessment_type === "midsem"
          ? "mid_semester"
          : row.assessment_type === "final" || row.assessment_type === "finals"
            ? "final"
            : "quizzes",
    )} · ${row.quiz_title}`,
    questionText: row.question_text,
    questionType: row.question_type,
    expectedAnswer: row.expected_answer ?? row.correct_answer,
    hint: row.hint,
    explanation: row.explanation,
    questionId: input.questionId,
    quizId: input.quizId,
    bankQuestionId: row.bank_question_id ?? input.bankQuestionId,
  })
  problem = attachMediaToProblem(problem, {
    question_media: row.question_media,
    bank_question_media: row.bank_question_media,
  })
  return problem
}
