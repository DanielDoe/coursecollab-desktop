import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { invalidateSessionCatalogCache } from "@/lib/session-catalog"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { courseUsesLabSections } from "@/lib/course-section-model"
import { loadInstructorActor } from "@/lib/instructor-actor-scope"

export const dynamic = "force-dynamic"

async function requireInstructorAuth(request: Request) {
  const instructorIdRaw = request.headers.get("x-instructor-id")
  if (!instructorIdRaw) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  const instructorId = Number(instructorIdRaw)
  const actor = await loadInstructorActor(instructorId)
  if (!actor || !actor.is_active) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  return { ok: true as const, instructorId, actor }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; courseId: string }> },
) {
  try {
    const auth = await requireInstructorAuth(request)
    if (!auth.ok) return auth.response

    const { id, courseId: courseIdParam } = await params
    const termId = Number.parseInt(id, 10)
    const courseId = Number.parseInt(courseIdParam, 10)

    const rows = await sql`
      SELECT
        s.id,
        s.code,
        s.description,
        s.academic_term_id,
        s.created_at,
        COUNT(st.id)::int AS student_count
      FROM sessions s
      LEFT JOIN students st ON st.session_id = s.id
      WHERE s.academic_term_id = ${termId}
        AND s.course_id = ${courseId}
        AND TRIM(UPPER(s.code)) <> 'BETA'
      GROUP BY s.id
      ORDER BY s.code ASC
    `

    const courseRows = await sql`
      SELECT course_code, course_title FROM courses WHERE id = ${courseId} LIMIT 1
    `

    return NextResponse.json({
      sections: rows,
      course: courseRows[0] ?? null,
      uses_sections: courseRows.length
        ? courseUsesLabSections(String((courseRows[0] as { course_code: string }).course_code))
        : true,
    })
  } catch (error) {
    console.error("[instructor/term course sections GET]", error)
    return NextResponse.json({ error: "Failed to fetch sections" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; courseId: string }> },
) {
  try {
    const auth = await requireInstructorAuth(request)
    if (!auth.ok) return auth.response

    const { id, courseId: courseIdParam } = await params
    const termId = Number.parseInt(id, 10)
    const courseId = Number.parseInt(courseIdParam, 10)
    const { code, description } = await request.json()

    if (!code?.trim()) {
      return NextResponse.json({ error: "Section code is required" }, { status: 400 })
    }

    const courseRows = await sql`
      SELECT course_code FROM courses WHERE id = ${courseId} LIMIT 1
    `
    if (!courseRows.length) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }
    const courseCode = String((courseRows[0] as { course_code: string }).course_code)
    if (!courseUsesLabSections(courseCode)) {
      return NextResponse.json(
        { error: "This course does not use lab sections. It is offered as a single roster." },
        { status: 400 },
      )
    }

    const codeVariants = normalizedSectionVariantsForSql(String(code).trim())
    const existing = await sql`
      SELECT id FROM sessions
      WHERE academic_term_id = ${termId}
        AND course_id = ${courseId}
        AND TRIM(code) = ANY(${codeVariants}::text[])
    `
    if (existing.length > 0) {
      return NextResponse.json({ error: "Section already exists for this course in this term" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO sessions (code, description, academic_term_id, course_id)
      VALUES (${String(code).trim()}, ${description || null}, ${termId}, ${courseId})
      RETURNING id, code, description, academic_term_id, created_at
    `
    invalidateSessionCatalogCache()

    return NextResponse.json({ section: result[0] })
  } catch (error) {
    console.error("[instructor/term course sections POST]", error)
    return NextResponse.json({ error: "Failed to create section" }, { status: 500 })
  }
}
