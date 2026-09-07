import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { mapStudentDigitalNote, normalizeNoteIconColor } from "@/lib/student-digital-notes"

export const dynamic = "force-dynamic"

async function ensureDigitalNotesSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS student_digital_notes (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Untitled note',
      body_text TEXT NOT NULL DEFAULT '',
      ink_workspace JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_student_digital_notes_student_updated
      ON student_digital_notes (student_id, updated_at DESC)
  `
  await sql`
    CREATE TABLE IF NOT EXISTS student_digital_note_shares (
      id SERIAL PRIMARY KEY,
      note_id INTEGER NOT NULL REFERENCES student_digital_notes(id) ON DELETE CASCADE,
      owner_student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      shared_with_student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (note_id, shared_with_student_id)
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_student_digital_note_shares_recipient
      ON student_digital_note_shares (shared_with_student_id, created_at DESC)
  `
  await sql`
    ALTER TABLE student_digital_notes
    ADD COLUMN IF NOT EXISTS icon_color TEXT
  `
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    await ensureDigitalNotesSchema()

    const ownRows = await sql`
      SELECT id, title, body_text, ink_workspace, icon_color, created_at, updated_at
      FROM student_digital_notes
      WHERE student_id = ${auth.studentDbId}
      ORDER BY updated_at DESC
      LIMIT 100
    `

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
      WHERE sh.shared_with_student_id = ${auth.studentDbId}
      ORDER BY sh.created_at DESC
      LIMIT 100
    `

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

    const notes = [
      ...(ownRows as NoteRow[]).map((row) =>
        mapStudentDigitalNote(row, { isOwner: true }),
      ),
      ...(sharedRows as NoteRow[]).map((row) =>
        mapStudentDigitalNote(row, {
          isOwner: false,
          ownerName: row.owner_name ?? null,
          sharedAt: row.shared_at ?? null,
        }),
      ),
    ].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )

    return NextResponse.json({ notes })
  } catch (error) {
    console.error("[student/digital-notes GET]", error)
    return NextResponse.json({ error: "Failed to load notes" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    await ensureDigitalNotesSchema()

    const body = (await request.json()) as {
      title?: string
      bodyText?: string
      inkWorkspace?: unknown
      iconColor?: string
    }

    const title = String(body.title ?? "Untitled note").trim() || "Untitled note"
    const bodyText = String(body.bodyText ?? "")
    const iconColor = normalizeNoteIconColor(body.iconColor)
    const inkWorkspace =
      body.inkWorkspace != null ? JSON.stringify(body.inkWorkspace) : null

    const rows = await sql`
      INSERT INTO student_digital_notes (student_id, title, body_text, ink_workspace, icon_color)
      VALUES (
        ${auth.studentDbId},
        ${title},
        ${bodyText},
        ${inkWorkspace}::jsonb,
        ${iconColor}
      )
      RETURNING id, title, body_text, ink_workspace, icon_color, created_at, updated_at
    `

    return NextResponse.json({ note: mapStudentDigitalNote(rows[0] as never, { isOwner: true }) })
  } catch (error) {
    console.error("[student/digital-notes POST]", error)
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 })
  }
}
