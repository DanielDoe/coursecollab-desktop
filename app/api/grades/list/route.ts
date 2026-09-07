import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { resolveOptionalCourseScope } from "@/lib/optional-instructor-course-scope";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const instructorId = searchParams.get("instructorId");
    const session = searchParams.get("session") || "ALL";
    const search = searchParams.get("search") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(10, parseInt(searchParams.get("limit") || "20", 10)));
    const offset = (page - 1) * limit;

    if (!instructorId) {
      return NextResponse.json(
        { error: "Instructor ID is required" },
        { status: 400 }
      );
    }

    const scopeMeta = await resolveOptionalCourseScope(request);
    if (!scopeMeta.ok) return scopeMeta.response;
    const scopedCourseId = scopeMeta.courseId;
    if (
      scopedCourseId != null &&
      String(scopeMeta.instructorId ?? "") !== String(instructorId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const courseRowFilter =
      scopedCourseId != null
        ? sql`AND s.course_id = ${scopedCourseId}`
        : sql``;

    const searchTrim = search.trim();
    const hasSearch = searchTrim.length > 0;
    const searchPattern = `%${searchTrim}%`;

    let grades;
    let countResult;

    if (session === "ALL") {
      if (!hasSearch) {
        grades = await sql`
      SELECT 
        s.id as student_id,
        s.full_name,
        s.student_id as student_number,
        s.email,
        s.section,
        sg.id as grade_id,
        sg.session as grade_session,
        sg.quiz_score,
        sg.homework_score,
        sg.midterm_score,
        sg.final_score,
        sg.attendance_score,
        sg.project_score,
        sg.classroom_score,
        sg.engagement_credits,
        sg.total_score,
        sg.letter_grade,
        sg.notes,
        sg.is_locked,
        sg.last_calculated_at
      FROM students s
      LEFT JOIN LATERAL (
        SELECT * FROM student_grades g
        WHERE g.student_id = s.id
          AND (TRIM(g.session) = TRIM(COALESCE(s.section, '')) OR TRIM(g.session) = 'ALL')
        ORDER BY
          CASE
            WHEN TRIM(g.session) = TRIM(COALESCE(s.section, '')) THEN 0
            WHEN TRIM(g.session) = 'ALL' THEN 1
            ELSE 2
          END
        LIMIT 1
      ) sg ON true
      WHERE TRUE ${courseRowFilter}
      ORDER BY s.full_name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
        countResult = await sql`
      SELECT COUNT(*)::int AS total
      FROM students s
      WHERE TRUE ${courseRowFilter}
    `;
      } else {
        grades = await sql`
      SELECT 
        s.id as student_id,
        s.full_name,
        s.student_id as student_number,
        s.email,
        s.section,
        sg.id as grade_id,
        sg.session as grade_session,
        sg.quiz_score,
        sg.homework_score,
        sg.midterm_score,
        sg.final_score,
        sg.attendance_score,
        sg.project_score,
        sg.classroom_score,
        sg.engagement_credits,
        sg.total_score,
        sg.letter_grade,
        sg.notes,
        sg.is_locked,
        sg.last_calculated_at
      FROM students s
      LEFT JOIN LATERAL (
        SELECT * FROM student_grades g
        WHERE g.student_id = s.id
          AND (TRIM(g.session) = TRIM(COALESCE(s.section, '')) OR TRIM(g.session) = 'ALL')
        ORDER BY
          CASE
            WHEN TRIM(g.session) = TRIM(COALESCE(s.section, '')) THEN 0
            WHEN TRIM(g.session) = 'ALL' THEN 1
            ELSE 2
          END
        LIMIT 1
      ) sg ON true
      WHERE (
        s.full_name ILIKE ${searchPattern}
        OR s.student_id::text ILIKE ${searchPattern}
        OR s.email ILIKE ${searchPattern}
      )
      ${courseRowFilter}
      ORDER BY s.full_name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
        countResult = await sql`
      SELECT COUNT(*)::int AS total
      FROM students s
      WHERE (
        s.full_name ILIKE ${searchPattern}
        OR s.student_id::text ILIKE ${searchPattern}
        OR s.email ILIKE ${searchPattern}
      )
      ${courseRowFilter}
    `;
      }
    } else if (!hasSearch) {
      grades = await sql`
      SELECT 
        s.id as student_id,
        s.full_name,
        s.student_id as student_number,
        s.email,
        s.section,
        sg.id as grade_id,
        sg.session as grade_session,
        sg.quiz_score,
        sg.homework_score,
        sg.midterm_score,
        sg.final_score,
        sg.attendance_score,
        sg.project_score,
        sg.classroom_score,
        sg.engagement_credits,
        sg.total_score,
        sg.letter_grade,
        sg.notes,
        sg.is_locked,
        sg.last_calculated_at
      FROM students s
      LEFT JOIN LATERAL (
        SELECT * FROM student_grades g
        WHERE g.student_id = s.id
          AND (
            TRIM(g.session) = TRIM(${session})
            OR TRIM(g.session) = TRIM(COALESCE(s.section, ''))
            OR TRIM(g.session) = 'ALL'
          )
        ORDER BY
          CASE
            WHEN TRIM(g.session) = TRIM(${session}) THEN 0
            WHEN TRIM(g.session) = TRIM(COALESCE(s.section, '')) THEN 1
            WHEN TRIM(g.session) = 'ALL' THEN 2
            ELSE 3
          END
        LIMIT 1
      ) sg ON true
      WHERE (
        TRIM(s.section) = TRIM(${session})
        OR EXISTS (
          SELECT 1 FROM sessions sess
          WHERE sess.id = s.session_id AND TRIM(sess.code) = TRIM(${session})
        )
      )
      ${courseRowFilter}
      ORDER BY s.full_name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
      countResult = await sql`
      SELECT COUNT(*)::int AS total
      FROM students s
      WHERE (
        TRIM(s.section) = TRIM(${session})
        OR EXISTS (
          SELECT 1 FROM sessions sess
          WHERE sess.id = s.session_id AND TRIM(sess.code) = TRIM(${session})
        )
      )
      ${courseRowFilter}
    `;
    } else {
      grades = await sql`
      SELECT 
        s.id as student_id,
        s.full_name,
        s.student_id as student_number,
        s.email,
        s.section,
        sg.id as grade_id,
        sg.session as grade_session,
        sg.quiz_score,
        sg.homework_score,
        sg.midterm_score,
        sg.final_score,
        sg.attendance_score,
        sg.project_score,
        sg.classroom_score,
        sg.engagement_credits,
        sg.total_score,
        sg.letter_grade,
        sg.notes,
        sg.is_locked,
        sg.last_calculated_at
      FROM students s
      LEFT JOIN LATERAL (
        SELECT * FROM student_grades g
        WHERE g.student_id = s.id
          AND (
            TRIM(g.session) = TRIM(${session})
            OR TRIM(g.session) = TRIM(COALESCE(s.section, ''))
            OR TRIM(g.session) = 'ALL'
          )
        ORDER BY
          CASE
            WHEN TRIM(g.session) = TRIM(${session}) THEN 0
            WHEN TRIM(g.session) = TRIM(COALESCE(s.section, '')) THEN 1
            WHEN TRIM(g.session) = 'ALL' THEN 2
            ELSE 3
          END
        LIMIT 1
      ) sg ON true
      WHERE (
        TRIM(s.section) = TRIM(${session})
        OR EXISTS (
          SELECT 1 FROM sessions sess
          WHERE sess.id = s.session_id AND TRIM(sess.code) = TRIM(${session})
        )
      )
      AND (
        s.full_name ILIKE ${searchPattern}
        OR s.student_id::text ILIKE ${searchPattern}
        OR s.email ILIKE ${searchPattern}
      )
      ${courseRowFilter}
      ORDER BY s.full_name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
      countResult = await sql`
      SELECT COUNT(*)::int AS total
      FROM students s
      WHERE (
        TRIM(s.section) = TRIM(${session})
        OR EXISTS (
          SELECT 1 FROM sessions sess
          WHERE sess.id = s.session_id AND TRIM(sess.code) = TRIM(${session})
        )
      )
      AND (
        s.full_name ILIKE ${searchPattern}
        OR s.student_id::text ILIKE ${searchPattern}
        OR s.email ILIKE ${searchPattern}
      )
      ${courseRowFilter}
    `;
    }

    const total = countResult![0]?.total ?? 0;

    return NextResponse.json({
      grades,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching grade list:", error);
    return NextResponse.json(
      { error: "Failed to fetch grade list" },
      { status: 500 }
    );
  }
}
