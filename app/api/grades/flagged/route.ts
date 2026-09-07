import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { resolveOptionalCourseScope } from "@/lib/optional-instructor-course-scope";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const instructorId = searchParams.get("instructorId");
    const session = searchParams.get("session") || "ALL";
    const attendanceThreshold = parseFloat(searchParams.get("attendanceThreshold") || "70");
    const gradeThreshold = parseFloat(searchParams.get("gradeThreshold") || "60");

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

    const escSession = session.replace(/'/g, "''");
    const sessionFilter =
      session === "ALL" ? sql.unsafe("") : sql.unsafe(` AND s.section = '${escSession}'`);
    const gradeSessionMatch = sql.unsafe(
      " AND (sg.session = s.section OR sg.session = 'ALL')",
    );
    const courseFilter =
      scopedCourseId != null
        ? sql.unsafe(` AND s.course_id = ${Number(scopedCourseId)}`)
        : sql.unsafe("");

    // Flagged students: attendance < threshold OR total < threshold
    const flaggedStudents = await sql`
      SELECT 
        s.id as student_id,
        s.full_name,
        s.student_id as student_number,
        s.section,
        s.email,
        sg.attendance_score,
        sg.total_score,
        sg.letter_grade,
        sg.quiz_score,
        sg.homework_score,
        sg.midterm_score,
        sg.final_score,
        sg.project_score,
        sg.classroom_score,
        sg.engagement_credits,
        CASE
          WHEN sg.attendance_score < ${attendanceThreshold} AND sg.total_score < ${gradeThreshold} THEN 'both'
          WHEN sg.attendance_score < ${attendanceThreshold} THEN 'attendance'
          WHEN sg.total_score < ${gradeThreshold} THEN 'grade'
          ELSE 'none'
        END as flag_reason
      FROM student_grades sg
      JOIN students s ON sg.student_id = s.id ${gradeSessionMatch}
      WHERE (sg.attendance_score < ${attendanceThreshold} OR sg.total_score < ${gradeThreshold})
        AND 1=1 ${sessionFilter} ${courseFilter}
      ORDER BY sg.total_score ASC, sg.attendance_score ASC
    `;

    return NextResponse.json({
      flaggedStudents: flaggedStudents,
      thresholds: {
        attendance: attendanceThreshold,
        grade: gradeThreshold,
      },
    });
  } catch (error) {
    console.error("Error fetching flagged students:", error);
    return NextResponse.json(
      { error: "Failed to fetch flagged students" },
      { status: 500 }
    );
  }
}


