import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAcademicTermInstructor } from "@/lib/academic-term-instructor-auth"
import { setActiveAcademicTerm } from "@/lib/active-academic-term"

export const dynamic = "force-dynamic"

/** Institution-wide academic terms with course offerings. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAcademicTermInstructor(request)
    if (!auth.ok) return auth.response

    const terms = await sql`
      SELECT 
        at.id,
        at.year,
        at.term,
        at.start_date,
        at.end_date,
        at.is_active,
        at.created_at,
        (
          SELECT COUNT(*)::int FROM academic_term_courses atc WHERE atc.academic_term_id = at.id
        ) AS course_count,
        COUNT(DISTINCT s.id) FILTER (
          WHERE s.id IS NOT NULL AND TRIM(UPPER(s.code)) <> 'BETA'
        )::int AS session_count,
        COUNT(DISTINCT st.id)::int AS total_students,
        COALESCE(
          (
            SELECT json_agg(
              jsonb_build_object(
                'id', c2.id,
                'course_code', c2.course_code,
                'course_title', c2.course_title
              )
              ORDER BY c2.course_title
            )
            FROM academic_term_courses atc
            INNER JOIN courses c2 ON c2.id = atc.course_id
            WHERE atc.academic_term_id = at.id
          ),
          '[]'::json
        ) AS courses
      FROM academic_terms at
      LEFT JOIN sessions s ON s.academic_term_id = at.id
      LEFT JOIN students st ON st.session_id = s.id
      GROUP BY at.id
      ORDER BY at.year DESC, 
        CASE at.term 
          WHEN 'Fall' THEN 1
          WHEN 'Winter' THEN 2
          WHEN 'Spring' THEN 3
          WHEN 'Summer' THEN 4
        END DESC
    `

    return NextResponse.json({ terms })
  } catch (error) {
    console.error("[v0] Failed to fetch academic terms:", error)
    return NextResponse.json({ error: "Failed to fetch academic terms" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAcademicTermInstructor(request)
    if (!auth.ok) return auth.response

    const { year, term, start_date, end_date, is_active } = await request.json()

    if (!year || !term) {
      return NextResponse.json({ error: "Year and term are required" }, { status: 400 })
    }

    const existing = await sql`
      SELECT id FROM academic_terms WHERE year = ${year} AND term = ${term}
    `

    if (existing.length > 0) {
      return NextResponse.json({ error: "Academic term already exists" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO academic_terms (year, term, start_date, end_date, is_active)
      VALUES (
        ${year}, 
        ${term}, 
        ${start_date || null}, 
        ${end_date || null}, 
        false
      )
      RETURNING id, year, term, start_date, end_date, is_active, created_at
    `

    if (is_active === true) {
      const activated = await setActiveAcademicTerm(Number(result[0].id))
      return NextResponse.json({ term: activated ?? result[0] })
    }

    return NextResponse.json({ term: result[0] })
  } catch (error) {
    console.error("[v0] Failed to create academic term:", error)
    return NextResponse.json({ error: "Failed to create academic term" }, { status: 500 })
  }
}
