import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAdminIdFromRequest, requireAdminId } from "@/lib/admin-api-auth"

export const dynamic = "force-dynamic"

/** Institution-wide academic terms (admin portal). */
export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const courseIdRaw = searchParams.get("course_id")
    const courseId =
      courseIdRaw && courseIdRaw !== "all" ? Number(courseIdRaw) : null

    const terms =
      courseId != null && Number.isFinite(courseId)
        ? await sql`
            SELECT
              at.id,
              at.year,
              at.term,
              at.start_date,
              at.end_date,
              at.is_active,
              at.created_at,
              COUNT(DISTINCT s.id) AS session_count,
              COUNT(DISTINCT st.id) AS total_students,
              COALESCE(
                json_agg(
                  DISTINCT jsonb_build_object(
                    'id', c.id,
                    'course_code', c.course_code,
                    'course_title', c.course_title
                  )
                ) FILTER (WHERE c.id IS NOT NULL),
                '[]'::json
              ) AS courses
            FROM academic_terms at
            LEFT JOIN sessions s ON s.academic_term_id = at.id AND s.course_id = ${courseId}
            LEFT JOIN students st ON st.session_id = s.id
            LEFT JOIN courses c ON c.id = s.course_id
            GROUP BY at.id
            ORDER BY at.year DESC,
              CASE at.term
                WHEN 'Fall' THEN 1
                WHEN 'Winter' THEN 2
                WHEN 'Spring' THEN 3
                WHEN 'Summer' THEN 4
              END DESC
          `
        : await sql`
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
    console.error("[admin/academic-terms GET]", error)
    return NextResponse.json({ error: "Failed to fetch academic terms" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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
        ${is_active !== undefined ? is_active : true}
      )
      RETURNING id, year, term, start_date, end_date, is_active, created_at
    `

    return NextResponse.json({ term: result[0] })
  } catch (error) {
    console.error("[admin/academic-terms POST]", error)
    return NextResponse.json({ error: "Failed to create academic term" }, { status: 500 })
  }
}
