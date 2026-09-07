import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { invalidateSessionCatalogCache } from "@/lib/session-catalog"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { readInstructorSessionScopeFromRequest } from "@/lib/instructor-session-scope"
import { getActiveAcademicTerm } from "@/lib/active-academic-term"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }
    const courseId = scope.course.id

    const { searchParams } = new URL(request.url)
    const sessionScope = readInstructorSessionScopeFromRequest(request)
    let academicTermIdRaw =
      searchParams.get("academic_term_id") ??
      (sessionScope.academicTermId != null ? String(sessionScope.academicTermId) : null)

    if (!academicTermIdRaw) {
      const active = await getActiveAcademicTerm()
      if (active?.id) academicTermIdRaw = String(active.id)
    }

    const sessionId =
      sessionScope.sessionId != null && Number.isFinite(sessionScope.sessionId) && sessionScope.sessionId > 0
        ? Math.trunc(sessionScope.sessionId)
        : null

    let sessions
    if (sessionId != null) {
      sessions = await sql`
        SELECT 
          s.id,
          s.code,
          s.description,
          s.academic_term_id,
          s.created_at,
          COUNT(st.id) as student_count
        FROM sessions s
        LEFT JOIN students st ON s.id = st.session_id AND st.deleted_at IS NULL
        WHERE s.id = ${sessionId}
          AND s.course_id = ${courseId}
          AND TRIM(UPPER(s.code)) <> 'BETA'
        GROUP BY s.id
        ORDER BY s.code ASC
      `
    } else if (academicTermIdRaw) {
      sessions = await sql`
        SELECT 
          s.id,
          s.code,
          s.description,
          s.academic_term_id,
          s.created_at,
          COUNT(st.id) as student_count
        FROM sessions s
        LEFT JOIN students st ON s.id = st.session_id AND st.deleted_at IS NULL
        WHERE s.academic_term_id = ${parseInt(academicTermIdRaw, 10)} AND s.course_id = ${courseId}
          AND TRIM(UPPER(s.code)) <> 'BETA'
        GROUP BY s.id
        ORDER BY s.code ASC
      `
    } else {
      sessions = await sql`
        SELECT 
          s.id,
          s.code,
          s.description,
          s.academic_term_id,
          s.created_at,
          COUNT(st.id) as student_count
        FROM sessions s
        LEFT JOIN students st ON s.id = st.session_id AND st.deleted_at IS NULL
        WHERE s.course_id = ${courseId}
          AND TRIM(UPPER(s.code)) <> 'BETA'
        GROUP BY s.id
        ORDER BY s.code ASC
      `
    }

    return NextResponse.json({
      course: {
        id: scope.course.id,
        course_code: scope.course.course_code,
        course_title: scope.course.course_title,
      },
      sessions,
    })
  } catch (error) {
    console.error("[v0] Failed to fetch sessions:", error)
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }
    const courseId = scope.course.id

    const { code, description, academic_term_id } = await request.json()

    if (!code) {
      return NextResponse.json({ error: "Session code is required" }, { status: 400 })
    }

    if (code.toUpperCase() === "BETA") {
      const existingBeta = await sql`
        SELECT id, code, description, academic_term_id, created_at
        FROM sessions
        WHERE course_id = ${courseId}
          AND TRIM(code) = 'BETA'
          AND academic_term_id IS NULL
        LIMIT 1
      `
      if (existingBeta.length > 0) {
        if (description) {
          await sql`
            UPDATE sessions
            SET description = ${description}
            WHERE id = ${existingBeta[0].id}
          `
        }
        invalidateSessionCatalogCache()
        return NextResponse.json({ session: existingBeta[0] })
      }

      const result = await sql`
        INSERT INTO sessions (code, description, academic_term_id, course_id)
        VALUES (${code}, ${description || null}, NULL, ${courseId})
        RETURNING id, code, description, academic_term_id, created_at
      `
      invalidateSessionCatalogCache()
      return NextResponse.json({ session: result[0] })
    }

    if (!academic_term_id) {
      return NextResponse.json({ error: "Academic term is required" }, { status: 400 })
    }

    const codeVariants = normalizedSectionVariantsForSql(code)
    const existing = await sql`
      SELECT id FROM sessions 
      WHERE academic_term_id = ${academic_term_id}
      AND course_id = ${courseId}
      AND TRIM(code) = ANY(${codeVariants}::text[])
    `

    if (existing.length > 0) {
      return NextResponse.json({ error: "Session code already exists for this academic term" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO sessions (code, description, academic_term_id, course_id)
      VALUES (${code}, ${description || null}, ${academic_term_id}, ${courseId})
      RETURNING id, code, description, academic_term_id, created_at
    `

    invalidateSessionCatalogCache()

    return NextResponse.json({ session: result[0] })
  } catch (error) {
    console.error("[v0] Failed to create session:", error)
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 })
  }
}
