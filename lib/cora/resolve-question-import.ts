import "server-only"

import { sql } from "@/lib/db"
import { attachMediaToProblem } from "@/lib/cora/attach-question-media"
import { assertAssessmentImportAllowed, assertBankQuestionImportAllowed, sanitizeProblemForClient, sanitizeProblemForDiscussion } from "@/lib/cora/assessment-import-gate"
import { coraContextFromQuestion } from "@/lib/cora/question-context"
import { enrichCoraContextFromBank, enrichCoraContextFromQuizQuestion } from "@/lib/cora/load-bank-context"
import { parseLectureWorkspace } from "@/lib/lecture-workspace"
import { inferCoraDomain } from "@/lib/cora/infer-domain"
import type { CoraImportableItem, CoraQuestionImportResolveInput } from "@/lib/cora/question-import-types"
import { importRef, previewText } from "@/lib/cora/question-import-types"
import type { CoraProblemContext } from "@/lib/cora/types"

function assessmentGroup(type: string | null | undefined): string {
  const t = (type ?? "quiz").toLowerCase()
  if (t === "homework") return "Homework"
  if (t === "mid_semester" || t === "midsem") return "Mid-Semester"
  if (t === "final" || t === "finals") return "Final Exam"
  return "Quizzes"
}

export async function listImportableQuestions(studentDatabaseId: number): Promise<CoraImportableItem[]> {
  const items: CoraImportableItem[] = []

  try {
    const assessmentRows = (await sql`
      SELECT DISTINCT ON (qq.id, q.id)
        qq.id AS question_id,
        qq.quiz_id,
        qq.question_text,
        qq.bank_question_id,
        q.title AS quiz_title,
        q.assessment_type,
        qa.updated_at
      FROM quiz_attempts qa
      JOIN quizzes q ON q.id = qa.quiz_id
      JOIN quiz_questions qq ON qq.quiz_id = q.id
      WHERE qa.student_id = ${studentDatabaseId}
        AND qa.completed_at IS NOT NULL
        AND qa.deleted_at IS NULL
      ORDER BY qq.id, q.id, qa.updated_at DESC NULLS LAST
      LIMIT 40
    `) as {
      question_id: number
      quiz_id: number
      question_text: string
      bank_question_id: number | null
      quiz_title: string
      assessment_type: string | null
    }[]

    for (const row of assessmentRows) {
      const group = assessmentGroup(row.assessment_type)
      items.push({
        ref: importRef({
          source: "quiz",
          questionId: row.question_id,
          quizId: row.quiz_id,
          bankQuestionId: row.bank_question_id ?? undefined,
        }),
        source: "quiz",
        group,
        label: `${row.quiz_title} · Q${row.question_id}`,
        preview: previewText(row.question_text),
        questionId: row.question_id,
        quizId: row.quiz_id,
        bankQuestionId: row.bank_question_id ?? undefined,
      })
    }
  } catch (e) {
    console.warn("[cora/question-import] assessments list skipped:", e)
  }

  try {
    const practiceRows = (await sql`
      SELECT DISTINCT ON (pa.bank_question_id)
        pa.bank_question_id,
        qb.question_text,
        qb.topic,
        pat.completed_at
      FROM practice_attempts pat
      JOIN practice_answers pa ON pa.attempt_id = pat.id
      JOIN question_bank qb ON qb.id = pa.bank_question_id
      WHERE pat.student_id = ${studentDatabaseId}
      ORDER BY pa.bank_question_id, pat.completed_at DESC NULLS LAST
      LIMIT 25
    `) as { bank_question_id: number; question_text: string; topic: string | null }[]

    for (const row of practiceRows) {
      items.push({
        ref: importRef({ source: "practice_hub", bankQuestionId: row.bank_question_id }),
        source: "practice_hub",
        group: "Practice Hub",
        label: row.topic?.trim() || `Practice #${row.bank_question_id}`,
        preview: previewText(row.question_text),
        bankQuestionId: row.bank_question_id,
      })
    }
  } catch (e) {
    console.warn("[cora/question-import] practice list skipped:", e)
  }

  try {
    const lectureRows = (await sql`
      SELECT id, title, lecture_workspace
      FROM lectures
      WHERE lecture_workspace IS NOT NULL
      ORDER BY week ASC NULLS LAST, id ASC
      LIMIT 20
    `) as { id: number; title: string; lecture_workspace: unknown }[]

    for (const lec of lectureRows) {
      const ws = parseLectureWorkspace(lec.lecture_workspace)
      if (!ws.enabled || !ws.questions.length) continue
      for (const q of ws.questions) {
        if (q.id === "scratch") continue
        items.push({
          ref: importRef({ source: "lecture_workspace", lectureId: lec.id, questionId: q.id }),
          source: "lecture_workspace",
          group: "Lecture workspace",
          label: `${lec.title} · ${q.title}`,
          preview: previewText(q.question_text),
          lectureId: lec.id,
          questionId: q.id,
        })
      }
    }
  } catch (e) {
    console.warn("[cora/question-import] lectures list skipped:", e)
  }

  try {
    const classroomRows = (await sql`
      SELECT id, title, description, question_config, submission_kind
      FROM classroom_point_submissions
      WHERE is_active = true OR is_active IS NULL
      ORDER BY due_at DESC NULLS LAST, id DESC
      LIMIT 25
    `) as {
      id: number
      title: string
      description: string | null
      question_config: unknown
      submission_kind: string | null
    }[]

    for (const row of classroomRows) {
      const cfg = row.question_config as { question_text?: string; prompt?: string } | null
      const text = cfg?.question_text || cfg?.prompt || row.description || row.title
      items.push({
        ref: importRef({ source: "classroom_points", classroomSubmissionId: row.id }),
        source: "classroom_points",
        group: "Classroom Points",
        label: row.title,
        preview: previewText(String(text)),
        classroomSubmissionId: row.id,
      })
    }
  } catch (e) {
    console.warn("[cora/question-import] classroom list skipped:", e)
  }

  return items
}

