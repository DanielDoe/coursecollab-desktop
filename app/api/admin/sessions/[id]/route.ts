import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAdminIdFromRequest, requireAdminId } from "@/lib/admin-api-auth"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"



// GET single session
export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const sessionId = Number.parseInt(params.id)

    const result = await sql`
      SELECT 
        s.id,
        s.code,
        s.description,
        s.created_at,
        COUNT(st.id) as student_count
      FROM sessions s
      LEFT JOIN students st ON s.id = st.session_id
      WHERE s.id = ${sessionId}
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
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sessionId = Number.parseInt(params.id)
    const { code, description, academic_term_id } = await request.json()

    if (!code) {
      return NextResponse.json({ error: "Session code is required" }, { status: 400 })
    }

    const codeVariants = normalizedSectionVariantsForSql(code)
    const existing = await sql`
      SELECT id FROM sessions
      WHERE id != ${sessionId}
      AND TRIM(code) = ANY(${codeVariants}::text[])
    `

    if (existing.length > 0) {
      return NextResponse.json({ error: "Session code already exists" }, { status: 400 })
    }

    const termId =
      academic_term_id !== undefined
        ? academic_term_id != null && Number.isFinite(Number(academic_term_id))
          ? Number(academic_term_id)
          : null
        : undefined

    const result = await sql`
      UPDATE sessions
      SET
        code = ${code},
        description = ${description || null},
        academic_term_id = ${
          termId !== undefined ? termId : sql`academic_term_id`
        }
      WHERE id = ${sessionId}
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
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const sessionId = Number.parseInt(params.id)

    // Get student count before deletion
    const countResult = await sql`
      SELECT COUNT(*) as count FROM students WHERE session_id = ${sessionId}
    `
    const studentCount = countResult[0].count

    // Delete session (cascade will delete students)
    const result = await sql`
      DELETE FROM sessions WHERE id = ${sessionId}
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
