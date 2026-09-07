import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const rosterId = request.nextUrl.searchParams.get("studentId")?.trim()
    const lectureIdRaw = request.nextUrl.searchParams.get("lectureId")
    if (!rosterId) {
      return NextResponse.json({ error: "studentId required" }, { status: 400 })
    }

    const studentRows = await sql`
      SELECT id FROM students WHERE student_id = ${rosterId} LIMIT 1
    `
    if (!studentRows.length) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }
    const studentDbId = Number((studentRows[0] as { id: number }).id)

    const lectureId = lectureIdRaw ? Number.parseInt(lectureIdRaw, 10) : NaN
    const filterLecture = Number.isFinite(lectureId)

    const threadId = request.nextUrl.searchParams.get("threadId")?.trim()
    const filterThread = Boolean(threadId)

    const notes = filterLecture && filterThread
      ? await sql`
          SELECT
            ln.id,
            ln.lecture_id,
            ln.slide_number,
            ln.question,
            ln.ai_response,
            ln.screenshot_storage_key,
            ln.selected_text,
            ln.action_type,
            ln.thread_id,
            ln.created_at,
            l.title AS lecture_title,
            l.week AS lecture_week
          FROM lecture_notes ln
          JOIN lectures l ON l.id = ln.lecture_id
          WHERE ln.student_id = ${studentDbId}
            AND ln.lecture_id = ${lectureId}
            AND ln.thread_id = ${threadId}
          ORDER BY ln.created_at ASC
          LIMIT 100
        `
      : filterLecture
      ? await sql`
          SELECT
            ln.id,
            ln.lecture_id,
            ln.slide_number,
            ln.question,
            ln.ai_response,
            ln.screenshot_storage_key,
            ln.selected_text,
            ln.action_type,
            ln.created_at,
            l.title AS lecture_title,
            l.week AS lecture_week
          FROM lecture_notes ln
          JOIN lectures l ON l.id = ln.lecture_id
          WHERE ln.student_id = ${studentDbId}
            AND ln.lecture_id = ${lectureId}
          ORDER BY ln.created_at DESC
          LIMIT 100
        `
      : await sql`
          SELECT
            ln.id,
            ln.lecture_id,
            ln.slide_number,
            ln.question,
            ln.ai_response,
            ln.screenshot_storage_key,
            ln.selected_text,
            ln.action_type,
            ln.created_at,
            l.title AS lecture_title,
            l.week AS lecture_week
          FROM lecture_notes ln
          JOIN lectures l ON l.id = ln.lecture_id
          WHERE ln.student_id = ${studentDbId}
          ORDER BY ln.created_at DESC
          LIMIT 200
        `

    const items = notes.map((row) => {
      const r = row as Record<string, unknown>
      const key = r.screenshot_storage_key as string | null
      return {
        id: r.id,
        lectureId: r.lecture_id,
        lectureTitle: r.lecture_title,
        lectureWeek: r.lecture_week,
        slideNumber: r.slide_number,
        question: r.question,
        aiResponse: r.ai_response,
        selectedText: r.selected_text,
        actionType: r.action_type,
        threadId: r.thread_id,
        createdAt: r.created_at,
        screenshotUrl: key
          ? `/api/student/lecture-notes/screenshot?key=${encodeURIComponent(key)}&studentId=${encodeURIComponent(rosterId)}`
          : null,
      }
    })

    return NextResponse.json({ notes: items })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes("does not exist")) {
      return NextResponse.json({ notes: [] })
    }
    console.error("[lecture-notes GET]", error)
    return NextResponse.json({ error: "Failed to load notes" }, { status: 500 })
  }
}
