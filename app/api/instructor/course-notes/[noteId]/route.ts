import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  ensureCourseDigitalNotesSchema,
  fetchCourseDigitalNoteById,
  mapCourseDigitalNote,
} from "@/lib/course-digital-notes"

export const dynamic = "force-dynamic"

type RouteParams = { params: Promise<{ noteId: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const noteId = Number((await params).noteId)
    if (!Number.isFinite(noteId)) {
      return NextResponse.json({ error: "Invalid note id" }, { status: 400 })
    }

    const row = await fetchCourseDigitalNoteById(noteId)
    if (!row || Number(row.course_id) !== scope.course.id) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    return NextResponse.json({ note: mapCourseDigitalNote(row) })
  } catch (error) {
    console.error("[instructor/course-notes/[noteId] GET]", error)
    return NextResponse.json({ error: "Failed to load note" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureCourseDigitalNotesSchema()

    const noteId = Number((await params).noteId)
    if (!Number.isFinite(noteId)) {
      return NextResponse.json({ error: "Invalid note id" }, { status: 400 })
    }

    const existing = await fetchCourseDigitalNoteById(noteId)
    if (!existing || Number(existing.course_id) !== scope.course.id) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    const body = (await request.json()) as {
      title?: string
      bodyText?: string
      inkWorkspace?: unknown | null
      topic?: string | null
      session?: string | null
      isPublished?: boolean
    }

    const title = body.title != null ? String(body.title).trim() || "Untitled note" : existing.title
    const bodyText = body.bodyText != null ? String(body.bodyText) : existing.body_text
    const inkWorkspace =
      body.inkWorkspace === null
        ? null
        : body.inkWorkspace != null
          ? JSON.stringify(body.inkWorkspace)
          : existing.ink_workspace != null
            ? JSON.stringify(existing.ink_workspace)
            : null
    const topic =
      body.topic !== undefined
        ? body.topic != null
          ? String(body.topic).trim() || null
          : null
        : existing.topic
    const session =
      body.session !== undefined
        ? (() => {
            const raw = body.session != null ? String(body.session).trim() : ""
            return raw && raw !== "ALL" ? raw : null
          })()
        : existing.session
    const isPublished = body.isPublished !== undefined ? Boolean(body.isPublished) : existing.is_published

    const rows = await sql`
      UPDATE course_digital_notes
      SET
        title = ${title},
        body_text = ${bodyText},
        ink_workspace = ${inkWorkspace}::jsonb,
        topic = ${topic},
        session = ${session},
        is_published = ${isPublished},
        updated_at = NOW()
      WHERE id = ${noteId}
      RETURNING *
    `

    return NextResponse.json({ note: mapCourseDigitalNote(rows[0] as never) })
  } catch (error) {
    console.error("[instructor/course-notes/[noteId] PATCH]", error)
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const noteId = Number((await params).noteId)
    if (!Number.isFinite(noteId)) {
      return NextResponse.json({ error: "Invalid note id" }, { status: 400 })
    }

    const existing = await fetchCourseDigitalNoteById(noteId)
    if (!existing || Number(existing.course_id) !== scope.course.id) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    await sql`
      UPDATE course_digital_notes
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = ${noteId}
    `
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[instructor/course-notes/[noteId] DELETE]", error)
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 })
  }
}
