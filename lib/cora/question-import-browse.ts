import "server-only"

import { sql } from "@/lib/db"
import {
  getAssessmentImportAccess,
  getBankQuestionImportAccess,
} from "@/lib/cora/assessment-import-gate"
import { parseLectureWorkspace } from "@/lib/lecture-workspace"
import { resolveStudentCourseContextByDbId, sqlQuizInStudentCourse } from "@/lib/student-course-scope"
import type {
  CoraImportableItem,
  ImportContainerOption,
  ImportSourceKey,
  ImportSourceOption,
} from "@/lib/cora/question-import-types"
import { IMPORT_SOURCE_META, importRef, previewText } from "@/lib/cora/question-import-types"

export type { ImportContainerOption, ImportSourceKey, ImportSourceOption } from "@/lib/cora/question-import-types"
export { IMPORT_SOURCE_META } from "@/lib/cora/question-import-types"

function isAssessmentSource(key: ImportSourceKey): boolean {
  return ["quizzes", "homework", "mid_semester", "final_exam"].includes(key)
}

export async function listImportSources(studentDatabaseId: number): Promise<ImportSourceOption[]> {
  const sources: ImportSourceOption[] = []

  for (const [key, meta] of Object.entries(IMPORT_SOURCE_META) as [ImportSourceKey, (typeof IMPORT_SOURCE_META)[ImportSourceKey]][]) {
    let count = 0
    try {
      if (isAssessmentSource(key) && meta.assessmentTypes) {
        const ctx = await resolveStudentCourseContextByDbId(studentDatabaseId)
        if (ctx) {
          const types = meta.assessmentTypes.map((t) => t.toLowerCase())
          const rows = (await sql`
            SELECT COUNT(DISTINCT q.id)::int AS c
            FROM quizzes q
            WHERE LOWER(COALESCE(q.assessment_type, 'quiz')) = ANY(${types})
              AND ${sqlQuizInStudentCourse("q", ctx.courseId)}
          `) as { c: number }[]
          count = rows[0]?.c ?? 0
        }
      } else if (key === "practice_hub") {
        const rows = (await sql`
          SELECT COUNT(DISTINCT qb.topic)::int AS c
          FROM question_bank qb
          WHERE qb.deleted_at IS NULL AND COALESCE(TRIM(qb.topic), '') <> ''
        `) as { c: number }[]
        count = rows[0]?.c ?? 0
      } else if (key === "lecture_workspace") {
        const rows = (await sql`
          SELECT COUNT(*)::int AS c FROM lectures WHERE lecture_workspace IS NOT NULL
        `) as { c: number }[]
        count = rows[0]?.c ?? 0
      } else if (key === "classroom_points") {
        const rows = (await sql`
          SELECT COUNT(*)::int AS c FROM classroom_point_submissions
          WHERE is_active = true OR is_active IS NULL
        `) as { c: number }[]
        count = rows[0]?.c ?? 0
      }
    } catch {
      count = 0
    }
    sources.push({ key, label: meta.label, description: meta.description, count })
  }

  return sources
}

export async function listImportContainers(
  studentDatabaseId: number,
  sourceKey: ImportSourceKey,
  options?: { purpose?: "cora" | "messages" },
): Promise<ImportContainerOption[]> {
  const meta = IMPORT_SOURCE_META[sourceKey]
  const forMessages = options?.purpose === "messages"

  if (isAssessmentSource(sourceKey) && meta.assessmentTypes) {
    const ctx = await resolveStudentCourseContextByDbId(studentDatabaseId)
    if (!ctx) return []
    const types = meta.assessmentTypes.map((t) => t.toLowerCase())
    const rows = (await sql`
      SELECT q.id, q.title,
        (SELECT COUNT(*)::int FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS question_count
      FROM quizzes q
      WHERE LOWER(COALESCE(q.assessment_type, 'quiz')) = ANY(${types})
        AND ${sqlQuizInStudentCourse("q", ctx.courseId)}
      ORDER BY q.title ASC
    `) as { id: number; title: string; question_count: number }[]

    const unlocked = rows.filter((r) => r.question_count > 0)
    const containers: ImportContainerOption[] = []
    for (const r of unlocked) {
      const access = forMessages
        ? { allowed: true, status: "completed" as const, message: null }
        : await getAssessmentImportAccess(studentDatabaseId, r.id)
      const questionLabel = `${r.question_count} question${r.question_count === 1 ? "" : "s"}`
      containers.push({
        id: String(r.id),
        label: r.title,
        subtitle: access.allowed
          ? questionLabel
          : access.status === "in_progress"
            ? "In progress — submit before Cora can help"
            : "Locked — attempt this assessment first",
        count: r.question_count,
        locked: !access.allowed,
        lockReason: access.message,
        accessStatus: access.status,
      })
    }
    return containers
  }

  if (sourceKey === "practice_hub") {
    const rows = (await sql`
      SELECT qb.topic, COUNT(*)::int AS question_count
      FROM question_bank qb
      WHERE qb.deleted_at IS NULL AND COALESCE(TRIM(qb.topic), '') <> ''
      GROUP BY qb.topic
      ORDER BY qb.topic ASC
    `) as { topic: string; question_count: number }[]

    return rows.map((r) => ({
      id: encodeURIComponent(r.topic),
      label: r.topic,
      subtitle: `${r.question_count} question${r.question_count === 1 ? "" : "s"}`,
      count: r.question_count,
    }))
  }

  if (sourceKey === "lecture_workspace") {
    const rows = (await sql`
      SELECT id, title, lecture_workspace FROM lectures
      WHERE lecture_workspace IS NOT NULL
      ORDER BY week ASC NULLS LAST, id ASC
    `) as { id: number; title: string; lecture_workspace: unknown }[]

    return rows
      .map((lec) => {
        const ws = parseLectureWorkspace(lec.lecture_workspace)
        const count = ws.questions.filter((q) => q.id !== "scratch").length
        return { lec, count }
      })
      .filter(({ count }) => count > 0)
      .map(({ lec, count }) => ({
        id: String(lec.id),
        label: lec.title,
        subtitle: `${count} problem${count === 1 ? "" : "s"}`,
        count,
      }))
  }

  if (sourceKey === "classroom_points") {
    const rows = (await sql`
      SELECT id, title, description
      FROM classroom_point_submissions
      WHERE is_active = true OR is_active IS NULL
      ORDER BY due_at DESC NULLS LAST, title ASC
    `) as { id: number; title: string; description: string | null }[]

    return rows.map((r) => ({
      id: String(r.id),
      label: r.title,
      subtitle: previewText(r.description || "Assignment", 60),
    }))
  }

  return []
}

