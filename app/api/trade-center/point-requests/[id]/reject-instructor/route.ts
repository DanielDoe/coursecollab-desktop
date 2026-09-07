import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireInstructorCourse } from "@/lib/instructor-course-scope";

export const dynamic = "force-dynamic";

/**
 * POST - Instructor rejects point request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireInstructorCourse(request);
    if (!scope.ok) return scope.response;

    const { id } = await params;
    const reqId = parseInt(id, 10);
    if (isNaN(reqId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const instructorId = scope.instructorId;
    const courseId = scope.course.id;
    const reason = body.reason || "Rejected by instructor";

    const rows = await sql`
      SELECT pr.id FROM point_requests pr
      JOIN students req ON pr.requester_id = req.id
      LEFT JOIN sessions sreq ON sreq.id = req.session_id
      JOIN students ree ON pr.requestee_id = ree.id
      LEFT JOIN sessions sree ON sree.id = ree.session_id
      WHERE pr.id = ${reqId}
        AND pr.status = 'pending_instructor'
        AND (
          (sreq.course_id = ${courseId} AND sree.course_id = ${courseId})
          OR EXISTS (
            SELECT 1 FROM sessions sc
            WHERE sc.course_id = ${courseId}
              AND TRIM(sc.code) = TRIM(pr.session)
          )
        )
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Request not found or already processed" }, { status: 404 });
    }

    await sql`
      UPDATE point_requests
      SET status = 'rejected_by_instructor', instructor_responded_at = NOW(), reviewed_by = ${instructorId}, rejection_reason = ${reason}
      WHERE id = ${reqId}
    `;

    return NextResponse.json({ success: true, message: "Point request rejected." });
  } catch (error) {
    console.error("Error rejecting point request:", error);
    return NextResponse.json({ error: "Failed to reject point request" }, { status: 500 });
  }
}