export async function resolveImportedQuestion(
  input: CoraQuestionImportResolveInput,
): Promise<CoraProblemContext> {
  let problem: CoraProblemContext
  const forMessages = input.purpose === "messages"

  switch (input.source) {
    case "quiz": {
      if (!input.questionId || !input.quizId) throw new Error("quiz question requires questionId and quizId")
      if (!forMessages) {
        await assertAssessmentImportAllowed(input.studentDatabaseId, Number(input.quizId))
      }
      const rows = (await sql`
        SELECT qq.question_text, qq.question_type, qq.expected_answer, qq.hint, qq.explanation,
               qq.bank_question_id, qq.question_media,
               qb.question_media AS bank_question_media,
               q.title AS quiz_title, q.assessment_type
        FROM quiz_questions qq
        JOIN quizzes q ON q.id = qq.quiz_id
        LEFT JOIN question_bank qb ON qb.id = qq.bank_question_id AND qb.deleted_at IS NULL
        WHERE qq.id = ${Number(input.questionId)} AND qq.quiz_id = ${Number(input.quizId)}
        LIMIT 1
      `) as {
        question_text: string
        question_type: string
        expected_answer: string | null
        hint: string | null
        explanation: string | null
        bank_question_id: number | null
        question_media: unknown
        bank_question_media: unknown
        quiz_title: string
        assessment_type: string | null
      }[]
      if (!rows.length) throw new Error("Assessment question not found")
      const row = rows[0]
      problem = coraContextFromQuestion({
        source: "quiz",
        title: `${assessmentGroup(row.assessment_type)} · ${row.quiz_title}`,
        questionText: row.question_text,
        questionType: row.question_type,
        expectedAnswer: row.expected_answer,
        hint: row.hint,
        explanation: row.explanation,
        questionId: input.questionId,
        quizId: input.quizId,
        bankQuestionId: row.bank_question_id ?? input.bankQuestionId,
        studentDatabaseId: input.studentDatabaseId ?? null,
      })
      problem = attachMediaToProblem(problem, {
        question_media: row.question_media,
        bank_question_media: row.bank_question_media,
      })
      break
    }

    case "practice_hub": {
      const bankId = input.bankQuestionId
      if (!bankId) throw new Error("practice_hub requires bankQuestionId")
      if (!forMessages) {
        await assertBankQuestionImportAllowed(input.studentDatabaseId, Number(bankId))
      }
      const rows = (await sql`
        SELECT question_text, question_type, expected_answer, hint, explanation, topic,
               question_media
        FROM question_bank
        WHERE id = ${bankId} AND deleted_at IS NULL
        LIMIT 1
      `) as {
        question_text: string
        question_type: string
        expected_answer: string | null
        hint: string | null
        explanation: string | null
        topic: string | null
        question_media: unknown
      }[]
      if (!rows.length) throw new Error("Practice question not found")
      const row = rows[0]
      problem = coraContextFromQuestion({
        source: "practice_hub",
        title: row.topic || "Practice Hub",
        questionText: row.question_text,
        questionType: row.question_type,
        expectedAnswer: row.expected_answer,
        hint: row.hint,
        explanation: row.explanation,
        bankQuestionId: bankId,
        topic: row.topic,
        studentDatabaseId: input.studentDatabaseId ?? null,
      })
      problem = attachMediaToProblem(problem, {
        question_media: row.question_media,
      })
      break
    }

    case "lecture_workspace": {
      if (!input.lectureId || input.questionId == null) {
        throw new Error("lecture_workspace requires lectureId and questionId")
      }
      const rows = (await sql`
        SELECT title, lecture_workspace FROM lectures WHERE id = ${Number(input.lectureId)} LIMIT 1
      `) as { title: string; lecture_workspace: unknown }[]
      if (!rows.length) throw new Error("Lecture not found")
      const ws = parseLectureWorkspace(rows[0].lecture_workspace)
      const q = ws.questions.find((x) => x.id === String(input.questionId))
      if (!q) throw new Error("Workspace question not found")
      problem = coraContextFromQuestion({
        source: "lecture_workspace",
        domain: "circuit",
        title: `${rows[0].title} · ${q.title}`,
        topic: q.topic,
        questionText: q.question_text,
        questionType: "circuit_submission",
        referenceSteps: q.step_by_step_solution.content,
        mediaUrl: q.question_media?.media_url ?? null,
        lectureId: input.lectureId,
        questionId: q.id,
        studentDatabaseId: input.studentDatabaseId ?? null,
      })
      problem = attachMediaToProblem(problem, { question_media: q.question_media })
      break
    }

    case "classroom_points": {
      if (!input.classroomSubmissionId) throw new Error("classroom_points requires classroomSubmissionId")
      const rows = (await sql`
        SELECT title, description, question_config, submission_kind
        FROM classroom_point_submissions
        WHERE id = ${input.classroomSubmissionId}
        LIMIT 1
      `) as {
        title: string
        description: string | null
        question_config: unknown
        submission_kind: string | null
      }[]
      if (!rows.length) throw new Error("Classroom assignment not found")
      const row = rows[0]
      const cfg = row.question_config as { question_text?: string; prompt?: string; expected_answer?: string } | null
      const text = cfg?.question_text || cfg?.prompt || row.description || row.title
      problem = coraContextFromQuestion({
        source: "classroom_points",
        domain: row.submission_kind === "circuit" ? "circuit" : "coding",
        title: row.title,
        questionText: String(text),
        questionType: row.submission_kind ?? "code",
        expectedAnswer: cfg?.expected_answer ?? null,
        questionId: input.classroomSubmissionId,
        studentDatabaseId: input.studentDatabaseId ?? null,
      })
      break
    }

    default:
      throw new Error(`Unsupported import source: ${input.source}`)
  }

  problem = { ...problem, domain: inferCoraDomain(problem) }
  problem = await enrichCoraContextFromQuizQuestion(problem)
  problem = await enrichCoraContextFromBank(problem)
  // Never ship answer keys to the browser — server re-enriches after unlock when needed.
  // Messages discussion also drops tutoring hints.
  return forMessages ? sanitizeProblemForDiscussion(problem) : sanitizeProblemForClient(problem)
}
