import { NextRequest, NextResponse } from "next/server";
import { getSQL } from "@/lib/db";
import { requireClassroomPointsInstructor, requireClassroomPointsRead } from "@/lib/classroom-points-request-auth";
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope";
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id";
import { getRewardsPolicyForCourse } from "@/lib/rewards-policy.server";
import { sqlInstructorStudentScope } from "@/lib/classroom-points-term-scope";
import { sqlSubmissionCourseScope } from "@/lib/classroom-submission-scope";

const sql = getSQL();

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Resolve legacy submission (submission_id null) to assignment by matching reason to assignment titles.
 * e.g. "Employee Salary with Overtime..." -> submission_id 7
 */
function resolveLegacyToAssignment(point: any, assignments: { id: number; title: string }[]): number | null {
  const reason = (point.reason || '').trim();
  if (!reason || assignments.length === 0) return null;
  let best: { id: number; len: number } | null = null;
  for (const a of assignments) {
    const title = (a.title || '').trim();
    if (!title) continue;
    if (reason.startsWith(title) || reason.startsWith(title + '...') || reason.startsWith(title + ' -')) {
      if (!best || title.length > best.len) {
        best = { id: a.id, len: title.length };
      }
    }
  }
  return best?.id ?? null;
}

/**
 * Detect duplicates in pending code_submission points
 * Groups by assignment (student_id + submission_id). Legacy (submission_id null) is matched to assignment by reason.
 * Per assignment: 1 attempt; multiple submissions = duplicates; keep highest score.
 */
function detectDuplicates(points: any[], assignments?: { id: number; title: string }[]): any[] {
  if (!Array.isArray(points)) return [];
  if (points.length === 0) return points;

  for (const p of points) {
    p.isDuplicate = false;
    p.duplicateOf = null;
    p.highestInGroup = true;
    p.highestScoreInGroup = undefined;
  }

  const assignmentGroups = new Map<string, any[]>();
  const assignmentList = assignments || [];

  for (const point of points) {
    let resolvedSubId: number | null = point.submission_id;
    if (resolvedSubId == null && assignmentList.length > 0) {
      resolvedSubId = resolveLegacyToAssignment(point, assignmentList);
    }
    const assignmentKey = resolvedSubId != null
      ? `student-${point.student_id}-sub-${resolvedSubId}`
      : `student-${point.student_id}-reason-${(point.reason || point.submission_title || 'unknown').substring(0, 150)}`;

    if (!assignmentGroups.has(assignmentKey)) {
      assignmentGroups.set(assignmentKey, []);
    }
    assignmentGroups.get(assignmentKey)!.push(point);
  }

  for (const [, assignmentGroup] of assignmentGroups.entries()) {
    if (assignmentGroup.length === 1) {
      const idx = points.findIndex(p => p.id === assignmentGroup[0].id);
      if (idx !== -1) {
        points[idx].isDuplicate = false;
        points[idx].duplicateOf = null;
        points[idx].highestInGroup = true;
      }
    } else {
      const highest = assignmentGroup.reduce((max, p) => {
        const maxPts = parseFloat(max.points?.toString() || '0');
        const pPts = parseFloat(p.points?.toString() || '0');
        if (pPts > maxPts) return p;
        if (pPts === maxPts) {
          return new Date(p.created_at).getTime() < new Date(max.created_at).getTime() ? p : max;
        }
        return max;
      });

      for (const point of assignmentGroup) {
        const idx = points.findIndex(p => p.id === point.id);
        if (idx === -1) continue;
        if (point.id === highest.id) {
          points[idx].isDuplicate = false;
          points[idx].duplicateOf = null;
          points[idx].highestInGroup = true;
        } else {
          points[idx].isDuplicate = true;
          points[idx].duplicateOf = highest.id;
          points[idx].highestInGroup = false;
          points[idx].highestScoreInGroup = highest.points;
        }
      }
    }
  }

  return points;
}

