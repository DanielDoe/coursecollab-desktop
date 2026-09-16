import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import type { StudentDigitalNoteShare } from "@/lib/student-digital-notes"

export const dynamic = "force-dynamic"

async function getOwnedNoteId(studentDbId: number, noteId: number) {
  const rows = await sql`
    SELECT id FROM student_digital_notes
    WHERE id = ${noteId} AND student_id = ${studentDbId}
    LIMIT 1
  `
  return rows[0]?.id as number | undefined
}

async function filterClassmateIds(ownerStudentDbId: number, targetIds: number[]) {
  if (targetIds.length === 0) return []

  const rows = await sql`
    SELECT s.id
    FROM students s
    WHERE s.id = ANY(${targetIds}::int[])
      AND s.id <> ${ownerStudentDbId}
      AND s.session_id = (
        SELECT session_id FROM students WHERE id = ${ownerStudentDbId} LIMIT 1
      )
  `
  return (rows as Array<{ id: number }>).map((row) => row.id)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> },
) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    const noteId = Number((await params).noteId)
    if (!Number.isFinite(noteId) || noteId <= 0) {
      return NextResponse.json({ error: "Invalid note id" }, { status: 400 })
    }

    const owned = await getOwnedNoteId(auth.studentDbId, noteId)
    if (!owned) {
      return NextResponse.json({ error: "Note not found" }, { status: 403 })
    }

    const rows = await sql`
      SELECT s.id AS student_database_id, s.full_name
      FROM student_digital_note_shares sh
      JOIN students s ON s.id = sh.shared_with_student_id
      WHERE sh.note_id = ${noteId}
      ORDER BY s.full_name ASC
    `

    const shares: StudentDigitalNoteShare[] = (
      rows as Array<{ student_database_id: number; full_name: string }>
    ).map((row) => ({
      studentDatabaseId: row.student_database_id,
      fullName: row.full_name,
    }))

    return NextResponse.json({ shares })
  } catch (error) {
    console.error("[student/digital-notes/[noteId]/share GET]", error)
    return NextResponse.json({ error: "Failed to load shares" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> },
) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    const noteId = Number((await params).noteId)
    if (!Number.isFinite(noteId) || noteId <= 0) {
      return NextResponse.json({ error: "Invalid note id" }, { status: 400 })
    }

    const owned = await getOwnedNoteId(auth.studentDbId, noteId)
    if (!owned) {
      return NextResponse.json({ error: "Note not found" }, { status: 403 })
    }

    const body = (await request.json()) as { studentDatabaseIds?: unknown }
    const rawIds = Array.isArray(body.studentDatabaseIds) ? body.studentDatabaseIds : []
    const parsedIds = [
      ...new Set(
        rawIds
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ]

    const validIds = await filterClassmateIds(auth.studentDbId, parsedIds)

    await sql`DELETE FROM student_digital_note_shares WHERE note_id = ${noteId}`

    if (validIds.length > 0) {
      const ownerNameRows = await sql`
        SELECT full_name FROM students WHERE id = ${auth.studentDbId} LIMIT 1
      `
      const noteTitleRows = await sql`
        SELECT title FROM student_digital_notes WHERE id = ${noteId} LIMIT 1
      `
      const ownerName = String(
        (ownerNameRows[0] as { full_name?: string } | undefined)?.full_name ?? "A classmate",
      )
      const noteTitle = String(
        (noteTitleRows[0] as { title?: string } | undefined)?.title ?? "a note",
      )

      const { createNotification } = await import("@/lib/create-notification")
      for (const sharedWithId of validIds) {
        await sql`
          INSERT INTO student_digital_note_shares (
            note_id,
            owner_student_id,
            shared_with_student_id
          )
          VALUES (
            ${noteId},
            ${auth.studentDbId},
            ${sharedWithId}
          )
          ON CONFLICT (note_id, shared_with_student_id) DO NOTHING
        `
        void createNotification({
          studentId: sharedWithId,
          type: "notes",
          title: "Note shared with you",
          message: `${ownerName} shared "${noteTitle}" with you.`,
          link: "/student/dashboard-v2/digital-notes",
        }).catch((err) => console.warn("[digital-notes share] notify failed:", err))
      }
    }

    const rows = await sql`
      SELECT s.id AS student_database_id, s.full_name
      FROM student_digital_note_shares sh
      JOIN students s ON s.id = sh.shared_with_student_id
      WHERE sh.note_id = ${noteId}
      ORDER BY s.full_name ASC
    `

    const shares: StudentDigitalNoteShare[] = (
      rows as Array<{ student_database_id: number; full_name: string }>
    ).map((row) => ({
      studentDatabaseId: row.student_database_id,
      fullName: row.full_name,
    }))

    return NextResponse.json({ shares })
  } catch (error) {
    console.error("[student/digital-notes/[noteId]/share PUT]", error)
    return NextResponse.json({ error: "Failed to update shares" }, { status: 500 })
  }
}
