import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { resolveOptionalCourseScope } from "@/lib/optional-instructor-course-scope";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const instructorId = searchParams.get("instructorId");
    const session = searchParams.get("session") || "ALL";

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

    // Class averages by session
    const classAverages = await sql`
      SELECT 
        s.section as session,
        COUNT(sg.id) as student_count,
        AVG(sg.quiz_score) as avg_quiz,
        AVG(sg.homework_score) as avg_homework,
        AVG(sg.midterm_score) as avg_midterm,
        AVG(sg.final_score) as avg_final,
        AVG(sg.attendance_score) as avg_attendance,
        AVG(sg.project_score) as avg_project,
        AVG(sg.classroom_score) as avg_classroom,
        AVG(sg.engagement_credits) as avg_engagement,
        AVG(sg.total_score) as avg_total
      FROM student_grades sg
      JOIN students s ON sg.student_id = s.id ${gradeSessionMatch}
      WHERE 1=1 ${sessionFilter} ${courseFilter}
      GROUP BY s.section
      ORDER BY s.section
    `;

    // Grade distribution (histogram)
    const gradeDistribution = await sql`
      SELECT 
        CASE
          WHEN sg.total_score >= 90 THEN 'A'
          WHEN sg.total_score >= 80 THEN 'B'
          WHEN sg.total_score >= 70 THEN 'C'
          WHEN sg.total_score >= 60 THEN 'D'
          ELSE 'F'
        END as grade_band,
        COUNT(*) as count
      FROM student_grades sg
      JOIN students s ON sg.student_id = s.id ${gradeSessionMatch}
      WHERE 1=1 ${sessionFilter} ${courseFilter}
      GROUP BY grade_band
      ORDER BY grade_band DESC
    `;

    // Attendance-performance correlation
    const attendanceCorrelation = await sql`
      SELECT 
        CASE
          WHEN sg.attendance_score >= 90 THEN '90-100%'
          WHEN sg.attendance_score >= 80 THEN '80-89%'
          WHEN sg.attendance_score >= 70 THEN '70-79%'
          WHEN sg.attendance_score >= 60 THEN '60-69%'
          ELSE '<60%'
        END as attendance_band,
        AVG(sg.total_score) as avg_performance,
        COUNT(*) as student_count
      FROM student_grades sg
      JOIN students s ON sg.student_id = s.id ${gradeSessionMatch}
      WHERE 1=1 ${sessionFilter} ${courseFilter}
      GROUP BY attendance_band
      ORDER BY attendance_band DESC
    `;

    // Top engagement earners
    const topEngagement = await sql`
      SELECT 
        s.id as student_id,
        s.full_name,
        s.section,
        ec.total_credits,
        ec.practice_hub_credits,
        ec.playground_credits,
        ec.lecture_reading_credits
      FROM engagement_credits ec
      JOIN students s ON ec.student_id = s.id
      WHERE 1=1 ${sessionFilter} ${courseFilter}
      ORDER BY ec.total_credits DESC
      LIMIT 10
    `;

    // Students at risk (attendance < 70% AND total < 60%)
    const atRiskStudents = await sql`
      SELECT 
        s.id as student_id,
        s.full_name,
        s.section,
        s.student_id as student_number,
        sg.attendance_score,
        sg.total_score,
        sg.letter_grade
      FROM student_grades sg
      JOIN students s ON sg.student_id = s.id ${gradeSessionMatch}
      WHERE sg.attendance_score < 70 
        AND sg.total_score < 60
        AND 1=1 ${sessionFilter} ${courseFilter}
      ORDER BY sg.total_score ASC
    `;

    // Performance trends (last 30 days calculations)
    const recentCalculations = await sql`
      SELECT 
        DATE(sg.last_calculated_at) as date,
        AVG(sg.total_score) as avg_total,
        COUNT(*) as student_count
      FROM student_grades sg
      JOIN students s ON sg.student_id = s.id ${gradeSessionMatch}
      WHERE sg.last_calculated_at >= CURRENT_DATE - INTERVAL '30 days'
        AND 1=1 ${sessionFilter} ${courseFilter}
      GROUP BY DATE(sg.last_calculated_at)
      ORDER BY date DESC
      LIMIT 30
    `;

    return NextResponse.json({
      classAverages: classAverages,
      gradeDistribution: gradeDistribution,
      attendanceCorrelation: attendanceCorrelation,
      topEngagement: topEngagement,
      atRiskStudents: atRiskStudents,
      performanceTrends: recentCalculations,
    });
  } catch (error) {
    console.error("Error fetching grade analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch grade analytics" },
      { status: 500 }
    );
  }
}