// GET - Fetch classroom points (all or by student/session)
export async function GET(request: NextRequest) {
  try {
    try {
      await sql`ALTER TABLE codebench_submissions ADD COLUMN IF NOT EXISTS plot_image TEXT`;
    } catch {
      /* non-fatal if DB disallows DDL here */
    }

    const { searchParams } = new URL(request.url);
    let studentId = searchParams.get("studentId");
    const session = searchParams.get("session");
    const status = searchParams.get("status"); // 'pending', 'approved', 'rejected'
    const limit = parseInt(searchParams.get("limit") || "100");
    /** When set (not ALL), totals and rows only include points tagged with that course session — matches section leaderboard. */
    const sessionScoped = Boolean(session && session !== "ALL");

    const readScope = await requireClassroomPointsRead(request);
    if (!readScope.ok) return readScope.response;
    if (readScope.role === "student") {
      studentId = String(readScope.studentDbId)
    }
    const scopedCp =
      readScope.role === "instructor"
        ? { ok: true as const, courseId: readScope.courseId, instructorId: readScope.instructorId }
        : { ok: true as const, courseId: null as number | null, instructorId: null as number | null };

    let studentCourseId: number | null = scopedCp.courseId
    if (studentCourseId == null && studentId) {
      const studentDbId = await resolveStudentDatabaseIdFromParam(studentId)
      if (studentDbId != null) {
        const ctx = await resolveStudentCourseContextByDbId(studentDbId)
        studentCourseId = ctx?.courseId ?? null
      }
    }

    const sCourseClause =
      studentCourseId != null ? sql` AND s.course_id = ${studentCourseId}` : sql``;
    const studentScope =
      readScope.role === "instructor" && studentCourseId != null
        ? await sqlInstructorStudentScope(request, studentCourseId, sql, {
            sessionCode: sessionScoped ? session : null,
          })
        : sql``;
    const instructorStudentFilter = sql`${sCourseClause}${studentScope}`;

    // Note: Column migrations removed to prevent timeout issues
    // Columns should be added via migration scripts, not on every API call

    let points;

    if (studentId) {
      // Get points for a specific student
      // If no status filter, only show approved points to students
      // Students should never see pending points
      if (status) {
        if (sessionScoped) {
          points = await sql`
            SELECT 
              cp.*,
              i.name as instructor_name,
              cs.code as submission_code,
              cs.plot_image,
              css.answer_json as solution_answer_json,
              cps.question_config as assignment_question_config,
              cps.title as submission_title
            FROM classroom_points cp
            JOIN instructors i ON cp.awarded_by = i.id
            JOIN students s ON s.id = cp.student_id
            LEFT JOIN codebench_submissions cs ON cs.classroom_point_id = cp.id
            LEFT JOIN classroom_solution_submissions css ON css.classroom_point_id = cp.id
            LEFT JOIN classroom_point_submissions cps ON cps.id = cp.submission_id
            WHERE cp.student_id = ${studentId}
              AND cp.status = ${status}
              AND (
                cp.session = ${session}
                OR (cp.session IS NULL AND s.section = ${session})
              )
              ${instructorStudentFilter}
            ORDER BY 
              COALESCE(cp.awarded_at, cp.created_at) DESC,
              cp.created_at DESC
            LIMIT ${limit}
          `;
        } else {
          points = await sql`
            SELECT 
              cp.*,
              i.name as instructor_name,
              cs.code as submission_code,
              cs.plot_image,
              css.answer_json as solution_answer_json,
              cps.question_config as assignment_question_config,
              cps.title as submission_title
            FROM classroom_points cp
            JOIN instructors i ON cp.awarded_by = i.id
            INNER JOIN students s ON s.id = cp.student_id
            LEFT JOIN codebench_submissions cs ON cs.classroom_point_id = cp.id
            LEFT JOIN classroom_solution_submissions css ON css.classroom_point_id = cp.id
            LEFT JOIN classroom_point_submissions cps ON cps.id = cp.submission_id
            WHERE cp.student_id = ${studentId}
              AND cp.status = ${status}
              ${instructorStudentFilter}
            ORDER BY 
              COALESCE(cp.awarded_at, cp.created_at) DESC,
              cp.created_at DESC
            LIMIT ${limit}
          `;
        }
      } else if (sessionScoped) {
        points = await sql`
          SELECT 
            cp.*,
            i.name as instructor_name,
            cs.code as submission_code,
            cs.plot_image,
            css.answer_json as solution_answer_json,
            cps.question_config as assignment_question_config,
            cps.title as submission_title
          FROM classroom_points cp
          JOIN instructors i ON cp.awarded_by = i.id
          JOIN students s ON s.id = cp.student_id
          LEFT JOIN codebench_submissions cs ON cs.classroom_point_id = cp.id
          LEFT JOIN classroom_solution_submissions css ON css.classroom_point_id = cp.id
          LEFT JOIN classroom_point_submissions cps ON cps.id = cp.submission_id
          WHERE cp.student_id = ${studentId}
            AND (cp.status = 'approved' OR cp.status IS NULL)
            AND (
              cp.session = ${session}
              OR (cp.session IS NULL AND s.section = ${session})
            )
            ${instructorStudentFilter}
          ORDER BY 
            COALESCE(cp.awarded_at, cp.created_at) DESC,
            cp.created_at DESC
          LIMIT ${limit}
        `;
      } else {
        points = await sql`
          SELECT 
            cp.*,
            i.name as instructor_name,
            cs.code as submission_code,
            cs.plot_image,
            css.answer_json as solution_answer_json,
            cps.question_config as assignment_question_config,
            cps.title as submission_title
          FROM classroom_points cp
          JOIN instructors i ON cp.awarded_by = i.id
          INNER JOIN students s ON s.id = cp.student_id
          LEFT JOIN codebench_submissions cs ON cs.classroom_point_id = cp.id
          LEFT JOIN classroom_solution_submissions css ON css.classroom_point_id = cp.id
          LEFT JOIN classroom_point_submissions cps ON cps.id = cp.submission_id
          WHERE cp.student_id = ${studentId}
            AND (cp.status = 'approved' OR cp.status IS NULL)
            ${instructorStudentFilter}
          ORDER BY 
            COALESCE(cp.awarded_at, cp.created_at) DESC,
            cp.created_at DESC
          LIMIT ${limit}
        `;
      }
    } else if (session) {
      // Get points for a specific session
      if (status === 'pending') {
        points = await sql`
          SELECT 
            cp.*,
            s.student_id as student_number,
            s.full_name as student_name,
            i.name as instructor_name,
            cp.session as session,
            cp.status as status,
            cs.authenticity_score,
            cs.ai_likelihood,
            cs.authorship_reasoning,
            cs.flagged_features,
            cs.ai_suspicion,
            cs.code,
            cs.plot_image,
            css.answer_json as solution_answer_json,
            cps.question_config as assignment_question_config,
            cps.title as submission_title
          FROM classroom_points cp
          JOIN students s ON cp.student_id = s.id
          JOIN instructors i ON cp.awarded_by = i.id
          LEFT JOIN codebench_submissions cs ON cs.classroom_point_id = cp.id
          LEFT JOIN classroom_solution_submissions css ON css.classroom_point_id = cp.id
          LEFT JOIN classroom_point_submissions cps ON cps.id = cp.submission_id
          WHERE cp.session = ${session}
            AND cp.status = ${status}
            AND cp.category IN ('code_submission', 'solution_submission')
            ${instructorStudentFilter}
          ORDER BY cp.awarded_at DESC, cp.created_at DESC
          LIMIT ${limit}
        `;
        
        // Detect duplicates and add flags (fetch assignments to match legacy submissions to assignments)
        if (status === 'pending' && Array.isArray(points)) {
          let assignments: { id: number; title: string }[] = [];
          try {
            if (studentCourseId != null) {
              assignments = await sql`
                SELECT cps.id, cps.title
                FROM classroom_point_submissions cps
                WHERE 1 = 1
                  ${sqlSubmissionCourseScope(studentCourseId)}
              ` as any;
            }
          } catch {
            // Table may not exist
          }
          points = detectDuplicates(points as any[], assignments);
        }
      } else if (status) {
        points = await sql`
          SELECT 
            cp.*,
            s.student_id as student_number,
            s.full_name as student_name,
            i.name as instructor_name,
            cp.session as session,
            cp.status as status,
            cs.authenticity_score,
            cs.ai_likelihood,
            cs.authorship_reasoning,
            cs.flagged_features,
            cs.ai_suspicion
          FROM classroom_points cp
          JOIN students s ON cp.student_id = s.id
          JOIN instructors i ON cp.awarded_by = i.id
          LEFT JOIN codebench_submissions cs ON cs.classroom_point_id = cp.id
          WHERE cp.session = ${session}
            AND cp.status = ${status}
            ${instructorStudentFilter}
          ORDER BY cp.awarded_at DESC, cp.created_at DESC
          LIMIT ${limit}
        `;
      } else {
        points = await sql`
          SELECT 
            cp.*,
            s.student_id as student_number,
            s.full_name as student_name,
            i.name as instructor_name,
            cp.session as session,
            cp.status as status,
            cs.authenticity_score,
            cs.ai_likelihood,
            cs.authorship_reasoning,
            cs.flagged_features,
            cs.ai_suspicion
          FROM classroom_points cp
          JOIN students s ON cp.student_id = s.id
          JOIN instructors i ON cp.awarded_by = i.id
          LEFT JOIN codebench_submissions cs ON cs.classroom_point_id = cp.id
          WHERE cp.session = ${session}
            ${instructorStudentFilter}
          ORDER BY cp.awarded_at DESC, cp.created_at DESC
          LIMIT ${limit}
        `;
      }
    } else {
      // Get all points (with optional status filter)
      if (status === 'pending') {
        points = await sql`
          SELECT 
            cp.*,
            s.student_id as student_number,
            s.full_name as student_name,
            i.name as instructor_name,
            cp.session as session,
            cp.status as status,
            cs.authenticity_score,
            cs.ai_likelihood,
            cs.authorship_reasoning,
            cs.flagged_features,
            COALESCE(cs.ai_suspicion, false) as ai_suspicion,
            cs.code,
            cs.plot_image,
            css.answer_json as solution_answer_json,
            cps.question_config as assignment_question_config,
            cps.title as submission_title
          FROM classroom_points cp
          INNER JOIN students s ON cp.student_id = s.id
          INNER JOIN instructors i ON cp.awarded_by = i.id
          LEFT JOIN codebench_submissions cs ON cs.classroom_point_id = cp.id
          LEFT JOIN classroom_solution_submissions css ON css.classroom_point_id = cp.id
          LEFT JOIN classroom_point_submissions cps ON cps.id = cp.submission_id
          WHERE cp.status = ${status}
            AND cp.category IN ('code_submission', 'solution_submission')
            ${instructorStudentFilter}
          ORDER BY cp.created_at DESC
          LIMIT ${Math.min(limit, 100)}
        `;
        
        // Detect duplicates and add flags (fetch assignments to match legacy submissions)
        if (status === 'pending' && Array.isArray(points)) {
          let assignments: { id: number; title: string }[] = [];
          try {
            if (studentCourseId != null) {
              assignments = await sql`
                SELECT cps.id, cps.title
                FROM classroom_point_submissions cps
                WHERE 1 = 1
                  ${sqlSubmissionCourseScope(studentCourseId)}
              ` as any;
            }
          } catch {
            // Table may not exist
          }
          points = detectDuplicates(points as any[], assignments);
        }
      } else if (status) {
        // Approved/rejected lists may paginate in the faculty UI (cap 500).
        const statusLimit = Math.min(Math.max(1, limit), 500)
        points = await sql`
          SELECT 
            cp.*,
            s.student_id as student_number,
            s.full_name as student_name,
            i.name as instructor_name,
            cp.session as session,
            cp.status as status,
            cs.authenticity_score,
            cs.ai_likelihood,
            cs.authorship_reasoning,
            cs.flagged_features,
            COALESCE(cs.ai_suspicion, false) as ai_suspicion
          FROM classroom_points cp
          INNER JOIN students s ON cp.student_id = s.id
          INNER JOIN instructors i ON cp.awarded_by = i.id
          LEFT JOIN codebench_submissions cs ON cs.classroom_point_id = cp.id
          WHERE cp.status = ${status}
            ${instructorStudentFilter}
          ORDER BY cp.created_at DESC
          LIMIT ${statusLimit}
        `;
      } else {
        // No status filter - show all points (but include authorship data for code submissions)
        // Optimized: limit to recent points only
        points = await sql`
          SELECT 
            cp.*,
            s.student_id as student_number,
            s.full_name as student_name,
            i.name as instructor_name,
            cp.session as session,
            cp.status as status,
            cs.authenticity_score,
            cs.ai_likelihood,
            cs.authorship_reasoning,
            cs.flagged_features,
            COALESCE(cs.ai_suspicion, false) as ai_suspicion
          FROM classroom_points cp
          INNER JOIN students s ON cp.student_id = s.id
          INNER JOIN instructors i ON cp.awarded_by = i.id
          LEFT JOIN codebench_submissions cs ON cs.classroom_point_id = cp.id
          WHERE TRUE
            ${instructorStudentFilter}
          ORDER BY cp.created_at DESC
          LIMIT ${Math.min(limit, 100)}
        `;
      }
    }

    // Get summary if student ID is provided
    let summary = null;
    if (studentId) {
      const summaryResult = sessionScoped
        ? await sql`
          SELECT 
            ${studentId}::INTEGER as student_id,
            COALESCE(SUM(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.points ELSE 0 END), 0) as total_points,
            COUNT(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.id END) as award_count,
            MAX(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.awarded_at END) as last_awarded
          FROM students s
          LEFT JOIN classroom_points cp ON s.id = cp.student_id
            AND (cp.status = 'approved' OR cp.status IS NULL)
            AND (
              cp.session = ${session}
              OR (cp.session IS NULL AND s.section = ${session})
            )
          WHERE s.id = ${studentId}
          ${instructorStudentFilter}
          GROUP BY s.id
        `
        : await sql`
          SELECT 
            ${studentId}::INTEGER as student_id,
            COALESCE(SUM(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.points ELSE 0 END), 0) as total_points,
            COUNT(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.id END) as award_count,
            MAX(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.awarded_at END) as last_awarded
          FROM students s
          LEFT JOIN classroom_points cp ON s.id = cp.student_id AND (cp.status = 'approved' OR cp.status IS NULL)
          WHERE s.id = ${studentId}
          ${instructorStudentFilter}
          GROUP BY s.id
        `;
      summary = summaryResult[0] || { student_id: studentId, total_points: 0, award_count: 0, last_awarded: null };
    }

    let rewardsPolicy: { points_for_full_grade: number } | null = null;
    if (studentCourseId != null) {
      const policy = await getRewardsPolicyForCourse(studentCourseId);
      rewardsPolicy = { points_for_full_grade: policy.points_for_full_grade };
    }

    return NextResponse.json(
      {
        points,
        summary,
        count: points.length,
        rewardsPolicy,
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );

  } catch (error) {
    console.error("Error fetching classroom points:", error);
    return NextResponse.json(
      { error: "Failed to fetch classroom points" },
      { status: 500 }
    );
  }
}

// POST - Award classroom points
export async function POST(request: NextRequest) {
  try {
    const scope = await requireClassroomPointsInstructor(request);
    if (!scope.ok) return scope.response;

    const body = await request.json();
    const { studentId, points, reason, category, session } = body;
    const awardedBy = scope.instructorId;

    // Validation
    if (!studentId || !points || !reason || !session) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (points <= 0) {
      return NextResponse.json(
        { error: "Points must be greater than 0" },
        { status: 400 }
      );
    }

    // Note: Column migrations removed to prevent timeout issues
    // Columns should be added via migration scripts, not on every API call

    // Insert classroom points
    const result = await sql`
      INSERT INTO classroom_points (
        student_id,
        points,
        reason,
        category,
        awarded_by,
        session,
        status
      ) VALUES (
        ${studentId},
        ${points},
        ${reason},
        ${category || 'other'},
        ${awardedBy},
        ${session},
        ${category === 'code_submission' ? 'pending' : 'approved'}
      )
      RETURNING *
    `;

    // Get updated student summary
    const summary = await sql`
      SELECT 
        COALESCE(SUM(points), 0) as total_points,
        COUNT(*) as award_count
      FROM classroom_points
      WHERE student_id = ${studentId}
    `;

    return NextResponse.json({
      success: true,
      award: result[0],
      summary: summary[0]
    });

  } catch (error) {
    console.error("Error awarding classroom points:", error);
    return NextResponse.json(
      { error: "Failed to award classroom points" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a classroom point entry (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const scope = await requireClassroomPointsInstructor(request);
    if (!scope.ok) return scope.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Point ID is required" },
        { status: 400 }
      );
    }

    await sql`
      DELETE FROM classroom_points
      WHERE id = ${id}
    `;

    return NextResponse.json({
      success: true,
      message: "Classroom point entry deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting classroom point:", error);
    return NextResponse.json(
      { error: "Failed to delete classroom point" },
      { status: 500 }
    );
  }
}

