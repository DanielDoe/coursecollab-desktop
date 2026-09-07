import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorQuestionBankScope } from "@/lib/instructor-question-bank-scope"
import { sanitizeAiGeneratedQuestionBankSql } from "@/lib/question-bank-ai-sql-sanitize"
import {
  injectCourseIdIntoQuestionBankSql,
  validateQuestionBankInsertSql,
} from "@/lib/question-bank-sql-executor"
import { sqlRows } from "@/lib/sql-rows"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorQuestionBankScope(request)
    if (!scope.ok) return scope.response

    const { sql: sqlText } = await request.json()
    if (!sqlText || typeof sqlText !== "string") {
      return NextResponse.json({ error: "sql is required" }, { status: 400 })
    }

    const validated = validateQuestionBankInsertSql(sanitizeAiGeneratedQuestionBankSql(sqlText))
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    const executable = injectCourseIdIntoQuestionBankSql(validated.sql, scope.course.id)
    const result = await sql`${sql.unsafe(executable)}`
    const rows = sqlRows<{ id: number }>(result)
    const questionId = rows[0]?.id != null ? Number(rows[0].id) : null
    if (!Number.isFinite(questionId)) {
      return NextResponse.json({ error: "INSERT did not return a question id" }, { status: 500 })
    }

    const owned = await sql`
      SELECT id FROM question_bank
      WHERE id = ${questionId}
        AND course_id = ${scope.course.id}
        AND deleted_at IS NULL
      LIMIT 1
    `
    if (owned.length === 0) {
      return NextResponse.json(
        { error: "Question was created but is not in the selected course scope" },
        { status: 403 },
      )
    }

    return NextResponse.json({ success: true, questionId })
  } catch (error) {
    console.error("[question-bank execute-sql]", error)
    const message = error instanceof Error ? error.message : "Failed to execute SQL"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
