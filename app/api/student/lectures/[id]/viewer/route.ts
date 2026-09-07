import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireStudentLectureCaller } from "@/lib/require-student-lecture-auth"
import { isLectureAccessibleToStudent } from "@/lib/student-lecture-access"
import { redactStudentLectureRecord } from "@/lib/student-lecture-redact"
import { applySignedLectureDeckUrls, studentLectureDeckUrl } from "@/lib/lecture-deck-signed-url"
import {
  parseLectureSamplePractice,
  stripSamplePracticeAnswers,
} from "@/lib/lecture-sample-practice"
import {
  parseLectureWorkspace,
  stripLectureWorkspaceSolutions,
} from "@/lib/lecture-workspace"
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
      SELECT
        l.*,
        COALESCE(lsp.last_viewed_slide_order, 0) as current_slide,
        COALESCE(lsp.completed_slides, '[]'::jsonb) as completed_slides,
        0 as xp_earned,
        lsp.completed_at,
        lsp.last_accessed,
        COALESCE(lsp.status, 'not_started') as status,
        COALESCE(lsp.progress_percentage, 0) as progress_percentage,
        COALESCE(lsp.bookmarked_slides, '[]'::jsonb) as bookmarked_slides
      FROM lectures l
      LEFT JOIN lecture_student_progress lsp
        ON l.id = lsp.lecture_id AND lsp.student_id = ${studentDbId}
      WHERE l.id = ${lectureId}
        AND l.deleted_at IS NULL
      LIMIT 1
    `
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const lecture = applySignedLectureDeckUrls(
      redactStudentLectureRecord(rows[0] as Record<string, unknown>),
      { studentDbId, origin: request.nextUrl.origin },
    )

    const sampleConfig = parseLectureSamplePractice(rows[0].sample_practice)
    const samplePractice =
      !sampleConfig.enabled || sampleConfig.questions.length === 0
        ? { enabled: false, questions: [] as unknown[], button_label: sampleConfig.button_label }
        : {
            enabled: true,
            button_label: sampleConfig.button_label,
            questions: stripSamplePracticeAnswers(sampleConfig).questions,
          }

    const workspaceConfig = stripLectureWorkspaceSolutions(
      parseLectureWorkspace(rows[0].lecture_workspace),
    )
    const drafts: Array<{ question_id: string; student_answer: unknown; updated_at: string }> = []
    if (workspaceConfig.enabled) {
      try {
        const draftRows = await sql`
          SELECT question_id, student_answer, updated_at
          FROM lecture_workspace_drafts
          WHERE student_id = ${studentDbId} AND lecture_id = ${lectureId}
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

    const workspace = workspaceConfig.enabled
      ? {
          enabled: true,
          title: workspaceConfig.title,
          button_label: workspaceConfig.button_label,
          questions: workspaceConfig.questions,
          drafts,
        }
      : { enabled: false, questions: [] as unknown[] }

    return NextResponse.json({
      lecture,
      samplePractice,
      workspace,
      deckUrl: studentLectureDeckUrl({
        lectureId,
        studentDbId,
        origin: request.nextUrl.origin,
      }),
    })
  } catch (error) {
    console.error("[Student lecture viewer]", error)
    return NextResponse.json({ error: "Failed to load lecture" }, { status: 500 })
  }
}
