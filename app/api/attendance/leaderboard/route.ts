import { NextRequest, NextResponse } from "next/server";

import { sql } from "@/lib/db";

import { enrichWithAttendanceSoFar, getStudentAttendanceSoFar } from "@/lib/attendance-percentage";
import { getCourseSectionAttendanceWindow, getEnrollmentAttendanceWindow, listTermAttendanceLeaderboard } from "@/lib/attendance-enrollment-scope";
import { loadAttendanceScopeWindow } from "@/lib/attendance-instructor-scope";
import { getAttendancePolicyForStudent } from "@/lib/attendance-policy.server";
import { requireInstructorAttendanceAccess } from "@/lib/instructor-attendance-auth";
import { instructorOwnsSectionVariants } from "@/lib/instructor-section-auth";
import { requireBoundStudentCaller } from "@/lib/student-api-auth";
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope";
import { isCurrentStudent, sanitizeLeaderboardForStudent } from "@/lib/student-privacy";
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases";



export const runtime = "nodejs";

export const dynamic = "force-dynamic";



function enrichLeaderboardEntry(entry: any, index: number) {

  let existingBadges = [];

  try {

    existingBadges = entry.badges ? JSON.parse(entry.badges) : [];

  } catch {

    existingBadges = [];

  }



  const earnedBadges = [...existingBadges];



  if (index < 3) {

    earnedBadges.push({ type: "top3", name: "Top 3", icon: "🏆" });

  }

  if (entry.attendance_percentage === 100) {

    earnedBadges.push({ type: "perfect", name: "Perfect Attendance", icon: "🎯" });

  }

  if (entry.current_streak >= 10) {

    earnedBadges.push({ type: "streak10", name: "10-Day Streak", icon: "🔥" });

  }

  if (entry.current_streak >= 20) {

    earnedBadges.push({ type: "streak20", name: "20-Day Streak", icon: "⚡" });

  }

  if (entry.attendance_percentage >= 95) {

    earnedBadges.push({ type: "high_attendance", name: "95% Club", icon: "⭐" });

  }



  return {

    ...entry,

    badges: earnedBadges,

    rank: entry.rank ?? index + 1,

  };

}



async function getCurrentStudentLeaderboardEntry(
  section: string,
  studentId: string,
  termRow?: { total_points: number; classes_attended: number; rank: number } | null,
) {
  const window = await getEnrollmentAttendanceWindow(Number(studentId));
  if (!window) return null;

  const rows = await sql`
    SELECT
      s.id,
      s.full_name,
      s.student_id,
      s.section
    FROM students s
    WHERE s.id = ${studentId}
    LIMIT 1
  `;

  if (!rows.length) return null;

  const stats = await getStudentAttendanceSoFar(Number(studentId), section);
  const entry = {
    ...rows[0],
    rank: termRow?.rank ?? 0,
    current_streak: 0,
    longest_streak: 0,
    total_points: termRow?.total_points ?? stats.pointsEarned,
    badges: "[]",
    attendance_percentage: stats.percentage,
    total_classes: stats.sessionsScoredSoFar,
    classes_attended: termRow?.classes_attended ?? stats.classesAttended,
  };

  return enrichLeaderboardEntry(entry, Number(entry.rank) - 1);
}



function studentMayViewSection(
  ctx: { section: string | null; sessionCode: string | null },
  requestedSection: string,
): boolean {
  const allowed = new Set<string>();
  for (const raw of [ctx.section, ctx.sessionCode]) {
    if (raw?.trim()) {
      for (const variant of normalizedSectionVariantsForSql(raw)) allowed.add(variant);
    }
  }
  if (allowed.size === 0) return false;
  return normalizedSectionVariantsForSql(requestedSection).some((variant) => allowed.has(variant));
}

