import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getStudentAttendanceSoFar } from "@/lib/attendance-percentage";
import { requireInstructorSession } from "@/lib/instructor-session-auth";
import { requireBoundStudentCaller } from "@/lib/student-api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Student attendance score.
 * Percentage = points earned on sessions marked for this student / sessions marked for this student.
 * Future/unscored sessions are excluded from the denominator.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const section = searchParams.get("section");

    if (!studentId && !section) {
      return NextResponse.json(
        { error: "Student ID or section is required" },
        { status: 400 }
      );
    }

    if (studentId) {
      const auth = await requireBoundStudentCaller(req, studentId);
      if (!auth.ok) return auth.response;
      const studentIdNum = auth.studentDbId;

      const stats = await getStudentAttendanceSoFar(
        studentIdNum,
        section ?? undefined,
      );

      const meta = await sql`
        SELECT s.id, s.student_id, s.full_name, sess.code as section
        FROM students s
        JOIN sessions sess ON s.session_id = sess.id
        WHERE s.id = ${studentIdNum}
        LIMIT 1
      `;

      if (meta.length === 0) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }

      const row = meta[0] as Record<string, unknown>;

      return NextResponse.json({
        success: true,
        attendance: {
          id: row.id,
          student_id: row.student_id,
          full_name: row.full_name,
          section: row.section,
          classes_attended: stats.classesAttended,
          /** Sessions scored so far — use as the attendance denominator. */
          total_classes: stats.sessionsScoredSoFar,
          /** All scheduled term sessions (including not yet held). */
          sessions_scheduled_total: stats.sessionsScheduledTotal,
          sessions_scored_so_far: stats.sessionsScoredSoFar,
          attendance_score_10: stats.scoreOutOf10,
          attendance_percentage: stats.percentage,
          total_points_earned: stats.pointsEarned,
        },
      });
    }

    const instructor = await requireInstructorSession(req);
    if (!instructor.ok) return instructor.response;

    // Section roster — keep legacy query shape but use scored-so-far per student
    const results = await sql`
      SELECT s.id
      FROM students s
      JOIN sessions sess ON s.session_id = sess.id
      WHERE sess.code = ${section}
      ORDER BY s.full_name
    `;

    const attendance = await Promise.all(
      (results as Array<{ id: number }>).map(async (s) => {
        const stats = await getStudentAttendanceSoFar(Number(s.id), section ?? undefined);
        const meta = await sql`
          SELECT s.id, s.student_id, s.full_name, sess.code as section
          FROM students s
          JOIN sessions sess ON s.session_id = sess.id
          WHERE s.id = ${s.id}
          LIMIT 1
        `;
        const row = meta[0] as Record<string, unknown>;
        return {
          id: row.id,
          student_id: row.student_id,
          full_name: row.full_name,
          section: row.section,
          classes_attended: stats.classesAttended,
          total_classes: stats.sessionsScoredSoFar,
          sessions_scheduled_total: stats.sessionsScheduledTotal,
          sessions_scored_so_far: stats.sessionsScoredSoFar,
          attendance_score_10: stats.scoreOutOf10,
          attendance_percentage: stats.percentage,
          total_points_earned: stats.pointsEarned,
        };
      }),
    );

    return NextResponse.json({
      success: true,
      attendance,
    });
  } catch (error) {
    console.error("Error calculating attendance score:", error);
    return NextResponse.json(
      { error: "Failed to calculate attendance score" },
      { status: 500 }
    );
  }
}
