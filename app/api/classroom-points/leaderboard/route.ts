import { NextRequest, NextResponse } from "next/server";
import { getSQL } from "@/lib/db";
import { getClassroomLeaderboardBlurPeerNames } from "@/lib/classroom-points-leaderboard-privacy";
import { getClassroomStudentSubmissionBlocks } from "@/lib/classroom-points-student-display";
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope";
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id";
import { isCurrentStudent, sanitizeLeaderboardForStudent } from "@/lib/student-privacy";
import { sqlInstructorStudentScope } from "@/lib/classroom-points-term-scope";
import { classroomPointsLeaderboardForCurrentOffering } from "@/lib/classroom-points-leaderboard-scope";

const sql = getSQL();

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET - Fetch classroom points leaderboard
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const session = searchParams.get("session");
    const limit = parseInt(searchParams.get("limit") || "50");
    const { requireClassroomPointsRead } = await import("@/lib/classroom-points-request-auth")
    const access = await requireClassroomPointsRead(request)
    if (!access.ok) return access.response
    const studentId = access.role === "student" ? String(access.studentDbId) : searchParams.get("studentId");
    const instructorAuth = access.role === "instructor" ? String(access.instructorId) : null;
    const isStudentView = access.role === "student";
    const courseId = access.role === "instructor" ? access.courseId : null;

    let studentSessionId: number | null = null;
    if (isStudentView && studentId) {
      const numericStudentId = await resolveStudentDatabaseIdFromParam(String(studentId));
      if (numericStudentId != null) {
        const studentCtx = await resolveStudentCourseContextByDbId(numericStudentId);
        studentSessionId = studentCtx?.sessionId ?? null;
      }
    }

    const studentScope =
      access.role === "instructor" && courseId != null
        ? await sqlInstructorStudentScope(request, courseId, sql, { sessionCode: session })
        : studentSessionId != null
          ? sql` AND s.session_id = ${studentSessionId}`
          : sql``;

    let leaderboard;

    if (session) {
      // Session-specific leaderboard: only points earned in that course session (matches student totals when ?session= is used)
      leaderboard = await sql`
        SELECT 
          s.id as student_id,
          s.student_id as student_number,
          s.full_name,
          s.section as session,
          COALESCE(SUM(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.points ELSE 0 END), 0) as total_points,
          COUNT(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.id END) as award_count,
          MAX(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.awarded_at END) as last_awarded,
          ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.points ELSE 0 END), 0) DESC) as rank
        FROM students s
        LEFT JOIN classroom_points cp ON s.id = cp.student_id
          AND (cp.status = 'approved' OR cp.status IS NULL)
          AND TRIM(UPPER(COALESCE(cp.session, s.section, ''))) = TRIM(UPPER(${session}))
        WHERE 1 = 1
          ${studentScope}
        GROUP BY s.id, s.student_id, s.full_name, s.section
        HAVING COALESCE(SUM(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.points ELSE 0 END), 0) > 0
        ORDER BY total_points DESC, s.full_name ASC
        LIMIT ${limit}
      `;
    } else {
      // Global leaderboard
      leaderboard = await sql`
        SELECT 
          s.id as student_id,
          s.student_id as student_number,
          s.full_name,
          s.section as session,
          COALESCE(SUM(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.points ELSE 0 END), 0) as total_points,
          COUNT(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.id END) as award_count,
          MAX(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.awarded_at END) as last_awarded,
          ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.points ELSE 0 END), 0) DESC) as rank
        FROM students s
        LEFT JOIN classroom_points cp ON s.id = cp.student_id AND (cp.status = 'approved' OR cp.status IS NULL)
        WHERE 1 = 1
          ${studentScope}
        GROUP BY s.id, s.student_id, s.full_name, s.section
        HAVING COALESCE(SUM(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.points ELSE 0 END), 0) > 0
        ORDER BY total_points DESC, s.full_name ASC
        LIMIT ${limit}
      `;
    }

    // Get statistics (only approved points)
    let stats;
    if (access.role === "instructor" && courseId != null) {
      stats = await sql`
        SELECT 
          COUNT(DISTINCT cp.student_id) as total_students,
          SUM(cp.points) as total_points_awarded,
          AVG(cp.points) as avg_points_per_award,
          COUNT(*) as total_awards
        FROM classroom_points cp
        JOIN students s ON s.id = cp.student_id
        WHERE (cp.status = 'approved' OR cp.status IS NULL)
          ${studentScope}
      `;
    } else if (session) {
      stats = await sql`
        SELECT 
          COUNT(DISTINCT student_id) as total_students,
          SUM(points) as total_points_awarded,
          AVG(points) as avg_points_per_award,
          COUNT(*) as total_awards
        FROM classroom_points
        WHERE (status = 'approved' OR status IS NULL)
          AND session = ${session}
      `;
    } else {
      stats = await sql`
        SELECT 
          COUNT(DISTINCT student_id) as total_students,
          SUM(points) as total_points_awarded,
          AVG(points) as avg_points_per_award,
          COUNT(*) as total_awards
        FROM classroom_points
        WHERE (status = 'approved' OR status IS NULL)
      `;
    }

    // Get category breakdown (only approved points)
    let categoryBreakdown;
    if (access.role === "instructor" && courseId != null) {
      categoryBreakdown = await sql`
        SELECT 
          cp.category,
          COUNT(*) as count,
          SUM(cp.points) as total_points
        FROM classroom_points cp
        JOIN students s ON s.id = cp.student_id
        WHERE (cp.status = 'approved' OR cp.status IS NULL)
          ${studentScope}
        GROUP BY cp.category
        ORDER BY total_points DESC
      `;
    } else if (session) {
      categoryBreakdown = await sql`
        SELECT 
          category,
          COUNT(*) as count,
          SUM(points) as total_points
        FROM classroom_points
        WHERE (status = 'approved' OR status IS NULL)
          AND session = ${session}
        GROUP BY category
        ORDER BY total_points DESC
      `;
    } else {
      categoryBreakdown = await sql`
        SELECT 
          category,
          COUNT(*) as count,
          SUM(points) as total_points
        FROM classroom_points
        WHERE (status = 'approved' OR status IS NULL)
        GROUP BY category
        ORDER BY total_points DESC
      `;
    }

    let currentStudentEntry = null;
    let blurPeerNames = true;
    let studentSubmissionBlocks = {
      showCodeAssignments: true,
      showSolutionAssignments: true,
    };

    if (isStudentView && studentId) {
      const numericStudentId = await resolveStudentDatabaseIdFromParam(String(studentId));
      const studentCtx =
        numericStudentId != null ? await resolveStudentCourseContextByDbId(numericStudentId) : null;
      const courseId = studentCtx?.courseId ?? null;
      blurPeerNames = await getClassroomLeaderboardBlurPeerNames(courseId);
      const blocks = await getClassroomStudentSubmissionBlocks(courseId);
      studentSubmissionBlocks = {
        showCodeAssignments: blocks.show_code_assignments,
        showSolutionAssignments: blocks.show_solution_assignments,
      };

      const allRanked = session && studentCtx?.sessionId
        ? await sql`
            SELECT 
              s.id as student_id,
              s.student_id as student_number,
              s.full_name,
              s.section as session,
              COALESCE(SUM(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.points ELSE 0 END), 0) as total_points,
              COUNT(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.id END) as award_count,
              ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.points ELSE 0 END), 0) DESC) as rank
            FROM students s
            LEFT JOIN classroom_points cp ON s.id = cp.student_id
              AND (cp.status = 'approved' OR cp.status IS NULL)
              AND TRIM(UPPER(COALESCE(cp.session, s.section, ''))) = TRIM(UPPER(${session}))
            WHERE s.session_id = ${studentCtx.sessionId}
            GROUP BY s.id, s.student_id, s.full_name, s.section
            HAVING COALESCE(SUM(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.points ELSE 0 END), 0) > 0
          `
        : await sql`
            SELECT 
              s.id as student_id,
              s.student_id as student_number,
              s.full_name,
              s.section as session,
              COALESCE(SUM(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.points ELSE 0 END), 0) as total_points,
              COUNT(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.id END) as award_count,
              ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.points ELSE 0 END), 0) DESC) as rank
            FROM students s
            LEFT JOIN classroom_points cp ON s.id = cp.student_id AND (cp.status = 'approved' OR cp.status IS NULL)
            GROUP BY s.id, s.student_id, s.full_name, s.section
            HAVING COALESCE(SUM(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.points ELSE 0 END), 0) > 0
          `;

      currentStudentEntry =
        allRanked.find((entry: { student_id: number; total_points?: number | string }) =>
          isCurrentStudent(entry.student_id, studentId) && Number(entry.total_points ?? 0) > 0,
        ) || null;
    }

    const awardedLeaderboard = classroomPointsLeaderboardForCurrentOffering(
      leaderboard as Array<Record<string, unknown> & { total_points?: number | string; session?: string }>,
      { section: session },
    )

    const responseLeaderboard =
      isStudentView && studentId
        ? blurPeerNames
          ? sanitizeLeaderboardForStudent(awardedLeaderboard, studentId, { idFields: ["student_id"] })
          : awardedLeaderboard.map((entry: Record<string, unknown>, index: number) => ({
              ...entry,
              rank: Number(entry.rank ?? index + 1),
              is_current_user: isCurrentStudent(entry.student_id, studentId),
            }))
        : awardedLeaderboard;

    return NextResponse.json({
      leaderboard: responseLeaderboard,
      currentStudent: currentStudentEntry ? { ...currentStudentEntry, is_current_user: true } : null,
      stats: stats[0],
      categoryBreakdown,
      privacyMode: isStudentView && blurPeerNames,
      leaderboardPrivacy: {
        blurPeerNames: isStudentView ? blurPeerNames : false,
      },
      studentSubmissionBlocks: isStudentView ? studentSubmissionBlocks : undefined,
    });

  } catch (error) {
    console.error("Error fetching classroom points leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}