export async function GET(req: NextRequest) {

  try {

    const { searchParams } = new URL(req.url);

    const section = searchParams.get("section");

    const limit = parseInt(searchParams.get("limit") || "50");



    if (!section) {

      return NextResponse.json(

        { error: "Section is required" },

        { status: 400 }

      );

    }

    const instructorClaim = req.headers.get("x-instructor-id")?.trim();
    let isStudentView = false;
    let viewerStudentId: string | null = null;
    let instructorCourseId: number | null = null;

    if (instructorClaim) {
      const attendanceAuth = await requireInstructorAttendanceAccess(req);
      if (!attendanceAuth.ok) return attendanceAuth.response;
      instructorCourseId = attendanceAuth.courseId ?? null;

      const variants = normalizedSectionVariantsForSql(section);
      const ownsSection = await instructorOwnsSectionVariants(
        attendanceAuth.actorId,
        variants,
        attendanceAuth.courseId,
      );
      if (!ownsSection) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    } else {
      const bound = await requireBoundStudentCaller(req, req.headers.get("x-student-id"));
      if (!bound.ok) return bound.response;

      const ctx = await resolveStudentCourseContextByDbId(bound.studentDbId);
      if (!ctx || !studentMayViewSection(ctx, section)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      isStudentView = true;
      viewerStudentId = String(bound.studentDbId);
    }



    let attendanceWindow = null
    if (isStudentView && viewerStudentId) {
      attendanceWindow = await getEnrollmentAttendanceWindow(Number(viewerStudentId))
    } else if (instructorCourseId != null) {
      attendanceWindow = await loadAttendanceScopeWindow(req, instructorCourseId, section)
    }

    const leaderboard = attendanceWindow
      ? await listTermAttendanceLeaderboard(attendanceWindow, limit)
      : []

    const enrichedLeaderboard = await enrichWithAttendanceSoFar(
      leaderboard as Array<{ id: number }>,
      section,
    );



    const withBadges = enrichedLeaderboard.map((entry: any, index: number) =>
      enrichLeaderboardEntry({ ...entry, rank: entry.rank ?? index + 1 }, index)
    );

    if (isStudentView && viewerStudentId) {
      const attendancePolicy = await getAttendancePolicyForStudent(Number(viewerStudentId));
      const blurPeerNames = attendancePolicy.blur_leaderboard_peer_names === true;
      const selfRow = withBadges.find((entry: { id?: number }) =>
        isCurrentStudent(entry.id, viewerStudentId),
      )
      const currentStudent = await getCurrentStudentLeaderboardEntry(
        section,
        viewerStudentId,
        selfRow
          ? {
              total_points: Number((selfRow as { total_points?: number }).total_points) || 0,
              classes_attended: Number((selfRow as { classes_attended?: number }).classes_attended) || 0,
              rank: Number((selfRow as { rank?: number }).rank) || 0,
            }
          : null,
      );

      const responseLeaderboard = blurPeerNames
        ? sanitizeLeaderboardForStudent(withBadges, viewerStudentId, { idFields: ["id"] })
        : withBadges.map((entry: any, index: number) => ({
            ...entry,
            rank: Number(entry.rank ?? index + 1),
            is_current_user: isCurrentStudent(entry.id, viewerStudentId),
          }));

      return NextResponse.json({
        success: true,
        leaderboard: responseLeaderboard,
        currentStudent: currentStudent
          ? { ...currentStudent, is_current_user: true }
          : null,
        total: enrichedLeaderboard.length,
        privacyMode: blurPeerNames,
        leaderboardPrivacy: { blurPeerNames },
      });
    }

    return NextResponse.json({
      success: true,
      leaderboard: withBadges,
      total: withBadges.length,
      privacyMode: false,
      leaderboardPrivacy: { blurPeerNames: false },
    });

  } catch {
    // Empty term / missing rows is not an error — student attendance widgets expect [].
    return NextResponse.json({
      success: true,
      leaderboard: [],
      currentStudent: null,
      total: 0,
      privacyMode: false,
      leaderboardPrivacy: { blurPeerNames: false },
    })
  }
}


