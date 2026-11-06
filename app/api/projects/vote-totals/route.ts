import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireProjectsListScope } from "@/lib/project-request-auth";
import { resolveGroupProjectTermScope } from "@/lib/group-project-term-scope";

export const dynamic = "force-dynamic";

/**
 * GET — project score rows scoped to the active course/term (same rules as /api/projects/list).
 */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireProjectsListScope(request)
    if (!scope.ok) return scope.response
    const gTermScope = await resolveGroupProjectTermScope(request, scope.courseId, null)
    const rows = await sql`
      SELECT
        ps.project_id,
        COALESCE(ps.student_votes_count, 0) AS student_votes_count,
        COALESCE(ps.instructor_votes_count, 0) AS instructor_votes_count,
        COALESCE(ps.student_avg_rating, 0) AS student_avg_rating,
        COALESCE(ps.instructor_avg_rating, 0) AS instructor_avg_rating,
        COALESCE(ps.student_points, 0) AS student_points,
        COALESCE(ps.instructor_points, 0) AS instructor_points,
        COALESCE(ps.total_score, 0) AS total_score,
        COALESCE(a.max_points, 50) AS max_points
      FROM project_scores ps
      JOIN projects p ON p.id = ps.project_id
      LEFT JOIN course_project_assignments a ON a.id = p.assignment_id
      INNER JOIN groups g ON p.group_id = g.id
      WHERE (${scope.gCourseScope}) AND (${gTermScope})
    `;

    type Row = {
      project_id: number;
      student_votes_count: number;
      instructor_votes_count: number;
      student_avg_rating: number;
      instructor_avg_rating: number;
      student_points: number;
      instructor_points: number;
      total_score: number;
      max_points: number;
    };

    const byProjectId: Record<
      string,
      {
        studentVotes: number;
        instructorVotes: number;
        studentAvgRating: number;
        instructorAvgRating: number;
        studentPoints: number;
        instructorPoints: number;
        totalScore: number;
        maxPoints: number;
      }
    > = {};

    for (const r of rows as Row[]) {
      const id = Number(r.project_id);
      if (!Number.isFinite(id)) continue;
      byProjectId[String(id)] = {
        studentVotes: Number(r.student_votes_count) || 0,
        instructorVotes: Number(r.instructor_votes_count) || 0,
        studentAvgRating: Number(r.student_avg_rating) || 0,
        instructorAvgRating: Number(r.instructor_avg_rating) || 0,
        studentPoints: Number(r.student_points) || 0,
        instructorPoints: Number(r.instructor_points) || 0,
        totalScore: Number(r.total_score) || 0,
        maxPoints: Number(r.max_points) || 50,
      };
    }

    return NextResponse.json({ byProjectId });
  } catch (e) {
    console.error("[api/projects/vote-totals]", e);
    return NextResponse.json({ byProjectId: {}, error: "Failed to load project scores" }, { status: 500 });
  }
}
