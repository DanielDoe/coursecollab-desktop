import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireInstructorAttendanceAccess } from "@/lib/instructor-attendance-auth";
import { resolveOptionalCourseScope } from "@/lib/optional-instructor-course-scope";
import {
  sqlAttendanceCanonicalSessionId,
  sqlAttendanceSessionScope,
  sqlPlatformSessionRowScope,
} from "@/lib/attendance-instructor-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const attendanceAuth = await requireInstructorAttendanceAccess(req);
    if (!attendanceAuth.ok) return attendanceAuth.response;

    const scoped = await resolveOptionalCourseScope(req);
    if (!scoped.ok) return scoped.response;

    const { searchParams } = new URL(req.url);
    const instructorId = searchParams.get("instructorId");
    const section = searchParams.get("section");

    if (!instructorId && !section) {
      return NextResponse.json(
        { error: "Instructor ID or section is required" },
        { status: 400 }
      );
    }

    if (instructorId && String(instructorId) !== String(attendanceAuth.actorId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const scopedCourseId = scoped.courseId;

    const instNumeric = instructorId ? Number(instructorId) : NaN;
    if (instructorId != null && instructorId !== "" && !Number.isFinite(instNumeric)) {
      return NextResponse.json({ error: "Invalid instructor ID" }, { status: 400 });
    }

    const asessCourseFrag =
      scopedCourseId != null
        ? await sqlAttendanceSessionScope(req, scopedCourseId)
        : sql.unsafe("")

    const asessInstCourseFrag =
      scopedCourseId != null
        ? await sqlAttendanceSessionScope(req, scopedCourseId, "asess_inst")
        : sql.unsafe("")

    const asessInstructorIdFrag =
      scopedCourseId != null
        ? sql.unsafe("")
        : sql.unsafe(` AND asess.instructor_id = ${instNumeric}`)

    const attendanceSessionsInstructorAndFrag =
      scopedCourseId != null
        ? sql.unsafe("")
        : sql.unsafe(` AND instructor_id = ${instNumeric}`)

    const attendanceSessionsCourseSectionsFrag =
      scopedCourseId != null
        ? await sqlAttendanceSessionScope(req, scopedCourseId, "asess")
        : sql.unsafe("")

    const sessCourseFrag =
      scopedCourseId != null
        ? await sqlPlatformSessionRowScope(req, scopedCourseId)
        : sql.unsafe("")

    const asessNotCancelledFrag = sql.unsafe(`
      AND COALESCE(asess.is_cancelled, false) = false`)

    const attendanceSessionsNotCancelledFrag = sql.unsafe(`
      AND COALESCE(is_cancelled, false) = false`)

    const canonicalSessionIdExpr =
      scopedCourseId != null
        ? await sqlAttendanceCanonicalSessionId(req, scopedCourseId, "asess.section")
        : sql.unsafe(`(
            SELECT MIN(sess.id) FROM sessions sess
            WHERE TRIM(sess.code) = TRIM(asess.section)
          )`)

    // 1. Overall stats
    const overallStats = instructorId
      ? await sql`
          SELECT 
            COUNT(DISTINCT asess.id) as total_sessions,
            COUNT(DISTINCT ar.student_id) as unique_students,
            COUNT(ar.id) as total_check_ins,
            ROUND(AVG(CASE WHEN ar.geo_verified THEN 100 ELSE 0 END), 2) as geo_verification_rate,
            ROUND(
              (COUNT(ar.id)::decimal / NULLIF(COUNT(DISTINCT asess.id) * COUNT(DISTINCT s.id), 0)) * 100,
              2
            ) as average_attendance_rate
          FROM attendance_sessions asess
          LEFT JOIN attendance_records ar ON asess.id = ar.session_id
          LEFT JOIN students s ON s.session_id = ${canonicalSessionIdExpr}
          WHERE 1=1
            ${asessInstructorIdFrag}
            ${asessCourseFrag}
            ${asessNotCancelledFrag}
        `
      : await sql`
          SELECT 
            COUNT(DISTINCT asess.id) as total_sessions,
            COUNT(DISTINCT ar.student_id) as unique_students,
            COUNT(ar.id) as total_check_ins,
            ROUND(AVG(CASE WHEN ar.geo_verified THEN 100 ELSE 0 END), 2) as geo_verification_rate,
            ROUND(
              (COUNT(ar.id)::decimal / NULLIF(COUNT(DISTINCT asess.id) * COUNT(DISTINCT s.id), 0)) * 100,
              2
            ) as average_attendance_rate
          FROM attendance_sessions asess
          LEFT JOIN attendance_records ar ON asess.id = ar.session_id
          LEFT JOIN students s ON s.session_id = ${canonicalSessionIdExpr}
          WHERE asess.section = ${section}
            ${asessNotCancelledFrag}
        `;

    // 2. Students with low attendance (< 70%) — attended ÷ sessions marked for each student
    const flaggedStudents = instructorId
      ? await sql`
          SELECT 
            s.id,
            s.full_name,
            s.student_id,
            sess.code as section,
            COUNT(*) FILTER (WHERE COALESCE(ar.points_earned, 0) > 0)::int as classes_attended,
            COUNT(ar.id)::int as total_classes,
            ROUND(
              (COALESCE(SUM(ar.points_earned), 0)::decimal / NULLIF(COUNT(ar.id), 0)) * 100,
              2
            ) as attendance_percentage
          FROM students s
          JOIN sessions sess ON s.session_id = sess.id
          LEFT JOIN attendance_records ar ON s.id = ar.student_id
          LEFT JOIN attendance_sessions asess ON ar.session_id = asess.id
            AND COALESCE(asess.is_cancelled, false) = false
            AND asess.start_time <= NOW()
            AND TRIM(asess.section) = TRIM(sess.code)
          WHERE 1=1
            ${sessCourseFrag}
            AND EXISTS (
              SELECT 1 FROM attendance_sessions asess_inst
              WHERE TRIM(asess_inst.section) = TRIM(sess.code)
                ${asessInstructorIdFrag}
                ${asessNotCancelledFrag}
                ${asessInstCourseFrag}
            )
          GROUP BY s.id, s.full_name, s.student_id, sess.code
          HAVING COUNT(ar.id) > 0
            AND (COALESCE(SUM(ar.points_earned), 0)::decimal / NULLIF(COUNT(ar.id), 0)) * 100 < 70
          ORDER BY attendance_percentage ASC
          LIMIT 10
        `
      : await sql`
          SELECT 
            s.id,
            s.full_name,
            s.student_id,
            sess.code as section,
            COUNT(*) FILTER (WHERE COALESCE(ar.points_earned, 0) > 0)::int as classes_attended,
            COUNT(ar.id)::int as total_classes,
            ROUND(
              (COALESCE(SUM(ar.points_earned), 0)::decimal / NULLIF(COUNT(ar.id), 0)) * 100,
              2
            ) as attendance_percentage
          FROM students s
          JOIN sessions sess ON s.session_id = sess.id
          LEFT JOIN attendance_records ar ON s.id = ar.student_id
          LEFT JOIN attendance_sessions asess ON ar.session_id = asess.id
            AND COALESCE(asess.is_cancelled, false) = false
            AND asess.start_time <= NOW()
            AND TRIM(asess.section) = TRIM(sess.code)
          WHERE sess.code = ${section}
          GROUP BY s.id, s.full_name, s.student_id, sess.code
          HAVING COUNT(ar.id) > 0
            AND (COALESCE(SUM(ar.points_earned), 0)::decimal / NULLIF(COUNT(ar.id), 0)) * 100 < 70
          ORDER BY attendance_percentage ASC
          LIMIT 10
        `;

    // 3. Top performers — attended ÷ sessions marked for each student
    const topPerformers = instructorId
      ? await sql`
          SELECT 
            s.id,
            s.full_name,
            s.student_id,
            sess.code as section,
            COUNT(*) FILTER (WHERE COALESCE(ar.points_earned, 0) > 0)::int as classes_attended,
            COUNT(ar.id)::int as total_classes,
            ROUND(
              (COALESCE(SUM(ar.points_earned), 0)::decimal / NULLIF(COUNT(ar.id), 0)) * 100,
              2
            ) as attendance_percentage,
            COALESCE(astreak.current_streak, 0) as current_streak
          FROM students s
          JOIN sessions sess ON s.session_id = sess.id
          LEFT JOIN attendance_records ar ON s.id = ar.student_id
          LEFT JOIN attendance_sessions asess ON ar.session_id = asess.id
            AND COALESCE(asess.is_cancelled, false) = false
            AND asess.start_time <= NOW()
            AND TRIM(asess.section) = TRIM(sess.code)
          LEFT JOIN attendance_streaks astreak ON s.id = astreak.student_id
          WHERE 1=1
            ${sessCourseFrag}
            AND EXISTS (
              SELECT 1 FROM attendance_sessions asess_inst
              WHERE TRIM(asess_inst.section) = TRIM(sess.code)
                ${asessInstructorIdFrag}
                ${asessNotCancelledFrag}
                ${asessInstCourseFrag}
            )
          GROUP BY s.id, s.full_name, s.student_id, sess.code, astreak.current_streak
          HAVING COUNT(ar.id) > 0
          ORDER BY attendance_percentage DESC, current_streak DESC
          LIMIT 5
        `
      : await sql`
          SELECT 
            s.id,
            s.full_name,
            s.student_id,
            sess.code as section,
            COUNT(*) FILTER (WHERE COALESCE(ar.points_earned, 0) > 0)::int as classes_attended,
            COUNT(ar.id)::int as total_classes,
            ROUND(
              (COALESCE(SUM(ar.points_earned), 0)::decimal / NULLIF(COUNT(ar.id), 0)) * 100,
              2
            ) as attendance_percentage,
            COALESCE(astreak.current_streak, 0) as current_streak
          FROM students s
          JOIN sessions sess ON s.session_id = sess.id
          LEFT JOIN attendance_records ar ON s.id = ar.student_id
          LEFT JOIN attendance_sessions asess ON ar.session_id = asess.id
            AND COALESCE(asess.is_cancelled, false) = false
            AND asess.start_time <= NOW()
            AND TRIM(asess.section) = TRIM(sess.code)
          LEFT JOIN attendance_streaks astreak ON s.id = astreak.student_id
          WHERE sess.code = ${section}
          GROUP BY s.id, s.full_name, s.student_id, sess.code, astreak.current_streak
          HAVING COUNT(ar.id) > 0
          ORDER BY attendance_percentage DESC, current_streak DESC
          LIMIT 5
        `;

    // 4. Weekly attendance trend (last 8 weeks)
    // First, get the total student count for the section(s)
    let totalStudentsCount: number;
    if (instructorId) {
      const studentCountResult =
        scopedCourseId != null
          ? await sql`
        SELECT COUNT(DISTINCT s.id) as total
        FROM students s
        JOIN sessions sess ON s.session_id = sess.id
        WHERE sess.course_id = ${scopedCourseId}
          AND sess.code IN (
          SELECT DISTINCT section 
          FROM attendance_sessions asess
          WHERE 1=1
            ${attendanceSessionsCourseSectionsFrag}
            ${asessNotCancelledFrag}
        )
      `
          : await sql`
        SELECT COUNT(DISTINCT s.id) as total
        FROM students s
        JOIN sessions sess ON s.session_id = sess.id
        WHERE sess.code IN (
          SELECT DISTINCT section 
          FROM attendance_sessions
          WHERE 1=1
            ${attendanceSessionsInstructorAndFrag}
            ${attendanceSessionsNotCancelledFrag}
        )
      `;
      totalStudentsCount = Number(studentCountResult[0]?.total || 0);
    } else {
      const studentCountResult = await sql`
        SELECT COUNT(DISTINCT s.id) as total
        FROM students s
        JOIN sessions sess ON s.session_id = sess.id
        WHERE sess.code = ${section}
      `;
      totalStudentsCount = Number(studentCountResult[0]?.total || 0);
    }

    const weeklyTrend = instructorId
      ? await sql`
          SELECT 
            DATE_TRUNC('week', asess.start_time) as week,
            COUNT(DISTINCT ar.id) as check_ins,
            COUNT(DISTINCT asess.id) as sessions,
            ROUND(
              (COUNT(DISTINCT ar.id)::decimal / NULLIF(COUNT(DISTINCT asess.id) * ${totalStudentsCount}, 0)) * 100,
              2
            ) as attendance_rate
          FROM attendance_sessions asess
          LEFT JOIN attendance_records ar ON asess.id = ar.session_id
          WHERE 1=1
            ${asessInstructorIdFrag}
            AND asess.start_time >= NOW() - INTERVAL '8 weeks'
            ${asessCourseFrag}
          GROUP BY DATE_TRUNC('week', asess.start_time)
          ORDER BY week DESC
        `
      : await sql`
          SELECT 
            DATE_TRUNC('week', asess.start_time) as week,
            COUNT(DISTINCT ar.id) as check_ins,
            COUNT(DISTINCT asess.id) as sessions,
            ROUND(
              (COUNT(DISTINCT ar.id)::decimal / NULLIF(COUNT(DISTINCT asess.id) * ${totalStudentsCount}, 0)) * 100,
              2
            ) as attendance_rate
          FROM attendance_sessions asess
          LEFT JOIN attendance_records ar ON asess.id = ar.session_id
          WHERE asess.section = ${section}
            ${asessNotCancelledFrag}
            AND asess.start_time >= NOW() - INTERVAL '8 weeks'
          GROUP BY DATE_TRUNC('week', asess.start_time)
          ORDER BY week DESC
        `;

    // 5. Session-wise breakdown
    const sessionBreakdown = instructorId
      ? await sql`
          SELECT 
            asess.id,
            asess.class_title,
            asess.start_time,
            asess.section,
            COUNT(ar.id) as total_attended,
            COUNT(DISTINCT s.id) as total_students,
            ROUND(
              (COUNT(ar.id)::decimal / NULLIF(COUNT(DISTINCT s.id), 0)) * 100,
              2
            ) as attendance_percentage
          FROM attendance_sessions asess
          JOIN students s ON s.session_id = ${canonicalSessionIdExpr}
          LEFT JOIN attendance_records ar ON asess.id = ar.session_id AND s.id = ar.student_id
          WHERE 1=1
            ${asessInstructorIdFrag}
            ${asessCourseFrag}
            ${asessNotCancelledFrag}
          GROUP BY asess.id, asess.class_title, asess.start_time, asess.section
          ORDER BY asess.start_time DESC
          LIMIT 20
        `
      : await sql`
          SELECT 
            asess.id,
            asess.class_title,
            asess.start_time,
            asess.section,
            COUNT(ar.id) as total_attended,
            COUNT(DISTINCT s.id) as total_students,
            ROUND(
              (COUNT(ar.id)::decimal / NULLIF(COUNT(DISTINCT s.id), 0)) * 100,
              2
            ) as attendance_percentage
          FROM attendance_sessions asess
          JOIN students s ON s.session_id = ${canonicalSessionIdExpr}
          LEFT JOIN attendance_records ar ON asess.id = ar.session_id AND s.id = ar.student_id
          WHERE asess.section = ${section}
            ${asessNotCancelledFrag}
          GROUP BY asess.id, asess.class_title, asess.start_time, asess.section
          ORDER BY asess.start_time DESC
          LIMIT 20
        `;

    // 6. Status breakdown (present / late / excused / absent)
    const statusBreakdown = instructorId
      ? await sql`
          SELECT ar.status, COUNT(*)::int AS count
          FROM attendance_records ar
          INNER JOIN attendance_sessions asess ON ar.session_id = asess.id
          WHERE 1=1
            ${asessInstructorIdFrag}
            ${asessCourseFrag}
            ${asessNotCancelledFrag}
          GROUP BY ar.status
          ORDER BY count DESC
        `
      : await sql`
          SELECT ar.status, COUNT(*)::int AS count
          FROM attendance_records ar
          INNER JOIN attendance_sessions asess ON ar.session_id = asess.id
          WHERE asess.section = ${section}
            ${asessNotCancelledFrag}
          GROUP BY ar.status
          ORDER BY count DESC
        `;

    // 7. Per-student credit-based summary (attended ÷ sessions marked for each student)
    const studentSummaries = instructorId
      ? await sql`
          SELECT
            s.id,
            s.full_name,
            s.student_id,
            sess.code AS section,
            COUNT(ar.id)::int AS total_classes,
            COALESCE(SUM(ar.points_earned), 0)::float AS credits_earned,
            COUNT(*) FILTER (WHERE ar.status = 'present')::int AS present_count,
            COUNT(*) FILTER (WHERE ar.status = 'late')::int AS late_count,
            COUNT(*) FILTER (WHERE ar.status = 'excused')::int AS excused_count,
            COUNT(*) FILTER (WHERE ar.status = 'absent')::int AS absent_count,
            ROUND(
              (COALESCE(SUM(ar.points_earned), 0)::decimal / NULLIF(COUNT(ar.id), 0)) * 100,
              2
            ) AS attendance_percentage,
            COALESCE(astreak.current_streak, 0)::int AS current_streak
          FROM students s
          INNER JOIN sessions sess ON s.session_id = sess.id
          LEFT JOIN attendance_records ar ON ar.student_id = s.id
          LEFT JOIN attendance_sessions asess
            ON ar.session_id = asess.id
            AND COALESCE(asess.is_cancelled, false) = false
            AND asess.start_time <= NOW()
            AND TRIM(asess.section) = TRIM(sess.code)
          LEFT JOIN attendance_streaks astreak ON astreak.student_id = s.id
          WHERE 1=1
            ${sessCourseFrag}
            AND EXISTS (
              SELECT 1 FROM attendance_sessions asess_inst
              WHERE TRIM(asess_inst.section) = TRIM(sess.code)
                ${asessInstructorIdFrag}
                ${asessNotCancelledFrag}
                ${asessInstCourseFrag}
            )
          GROUP BY s.id, s.full_name, s.student_id, sess.code, astreak.current_streak
          ORDER BY attendance_percentage DESC NULLS LAST, credits_earned DESC
        `
      : await sql`
          SELECT
            s.id,
            s.full_name,
            s.student_id,
            sess.code AS section,
            COUNT(ar.id)::int AS total_classes,
            COALESCE(SUM(ar.points_earned), 0)::float AS credits_earned,
            COUNT(*) FILTER (WHERE ar.status = 'present')::int AS present_count,
            COUNT(*) FILTER (WHERE ar.status = 'late')::int AS late_count,
            COUNT(*) FILTER (WHERE ar.status = 'excused')::int AS excused_count,
            COUNT(*) FILTER (WHERE ar.status = 'absent')::int AS absent_count,
            ROUND(
              (COALESCE(SUM(ar.points_earned), 0)::decimal / NULLIF(COUNT(ar.id), 0)) * 100,
              2
            ) AS attendance_percentage,
            COALESCE(astreak.current_streak, 0)::int AS current_streak
          FROM students s
          INNER JOIN sessions sess ON s.session_id = sess.id
          LEFT JOIN attendance_records ar ON ar.student_id = s.id
          LEFT JOIN attendance_sessions asess
            ON ar.session_id = asess.id
            AND COALESCE(asess.is_cancelled, false) = false
            AND asess.start_time <= NOW()
            AND TRIM(asess.section) = TRIM(sess.code)
          LEFT JOIN attendance_streaks astreak ON astreak.student_id = s.id
          WHERE sess.code = ${section}
          GROUP BY s.id, s.full_name, s.student_id, sess.code, astreak.current_streak
          ORDER BY attendance_percentage DESC NULLS LAST, credits_earned DESC
        `;

    const studentSummariesRows = Array.isArray(studentSummaries) ? studentSummaries : []

    const excusedStudents = studentSummariesRows
      .filter((s: { excused_count: number }) => Number(s.excused_count) > 0)
      .sort((a: { excused_count: number }, b: { excused_count: number }) => Number(b.excused_count) - Number(a.excused_count))
      .slice(0, 10);

    const chronicAbsentees = studentSummariesRows
      .filter((s: { absent_count: number }) => Number(s.absent_count) >= 1)
      .sort((a: { absent_count: number }, b: { absent_count: number }) => Number(b.absent_count) - Number(a.absent_count))
      .slice(0, 10);

    const creditLeaderboard = studentSummariesRows
      .filter((s: { credits_earned: number }) => Number(s.credits_earned) > 0)
      .slice(0, 10);

    const creditFlagged = studentSummariesRows
      .filter((s: { attendance_percentage: number | null; total_classes: number }) => {
        const pct = Number(s.attendance_percentage ?? 0);
        return pct < 70 && Number(s.total_classes) > 0;
      })
      .slice(0, 10);

    const overallRow = Array.isArray(overallStats) ? overallStats[0] : undefined

    return NextResponse.json({
      success: true,
      analytics: {
        overall: overallRow,
        flaggedStudents: creditFlagged.length > 0 ? creditFlagged : flaggedStudents,
        topPerformers: creditLeaderboard.length > 0 ? creditLeaderboard : topPerformers,
        weeklyTrend,
        sessionBreakdown,
        statusBreakdown,
        excusedStudents,
        chronicAbsentees,
        studentSummaries: studentSummariesRows,
      },
    });
  } catch (error) {
    console.error("Error fetching attendance analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch attendance analytics" },
      { status: 500 }
    );
  }
}

