import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  buildLectureInstructorCourseScopeSqlFragment,
  hasLectureSessionAccessTable,
} from "@/lib/instructor-default-courses"

export const dynamic = "force-dynamic"

type CourseRow = { id: number; course_code: string; course_title: string }

/** Read-only JSON snapshot of lectures + slide signals for the scoped course, or `includeCodes` courses (e.g. ELEG1301,ELEG1304). */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }
    const { instructorId } = scope

    const includeCodesRaw = request.nextUrl.searchParams.get("includeCodes")
    let courses: CourseRow[]

    if (includeCodesRaw?.trim()) {
      const codes = includeCodesRaw
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean)
      const rows = await sql`
        SELECT id, course_code, course_title
        FROM courses
        WHERE instructor_id = ${instructorId}
          AND UPPER(TRIM(course_code)) = ANY(${codes}::text[])
        ORDER BY course_code ASC
      `
      courses = rows as CourseRow[]
      if (courses.length === 0) {
        return NextResponse.json({
          takenAt: new Date().toISOString(),
          error: "No matching courses for includeCodes (must belong to you).",
          requestedCodes: codes,
          snapshots: [],
        })
      }
    } else {
      const c = scope.course
      courses = [
        {
          id: c.id,
          course_code: c.course_code,
          course_title: c.course_title,
        },
      ]
    }

    const sessionAnchors = await sql`
      SELECT s.id, s.code, s.course_id, c.course_code AS owner_course_code
      FROM sessions s
      INNER JOIN courses c ON c.id = s.course_id
      WHERE c.instructor_id = ${instructorId}
        AND TRIM(UPPER(s.code)) IN ('ELEG1301P01', 'ELEG1304P01')
      ORDER BY s.code ASC
    `

    const hasLsa = await hasLectureSessionAccessTable()

    const snapshots = []
    for (const course of courses) {
      const courseId = course.id
      const scopeWhere = await buildLectureInstructorCourseScopeSqlFragment(
        courseId,
        instructorId,
        course.course_code,
      )

      const lectures = hasLsa
        ? await sql`
        SELECT
          l.id,
          l.title,
          l.week,
          l.course_id,
          l.session,
          l.session_access,
          l.is_published,
          l.created_at,
          (
            SELECT COUNT(*)::int
            FROM lecture_slides ls
            WHERE ls.lecture_id = l.id
              AND COALESCE(ls.is_active, true) = true
          ) AS lecture_slides_row_count,
          (
            SELECT COALESCE(json_agg(sess.code ORDER BY sess.code), '[]'::json)
            FROM lecture_session_access lsa
            INNER JOIN sessions sess ON sess.id = lsa.session_id
            WHERE lsa.lecture_id = l.id
              AND COALESCE(lsa.is_active, true) = true
          ) AS linked_session_codes
        FROM lectures l
        WHERE l.deleted_at IS NULL
          AND (${scopeWhere})
        ORDER BY l.week ASC, l.id ASC
      `
        : await sql`
        SELECT
          l.id,
          l.title,
          l.week,
          l.course_id,
          l.session,
          l.session_access,
          l.is_published,
          l.created_at,
          (
            SELECT COUNT(*)::int
            FROM lecture_slides ls
            WHERE ls.lecture_id = l.id
              AND COALESCE(ls.is_active, true) = true
          ) AS lecture_slides_row_count,
          '[]'::json AS linked_session_codes
        FROM lectures l
        WHERE l.deleted_at IS NULL
          AND (${scopeWhere})
        ORDER BY l.week ASC, l.id ASC
      `

      let slidesJsonLengths: { lecture_id: number; slides_json_array_len: number | null }[] = []
      try {
        slidesJsonLengths = (await sql`
          SELECT
            l.id AS lecture_id,
            CASE
              WHEN l.slides IS NULL THEN NULL::int
              WHEN jsonb_typeof(l.slides::jsonb) = 'array' THEN jsonb_array_length(l.slides::jsonb)
              ELSE NULL::int
            END AS slides_json_array_len
          FROM lectures l
          WHERE l.deleted_at IS NULL
            AND (${scopeWhere})
        `) as { lecture_id: number; slides_json_array_len: number | null }[]
      } catch {
        slidesJsonLengths = []
      }

      const lenByLecture = new Map<number, number | null>()
      for (const row of slidesJsonLengths) {
        lenByLecture.set(Number(row.lecture_id), row.slides_json_array_len ?? null)
      }

      snapshots.push({
        course: {
          id: course.id,
          course_code: course.course_code,
          course_title: course.course_title,
        },
        anchorSessionsP01: sessionAnchors,
        lectureCount: lectures.length,
        lectures: (lectures as Record<string, unknown>[]).map((row) => ({
          ...row,
          slides_json_array_len: lenByLecture.get(Number(row.id)) ?? null,
        })),
      })
    }

    return NextResponse.json({
      takenAt: new Date().toISOString(),
      instructorId,
      lectureSessionAccessTable: hasLsa,
      snapshots,
      note: hasLsa
        ? "ELEG 1301 / 1304 should list lectures with slides when course scope matches and sections ELEG1301P01 / ELEG1304P01 are linked (junction or session_access). Use ?includeCodes=ELEG1301,ELEG1304 to capture both in one response."
        : "Database has no lecture_session_access table; scope uses lectures.course_id / NULL only. linked_session_codes is always []. Add the junction table migration to link lectures to sessions.",
    })
  } catch (error) {
    console.error("[lecture-snapshot]", error)
    return NextResponse.json({ error: "Failed to build lecture snapshot" }, { status: 500 })
  }
}
