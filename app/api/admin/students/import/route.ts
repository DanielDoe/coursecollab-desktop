import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { resolveSessionRowByCode } from "@/lib/resolve-session-by-code"
import { upsertStudentsFromRosterRows, type RosterImportRow } from "@/lib/roster-import-upsert"

import { getStudentRosterDefaultPassword } from "@/lib/student-roster-default-password"
import bcrypt from "bcryptjs"

interface ImportRow extends RosterImportRow {
  student_id: string
  full_name: string
}

interface ImportRequest {
  section?: string  // Legacy support
  session_id?: number  // New: direct session ID
  session_code?: string  // New: session code
  academic_term_id?: number  // New: academic term ID
  rows: ImportRow[]
}

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { section, session_id, session_code, academic_term_id, rows } = (await request.json()) as ImportRequest

    console.log("[v0] Import request:", { section, session_id, session_code, academic_term_id, rowCount: rows.length })

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 })
    }

    let sessionId: number | null = null
    let sessionCode: string | null = null

    // Determine session - prioritize new parameters over legacy
    if (session_id) {
      // Direct session ID provided
      const sessionResult = await sql`
        SELECT id, code FROM sessions WHERE id = ${session_id}
      `
      if (sessionResult.length === 0) {
        return NextResponse.json({ error: "Session not found" }, { status: 400 })
      }
      sessionId = sessionResult[0].id
      sessionCode = sessionResult[0].code
    } else if (session_code) {
      const resolved = await resolveSessionRowByCode(String(session_code))
      if (!resolved) {
        return NextResponse.json({ error: "Session not found for code" }, { status: 400 })
      }
      sessionId = resolved.id
      sessionCode = resolved.code
    } else if (section) {
      const resolved = await resolveSessionRowByCode(String(section))
      if (!resolved) {
        return NextResponse.json({ error: "Session not found for section" }, { status: 400 })
      }
      sessionId = resolved.id
      sessionCode = resolved.code
    } else {
      return NextResponse.json({ error: "Session ID, session code, or section is required" }, { status: 400 })
    }

    // Verify academic term if provided
    if (academic_term_id) {
      const termResult = await sql`
        SELECT id FROM academic_terms WHERE id = ${academic_term_id}
      `
      if (termResult.length === 0) {
        return NextResponse.json({ error: "Academic term not found" }, { status: 400 })
      }

      // Verify session belongs to the academic term
      const sessionTermCheck = await sql`
        SELECT id FROM sessions WHERE id = ${sessionId} AND academic_term_id = ${academic_term_id}
      `
      if (sessionTermCheck.length === 0) {
        return NextResponse.json({ error: "Session does not belong to the specified academic term" }, { status: 400 })
      }
    }

    console.log("[v0] Found session:", { sessionId, sessionCode, academic_term_id })

    const courseRow = await sql`
      SELECT c.course_code
      FROM sessions s
      LEFT JOIN courses c ON c.id = s.course_id
      WHERE s.id = ${sessionId}
      LIMIT 1
    `
    const defaultPassword = getStudentRosterDefaultPassword(
      courseRow[0]?.course_code as string | undefined,
    )

    const hashedPassword = await bcrypt.hash(defaultPassword, 10)
    const summary = await upsertStudentsFromRosterRows(
      sql,
      Number(sessionId),
      String(sessionCode),
      rows,
      hashedPassword,
    )

    return NextResponse.json({
      success: true,
      summary,
    })
  } catch (error) {
    console.error("[v0] Failed to import students:", error)
    return NextResponse.json({ error: "Failed to import students" }, { status: 500 })
  }
}
