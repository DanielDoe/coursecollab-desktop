import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const session = searchParams.get("session")
    const courseIdParam = searchParams.get("courseId")

    if (!session) {
      return NextResponse.json({ error: "Session is required" }, { status: 400 })
    }

    let courseId: number | null = null
    if (courseIdParam) {
      const n = Number(courseIdParam)
      if (Number.isFinite(n)) courseId = n
    }
    if (courseId == null) {
      const variants = normalizedSectionVariantsForSql(session)
      const sessionRows =
        variants.length > 0
          ? await sql`
              SELECT course_id FROM sessions
              WHERE TRIM(code) = ANY(${variants}::text[])
              ORDER BY code
              LIMIT 1
            `
          : await sql`
              SELECT course_id FROM sessions
              WHERE TRIM(code) = TRIM(${session})
              LIMIT 1
            `
      if (sessionRows.length > 0 && sessionRows[0].course_id != null) {
        courseId = Number(sessionRows[0].course_id)
      }
    }

    const notes = await sql`
      SELECT 
        id,
        week,
        title,
        professor_notes,
        lecture_summary,
        updated_at as last_updated
      FROM lectures
      WHERE is_published = true
        AND deleted_at IS NULL
        AND (${courseId}::int IS NULL OR course_id IS NULL OR course_id = ${courseId})
        AND (session_access IS NULL OR ${session} = ANY(session_access))
        AND (professor_notes IS NOT NULL OR lecture_summary IS NOT NULL)
      ORDER BY updated_at DESC
      LIMIT 5
    `

    return NextResponse.json({ notes, courseId })
  } catch (error) {
    console.error("Failed to fetch professor notes:", error)
    return NextResponse.json({ error: "Failed to fetch professor notes" }, { status: 500 })
  }
}