export async function listImportQuestionsInContainer(
  studentDatabaseId: number,
  sourceKey: ImportSourceKey,
  containerId: string,
  options?: { purpose?: "cora" | "messages" },
): Promise<CoraImportableItem[]> {
  const forMessages = options?.purpose === "messages"

  if (isAssessmentSource(sourceKey)) {
    const quizId = Number(containerId)
    if (!Number.isFinite(quizId)) return []

    if (!forMessages) {
      const access = await getAssessmentImportAccess(studentDatabaseId, quizId)
      if (!access.allowed) {
        // Do not leak question text for locked assessments (Cora tutoring).
        return []
      }
    }

    const rows = (await sql`
      SELECT qq.id, qq.question_text, qq.bank_question_id, qq.question_order
      FROM quiz_questions qq
      WHERE qq.quiz_id = ${quizId}
      ORDER BY COALESCE(qq.question_order, qq.id) ASC, qq.id ASC
    `) as {
      id: number
      question_text: string
      bank_question_id: number | null
      question_order: number | null
    }[]

    return rows.map((row, idx) => ({
      ref: importRef({
        source: "quiz",
        questionId: row.id,
        quizId,
        bankQuestionId: row.bank_question_id ?? undefined,
      }),
      source: "quiz" as const,
      group: IMPORT_SOURCE_META[sourceKey].label,
      label: `Question ${idx + 1}`,
      preview: previewText(row.question_text),
      questionId: row.id,
      quizId,
      bankQuestionId: row.bank_question_id ?? undefined,
    }))
  }

  if (sourceKey === "practice_hub") {
    const topic = decodeURIComponent(containerId)
    const rows = (await sql`
      SELECT id, question_text
      FROM question_bank
      WHERE deleted_at IS NULL AND topic = ${topic}
      ORDER BY id ASC
      LIMIT 80
    `) as { id: number; question_text: string }[]

    const items: CoraImportableItem[] = []
    for (const row of rows) {
      if (!forMessages) {
        const access = await getBankQuestionImportAccess(studentDatabaseId, row.id)
        if (!access.allowed) continue
      }
      items.push({
        ref: importRef({ source: "practice_hub", bankQuestionId: row.id }),
        source: "practice_hub" as const,
        group: topic,
        label: `Question ${items.length + 1}`,
        preview: previewText(row.question_text),
        bankQuestionId: row.id,
      })
    }
    return items
  }

  if (sourceKey === "lecture_workspace") {
    const lectureId = Number(containerId)
    if (!Number.isFinite(lectureId)) return []

    const lecRows = (await sql`
      SELECT title, lecture_workspace FROM lectures WHERE id = ${lectureId} LIMIT 1
    `) as { title: string; lecture_workspace: unknown }[]
    if (!lecRows.length) return []

    const ws = parseLectureWorkspace(lecRows[0].lecture_workspace)
    return ws.questions
      .filter((q) => q.id !== "scratch")
      .map((q) => ({
        ref: importRef({ source: "lecture_workspace", lectureId, questionId: q.id }),
        source: "lecture_workspace" as const,
        group: lecRows[0].title,
        label: q.title,
        preview: previewText(q.question_text),
        lectureId,
        questionId: q.id,
      }))
  }

  if (sourceKey === "classroom_points") {
    const submissionId = Number(containerId)
    if (!Number.isFinite(submissionId)) return []

    const rows = (await sql`
      SELECT title, description, question_config
      FROM classroom_point_submissions WHERE id = ${submissionId} LIMIT 1
    `) as { title: string; description: string | null; question_config: unknown }[]
    if (!rows.length) return []

    const row = rows[0]
    const cfg = row.question_config as { question_text?: string; prompt?: string } | null
    const text = cfg?.question_text || cfg?.prompt || row.description || row.title

    return [
      {
        ref: importRef({ source: "classroom_points", classroomSubmissionId: submissionId }),
        source: "classroom_points" as const,
        group: "Classroom Points",
        label: row.title,
        preview: previewText(String(text)),
        classroomSubmissionId: submissionId,
      },
    ]
  }

  return []
}
