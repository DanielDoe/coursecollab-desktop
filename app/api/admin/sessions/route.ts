import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAdminIdFromRequest, requireAdminId } from "@/lib/admin-api-auth"
import { invalidateSessionCatalogCache } from "@/lib/session-catalog"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get("course_id")
    const academicTermId = searchParams.get("academic_term_id")

    const sessions =
      academicTermId && Number.isFinite(Number(academicTermId))
        ? await sql`
            SELECT
              s.id,
              s.code,
              s.description,
              s.academic_term_id,
              s.course_id,
              s.created_at,
              COUNT(st.id)::int as student_count
            FROM sessions s
            LEFT JOIN students st ON s.id = st.session_id
            WHERE s.academic_term_id = ${Number(academicTermId)}
            GROUP BY s.id, s.code, s.description, s.academic_term_id, s.course_id, s.created_at
            ORDER BY s.code ASC
          `
        : courseId && courseId !== "all"
          ? await sql`
              SELECT
                s.id,
                s.code,
                s.description,
                s.academic_term_id,
                s.course_id,
                s.created_at,
                COUNT(st.id)::int as student_count
              FROM sessions s
              LEFT JOIN students st ON s.id = st.session_id
              WHERE s.course_id = ${Number(courseId)}
              GROUP BY s.id, s.code, s.description, s.academic_term_id, s.course_id, s.created_at
              ORDER BY s.code ASC
            `
          : await sql`
              SELECT
                s.id,
                s.code,
                s.description,
                s.academic_term_id,
                s.course_id,
                s.created_at,
                COUNT(st.id)::int as student_count
              FROM sessions s
              LEFT JOIN students st ON s.id = st.session_id
              GROUP BY s.id, s.code, s.description, s.academic_term_id, s.course_id, s.created_at
              ORDER BY s.code ASC
            `

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error("[v0] Failed to fetch sessions:", error)
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 })
  }
}

// POST create new session
export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { code, description, academic_term_id } = await request.json()

    if (!code) {
      return NextResponse.json({ error: "Session code is required" }, { status: 400 })
    }

    const codeVariants = normalizedSectionVariantsForSql(code)
    const existing = await sql`
      SELECT id FROM sessions WHERE TRIM(code) = ANY(${codeVariants}::text[])
    `

    if (existing.length > 0) {
      return NextResponse.json({ error: "Session code already exists" }, { status: 400 })
    }

    const termId =
      academic_term_id != null && Number.isFinite(Number(academic_term_id))
        ? Number(academic_term_id)
        : null

    const result = await sql`
      INSERT INTO sessions (code, description, academic_term_id)
      VALUES (${code}, ${description || null}, ${termId})
      RETURNING id, code, description, academic_term_id, created_at
    `

    invalidateSessionCatalogCache()

    return NextResponse.json({ session: result[0] })
  } catch (error) {
    console.error("[v0] Failed to create session:", error)
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 })
  }
}
