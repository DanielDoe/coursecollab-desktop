import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { isLectureAccessibleToStudent } from "@/lib/student-lecture-access"
import {
  parseLectureWorkspace,
  stripLectureWorkspaceSolutions,
  LECTURE_WORKSPACE_FREEFORM_ID,
} from "@/lib/lecture-workspace"
import { requireStudentLectureCaller } from "@/lib/require-student-lecture-auth"
import { ensureLectureWorkspaceSchema } from "@/lib/ensure-lecture-workspace-schema"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const lectureId = Number.parseInt(id, 10)
    if (!Number.isFinite(lectureId)) {
      return NextResponse.json({ error: "Invalid lecture id" }, { status: 400 })
    }

    const auth = await requireStudentLectureCaller(
      request,
      request.nextUrl.searchParams.get("studentId"),
    )
    if (!auth.ok) return auth.response

    const allowed = await isLectureAccessibleToStudent(auth.sessionRow.student_id, lectureId)
    if (!allowed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await ensureLectureWorkspaceSchema()
    const studentDbId = auth.studentDbId

    const rows = await sql`
      SELECT lecture_workspace
      FROM lectures
      WHERE id = ${lectureId}
        AND deleted_at IS NULL
      LIMIT 1
    `
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const config = stripLectureWorkspaceSolutions(parseLectureWorkspace(rows[0].lecture_workspace))
    if (!config.enabled) {
      return NextResponse.json({ enabled: false, questions: [] })
    }

    const drafts: Array<{ question_id: string; student_answer: unknown; updated_at: string }> = []
    if (studentDbId != null) {
      try {
        const draftRows = await sql`
          SELECT question_id, student_answer, updated_at
          FROM lecture_workspace_drafts
          WHERE student_id = ${studentDbId}
            AND lecture_id = ${lectureId}
        `
        for (const row of draftRows as Array<{
          question_id: string
          student_answer: unknown
          updated_at: string
        }>) {
          drafts.push(row)
        }
      } catch (error: unknown) {
        const code = (error as { code?: string })?.code
        if (code !== "42P01" && code !== "42703") throw error
      }
    }

    return NextResponse.json({
      enabled: true,
      title: config.title,
      button_label: config.button_label,
      questions: config.questions,
      drafts,
    })
  } catch (error) {
    console.error("[Student lecture workspace GET]", error)
    return NextResponse.json({ error: "Failed to load workspace" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const lectureId = Number.parseInt(id, 10)
    if (!Number.isFinite(lectureId)) {
      return NextResponse.json({ error: "Invalid lecture id" }, { status: 400 })
    }

    const body = (await request.json()) as {
      studentId?: string
      questionId?: string
      studentAnswer?: unknown
    }
    const questionId = String(body.questionId ?? "").trim()
    const auth = await requireStudentLectureCaller(request, body.studentId ?? null)
    if (!auth.ok) return auth.response
    if (!questionId) {
      return NextResponse.json({ error: "studentId and questionId required" }, { status: 400 })
    }

    const allowed = await isLectureAccessibleToStudent(auth.sessionRow.student_id, lectureId)
    if (!allowed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await ensureLectureWorkspaceSchema()
    const studentDbId = auth.studentDbId

    const lectureRows = await sql`
      SELECT lecture_workspace FROM lectures
      WHERE id = ${lectureId} AND deleted_at IS NULL LIMIT 1
    `
    if (lectureRows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const config = parseLectureWorkspace(lectureRows[0].lecture_workspace)
    if (!config.enabled) {
      return NextResponse.json({ error: "Workspace not available" }, { status: 404 })
    }
    const allowedQuestionIds = new Set(config.questions.map((q) => q.id))
    if (config.questions.length === 0) {
      allowedQuestionIds.add(LECTURE_WORKSPACE_FREEFORM_ID)
    }
    if (!allowedQuestionIds.has(questionId)) {
      return NextResponse.json({ error: "Workspace question not found" }, { status: 404 })
    }

    const answerJson =
      typeof body.studentAnswer === "string"
        ? body.studentAnswer
        : JSON.stringify(body.studentAnswer ?? {})

    await sql`
      INSERT INTO lecture_workspace_drafts (student_id, lecture_id, question_id, student_answer, updated_at)
      VALUES (
        ${studentDbId},
        ${lectureId},
        ${questionId},
        ${answerJson}::jsonb,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (student_id, lecture_id, question_id)
      DO UPDATE SET
        student_answer = EXCLUDED.student_answer,
        updated_at = CURRENT_TIMESTAMP
    `

    return NextResponse.json({ message: "Draft saved" })
  } catch (error) {
    console.error("[Student lecture workspace PATCH]", error)
    return NextResponse.json({ error: "Failed to save draft" }, { status: 500 })
  }
}
