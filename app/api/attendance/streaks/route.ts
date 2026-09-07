import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireInstructorSession } from "@/lib/instructor-session-auth";
import { requireBoundStudentCaller } from "@/lib/student-api-auth";
import { countTermAttendanceRecords, getEnrollmentAttendanceWindow } from "@/lib/attendance-enrollment-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json(
        { error: "Student ID is required" },
        { status: 400 }
      );
    }

    const instructorClaim = req.headers.get("x-instructor-id")?.trim();
    let streakStudentId: string | number = studentId
    if (instructorClaim) {
      const instructor = await requireInstructorSession(req);
      if (!instructor.ok) return instructor.response;
    } else {
      const auth = await requireBoundStudentCaller(req, studentId);
      if (!auth.ok) return auth.response;
      streakStudentId = auth.studentDbId
      const window = await getEnrollmentAttendanceWindow(auth.studentDbId)
      const termMarks = window ? await countTermAttendanceRecords(auth.studentDbId, window) : 0
      if (termMarks === 0) {
        return NextResponse.json({
          success: true,
          streak: {
            currentStreak: 0,
            longestStreak: 0,
            totalPoints: 0,
            badges: [],
          },
        })
      }
    }

    // Get streak data
    const streak = await sql`
      SELECT * FROM attendance_streaks
      WHERE student_id = ${streakStudentId}
    `;

    if (streak.length === 0) {
      return NextResponse.json({
        success: true,
        streak: {
          currentStreak: 0,
          longestStreak: 0,
          totalPoints: 0,
          badges: [],
        },
      });
    }

    const streakData = streak[0];

    // Calculate next milestone
    let nextMilestone = 5;
    if (streakData.current_streak >= 5) nextMilestone = 10;
    if (streakData.current_streak >= 10) nextMilestone = 20;
    if (streakData.current_streak >= 20) nextMilestone = 30;

    return NextResponse.json({
      success: true,
      streak: {
        currentStreak: streakData.current_streak,
        longestStreak: streakData.longest_streak,
        totalPoints: streakData.total_points,
        badges: streakData.badges || [],
        lastAttendanceDate: streakData.last_attendance_date,
        nextMilestone,
        daysToMilestone: nextMilestone - streakData.current_streak,
      },
    });
  } catch {
    // Empty term / missing streak row is not an error — student widgets expect 0.
    return NextResponse.json({
      success: true,
      streak: {
        currentStreak: 0,
        longestStreak: 0,
        totalPoints: 0,
        badges: [],
      },
    })
  }
}

