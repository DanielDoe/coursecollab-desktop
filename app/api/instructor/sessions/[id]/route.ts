import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"



// GET single session
export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }

    const { id } = await params
    const sessionId = Number.parseInt(id)

    const result = await sql`
      SELECT 
        s.id,
        s.code,
        s.description,
        s.created_at,
        COUNT(st.id) as student_count
      FROM sessions s
      LEFT JOIN students st ON s.id = st.session_id
      WHERE s.id = ${sessionId} AND s.course_id = ${scope.course.id}
      GROUP BY s.id
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    return NextResponse.json({ session: result[0] })
  } catch (error) {
    console.error("[v0] Failed to fetch session:", error)
    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 })
  }
}

// PUT update session
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }
    const scopedCourseId = scope.course.id

    const { id } = await params
    const sessionId = Number.parseInt(id)
    const { code, description, academic_term_id } = await request.json()

    if (!code) {
      return NextResponse.json({ error: "Session code is required" }, { status: 400 })
    }

    // Get current session to check if it's BETA and course ownership
    const currentSession = await sql`
      SELECT code, course_id FROM sessions WHERE id = ${sessionId}
    `

    if (currentSession.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    if (Number(currentSession[0].course_id) !== scopedCourseId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const isBetaSession = currentSession[0].code.toUpperCase() === 'BETA'
    const isNewBetaCode = code.toUpperCase() === 'BETA'

    // BETA session must always be standalone (no academic term)
    // If updating to BETA or updating existing BETA, force academic_term_id to NULL
    if (isBetaSession || isNewBetaCode) {
      const result = await sql`
        UPDATE sessions
        SET code = ${code}, 
            description = ${description || null},
            academic_term_id = NULL
        WHERE id = ${sessionId} AND course_id = ${scopedCourseId}
        RETURNING id, code, description, academic_term_id, created_at
      `

      if (result.length === 0) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
      }

      return NextResponse.json({ session: result[0] })
    }

    const codeVariants = normalizedSectionVariantsForSql(code)
    const existing = await sql`
      SELECT id FROM sessions
      WHERE id != ${sessionId}
      AND course_id = ${scopedCourseId}
      AND TRIM(code) = ANY(${codeVariants}::text[])
    `

    if (existing.length > 0) {
      return NextResponse.json({ error: "Session code already exists" }, { status: 400 })
    }

    // Update session (academic_term_id can be updated for non-BETA sessions)
    const result = await sql`
      UPDATE sessions
      SET code = ${code}, 
          description = ${description || null},
          academic_term_id = ${academic_term_id !== undefined ? academic_term_id : sql`academic_term_id`}
      WHERE id = ${sessionId} AND course_id = ${scopedCourseId}
      RETURNING id, code, description, academic_term_id, created_at
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    return NextResponse.json({ session: result[0] })
  } catch (error) {
    console.error("[v0] Failed to update session:", error)
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 })
  }
}

// DELETE session (cascade deletes students)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }

    const { id } = await params
    const sessionId = Number.parseInt(id)

    const owned = await sql`
      SELECT id FROM sessions WHERE id = ${sessionId} AND course_id = ${scope.course.id} LIMIT 1
    `
    if (owned.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Get student count before deletion
    const countResult = await sql`
      SELECT COUNT(*) as count FROM students WHERE session_id = ${sessionId}
    `
    const studentCount = countResult[0].count

    // Delete session (cascade will delete students)
    const result = await sql`
      DELETE FROM sessions WHERE id = ${sessionId} AND course_id = ${scope.course.id}
      RETURNING id, code
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    return NextResponse.json({
      message: "Session deleted successfully",
      deletedStudents: studentCount,
      session: result[0],
    })
  } catch (error) {
    console.error("[v0] Failed to delete session:", error)
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 })
  }
}

