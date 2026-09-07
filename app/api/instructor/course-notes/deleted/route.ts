import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { ensureCourseDigitalNotesSchema, mapCourseDigitalNote } from "@/lib/course-digital-notes"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureCourseDigitalNotesSchema()

    const notes = await sql`
      SELECT *
      FROM course_digital_notes
      WHERE course_id = ${scope.course.id}
        AND deleted_at IS NOT NULL
      ORDER BY deleted_at DESC
    `

    return NextResponse.json({
      notes: (notes as Record<string, unknown>[]).map((n) => ({
        ...mapCourseDigitalNote(n as never),
        deletedAt: String(n.deleted_at ?? ""),
      })),
    })
  } catch (error) {
    console.error("[instructor/course-notes/deleted GET]", error)
    return NextResponse.json({ error: "Failed to load deleted notes" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureCourseDigitalNotesSchema()

    const body = (await request.json()) as { noteIds?: number[] }
    const noteIds = Array.isArray(body.noteIds) ? body.noteIds.filter(Number.isFinite) : []

    if (noteIds.length === 0) {
      return NextResponse.json({ error: "noteIds required" }, { status: 400 })
    }

    await sql`
      UPDATE course_digital_notes
      SET deleted_at = NULL, updated_at = NOW()
      WHERE id = ANY(${noteIds})
        AND course_id = ${scope.course.id}
    `

    return NextResponse.json({ success: true, restoredNotes: noteIds.length })
  } catch (error) {
    console.error("[instructor/course-notes/deleted PATCH]", error)
    return NextResponse.json({ error: "Failed to restore notes" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureCourseDigitalNotesSchema()

    const body = (await request.json()) as { noteIds?: number[] }
    const noteIds = Array.isArray(body.noteIds) ? body.noteIds.filter(Number.isFinite) : []

    if (noteIds.length === 0) {
      return NextResponse.json({ error: "noteIds required" }, { status: 400 })
    }

    await sql`
      DELETE FROM course_digital_notes
      WHERE id = ANY(${noteIds})
        AND course_id = ${scope.course.id}
        AND deleted_at IS NOT NULL
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[instructor/course-notes/deleted DELETE]", error)
    return NextResponse.json({ error: "Failed to permanently delete notes" }, { status: 500 })
  }
}
