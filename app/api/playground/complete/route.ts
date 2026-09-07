import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireBoundStudentCaller } from "@/lib/student-api-auth";
import { syncPlaygroundEngagementByResultId } from "@/lib/playground-engagement-sync";
import { getPlaygroundPolicyForCourse } from "@/lib/playground-policy-settings.server";
import { markPlaygroundResultComplete } from "@/lib/playground-result-complete";
import {
  getPlaygroundSessionByResultId,
  isClassroomSessionEnded,
  PLAYGROUND_SESSION_ENDED_MESSAGE,
} from "@/lib/playground-session-guard";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const bound = await requireBoundStudentCaller(
      request,
      request.headers.get("x-student-id") ?? new URL(request.url).searchParams.get("studentId"),
    );
    if (!bound.ok) return bound.response;

    const body = await request.json();
    const { resultId } = body;

    if (!resultId) {
      return NextResponse.json(
        { error: "Result ID is required" },
        { status: 400 }
      );
    }

    const owned = await sql`
      SELECT 1
      FROM playground_results pr
      JOIN students s ON s.deleted_at IS NULL
        AND (s.student_id = pr.student_id OR pr.student_id = s.id::text)
      WHERE pr.id = ${Number(resultId)}
        AND s.id = ${bound.studentDbId}
      LIMIT 1
    `;
    if (owned.length === 0) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const session = await getPlaygroundSessionByResultId(Number(resultId));
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (isClassroomSessionEnded(session)) {
      return NextResponse.json(
        { error: PLAYGROUND_SESSION_ENDED_MESSAGE, sessionEnded: true },
        { status: 403 },
      );
    }

    // Mark playground result as completed
    const result = await markPlaygroundResultComplete(Number(resultId));

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Result not found or already completed" },
        { status: 404 }
      );
    }

    // Get student database ID from student_id string
    const studentIdString = result[0].student_id;
    const student = await sql`
      SELECT id, section FROM students WHERE student_id = ${studentIdString}
    `;

    if (student.length > 0) {
      const studentDbId = student[0].id;

      try {
        const courseRow = await sql`
          SELECT ps.course_id
          FROM playground_results pr
          JOIN playground_sessions ps ON ps.id = pr.session_id
          WHERE pr.id = ${Number(resultId)}
          LIMIT 1
        `
        const courseId =
          courseRow[0]?.course_id != null ? Number(courseRow[0].course_id) : null
        const policy = await getPlaygroundPolicyForCourse(courseId)
        if (policy.sync_engagement_points) {
          await syncPlaygroundEngagementByResultId(Number(resultId));
        }
      } catch {
        // non-critical
      }

      // Generate and save learning report (background, non-blocking)
      try {
        const reportData = await sql`SELECT generate_playground_report(${result[0].id}) as report`
        if (reportData[0]?.report) {
          await sql`
            SELECT save_learning_report(
              ${studentDbId}::INTEGER,
              'playground'::VARCHAR,
              ${result[0].id}::INTEGER,
              ${reportData[0].report}::JSONB
            )
          `
        }
      } catch (reportError) {
        // Report generation failed (non-critical)
      }
    }

    const scoreRow = await sql`
      SELECT score, correct_answers
      FROM playground_results
      WHERE id = ${Number(resultId)}
      LIMIT 1
    `

    return NextResponse.json({
      success: true,
      message: "Playground game completed successfully",
      score: scoreRow[0]?.score != null ? Number(scoreRow[0].score) : undefined,
      correctAnswers:
        scoreRow[0]?.correct_answers != null ? Number(scoreRow[0].correct_answers) : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to complete playground game" },
      { status: 500 }
    );
  }
}

