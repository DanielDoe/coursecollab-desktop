import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { deleteLectureScreenshotIfExists } from "@/lib/lecture-screenshot-storage"

export const dynamic = "force-dynamic"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const noteId = Number.parseInt(id, 10)
    if (!Number.isFinite(noteId)) {
      return NextResponse.json({ error: "Invalid note id" }, { status: 400 })
    }

    const rosterId = request.nextUrl.searchParams.get("studentId")?.trim()
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

    const rows = await sql`
      SELECT screenshot_storage_key FROM lecture_notes
      WHERE id = ${noteId} AND student_id = ${studentDbId}
      LIMIT 1
    `
    if (!rows.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const key = (rows[0] as { screenshot_storage_key: string | null }).screenshot_storage_key
    await deleteLectureScreenshotIfExists(key)

    await sql`
      DELETE FROM lecture_notes
      WHERE id = ${noteId} AND student_id = ${studentDbId}
    `

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[lecture-notes DELETE]", error)
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 })
  }
}
