import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireInstructorCourse } from "@/lib/instructor-course-scope";

export const dynamic = "force-dynamic";

/**
 * POST - Instructor rejects donation request
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

    const updated = await sql`
      UPDATE donation_requests dr
      SET status = 'rejected', reviewed_at = NOW(), reviewed_by = ${instructorId}, rejection_reason = ${reason}
      FROM students d
      JOIN students r ON dr.recipient_id = r.id
      LEFT JOIN sessions sd ON sd.id = d.session_id
      LEFT JOIN sessions sr ON sr.id = r.session_id
      WHERE dr.id = ${reqId}
        AND dr.status = 'pending'
        AND dr.donor_id = d.id
        AND (
          (sd.course_id = ${courseId} AND sr.course_id = ${courseId})
          OR EXISTS (
            SELECT 1 FROM sessions sc
            WHERE sc.course_id = ${courseId}
              AND TRIM(sc.code) = TRIM(dr.session)
          )
        )
      RETURNING dr.id
    `;
    if (updated.length === 0) {
      return NextResponse.json({ error: "Request not found or already processed" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Donation request rejected." });
  } catch (error) {
    console.error("Error rejecting donation:", error);
    return NextResponse.json({ error: "Failed to reject donation" }, { status: 500 });
  }
}
