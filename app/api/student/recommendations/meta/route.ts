import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const raw = (searchParams.get("studentDatabaseId") ?? searchParams.get("studentId") ?? "").trim()
    const bound = await requireBoundStudentCaller(request, raw || null)
    if (!bound.ok) return bound.response
    const dbId = bound.studentDbId

    const st = sqlRows(
      await sql`
      SELECT s.id, s.full_name, s.session_id, sess.code AS session_code, sess.description AS session_description
      FROM students s
      LEFT JOIN sessions sess ON sess.id = s.session_id
      WHERE s.id = ${dbId}
      LIMIT 1
    `,
    )
    if (st.length === 0) return NextResponse.json({ error: "Student not found" }, { status: 404 })

    const guestFlag = sqlRows<{ is_platform_guest: boolean }>(
      await sql`SELECT COALESCE(is_platform_guest, false) AS is_platform_guest FROM students WHERE id = ${dbId} LIMIT 1`,
    )
    const isGuest = Boolean(guestFlag[0]?.is_platform_guest)

    const instructors = sqlRows(
      isGuest
        ? await sql`
            SELECT i.id, i.name, i.email, i.username
            FROM instructors i
            LEFT JOIN recommendation_settings rs ON rs.instructor_id = i.id
            WHERE COALESCE(rs.enabled, true) = true
            ORDER BY i.name ASC NULLS LAST, i.username ASC
          `
        : await sql`
            SELECT id, name, email, username FROM instructors ORDER BY name ASC NULLS LAST, username ASC
          `,
    )

    const sessions = sqlRows(
      isGuest
        ? await sql`SELECT id, code, description FROM sessions WHERE code = 'GUEST' ORDER BY code ASC`
        : await sql`SELECT id, code, description FROM sessions ORDER BY code ASC`,
    )

    return NextResponse.json({
      student: st[0],
      instructors,
      sessions,
      isGuest,
    })
  } catch (e) {
    console.error("[recommendations meta]", e)
    return NextResponse.json({ error: "Failed to load options" }, { status: 500 })
  }
}
