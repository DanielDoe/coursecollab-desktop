import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { mapStudentDigitalNote, normalizeNoteIconColor } from "@/lib/student-digital-notes"

export const dynamic = "force-dynamic"

type NoteRow = {
  id: number
  title: string
  body_text: string
  ink_workspace: unknown
  icon_color?: string | null
  created_at: string
  updated_at: string
  owner_name?: string | null
  shared_at?: string | null
}

async function getOwnedNote(studentDbId: number, noteId: number) {
  const rows = await sql`
    SELECT id, title, body_text, ink_workspace, icon_color, created_at, updated_at
    FROM student_digital_notes
    WHERE id = ${noteId} AND student_id = ${studentDbId}
    LIMIT 1
  `
  return rows[0] as NoteRow | undefined
}

async function getAccessibleNote(studentDbId: number, noteId: number) {
  const owned = await getOwnedNote(studentDbId, noteId)
  if (owned) {
    return { row: owned, isOwner: true as const }
  }

  const sharedRows = await sql`
    SELECT
      n.id,
      n.title,
      n.body_text,
      n.ink_workspace,
      n.icon_color,
      n.created_at,
      n.updated_at,
      s.full_name AS owner_name,
      sh.created_at AS shared_at
    FROM student_digital_note_shares sh
    JOIN student_digital_notes n ON n.id = sh.note_id
    JOIN students s ON s.id = n.student_id
    WHERE sh.note_id = ${noteId}
      AND sh.shared_with_student_id = ${studentDbId}
    LIMIT 1
  `

  const shared = sharedRows[0] as NoteRow | undefined
  if (!shared) return null

  return { row: shared, isOwner: false as const }
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

    const access = await getAccessibleNote(auth.studentDbId, noteId)
    if (!access) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    return NextResponse.json({
      note: mapStudentDigitalNote(access.row, {
        isOwner: access.isOwner,
        ownerName: access.isOwner ? null : (access.row.owner_name ?? null),
        sharedAt: access.isOwner ? null : (access.row.shared_at ?? null),
      }),
    })
  } catch (error) {
    console.error("[student/digital-notes/[noteId] GET]", error)
    return NextResponse.json({ error: "Failed to load note" }, { status: 500 })
  }
}

export async function PATCH(
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

    const existing = await getOwnedNote(auth.studentDbId, noteId)
    if (!existing) {
      return NextResponse.json({ error: "Note not found" }, { status: 403 })
    }

    const body = (await request.json()) as {
      title?: string
      bodyText?: string
      inkWorkspace?: unknown | null
      iconColor?: string | null
    }

    const title =
      body.title != null ? String(body.title).trim() || "Untitled note" : existing.title
    const bodyText = body.bodyText != null ? String(body.bodyText) : existing.body_text
    const iconColor =
      body.iconColor !== undefined
        ? normalizeNoteIconColor(body.iconColor)
        : (existing.icon_color ?? null)
    const inkWorkspace =
      body.inkWorkspace === null
        ? null
        : body.inkWorkspace != null
          ? JSON.stringify(body.inkWorkspace)
          : existing.ink_workspace != null
            ? JSON.stringify(existing.ink_workspace)
            : null

    const rows = await sql`
      UPDATE student_digital_notes
      SET
        title = ${title},
        body_text = ${bodyText},
        ink_workspace = ${inkWorkspace}::jsonb,
        icon_color = ${iconColor},
        updated_at = NOW()
      WHERE id = ${noteId} AND student_id = ${auth.studentDbId}
      RETURNING id, title, body_text, ink_workspace, icon_color, created_at, updated_at
    `

    return NextResponse.json({
      note: mapStudentDigitalNote(rows[0] as never, { isOwner: true }),
    })
  } catch (error) {
    console.error("[student/digital-notes/[noteId] PATCH]", error)
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 })
  }
}

export async function DELETE(
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

    const existing = await getOwnedNote(auth.studentDbId, noteId)
    if (!existing) {
      return NextResponse.json({ error: "Note not found" }, { status: 403 })
    }

    await sql`
      DELETE FROM student_digital_notes
      WHERE id = ${noteId} AND student_id = ${auth.studentDbId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[student/digital-notes/[noteId] DELETE]", error)
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 })
  }
}
