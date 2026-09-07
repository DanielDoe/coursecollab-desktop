import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireBoundStudentCaller } from "@/lib/student-api-auth";

export const dynamic = "force-dynamic";

/**
 * POST - Peer (requestee) rejects the point request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json().catch(() => ({} as { requesteeId?: unknown; reason?: unknown }));
    const bound = await requireBoundStudentCaller(
      request,
      body.requesteeId != null ? String(body.requesteeId) : null,
    );
    if (!bound.ok) return bound.response;

    const { id } = await params;
    const reqId = parseInt(id, 10);
    if (isNaN(reqId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });
    }

    const rows = await sql`
      SELECT * FROM point_requests WHERE id = ${reqId} AND status = 'pending'
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Request not found or already processed" }, { status: 404 });
    }

    const pr = rows[0];
    if (Number(pr.requestee_id) !== bound.studentDbId) {
      return NextResponse.json({ error: "You are not the requestee for this request" }, { status: 403 });
    }

    await sql`
      UPDATE point_requests
      SET status = 'rejected_by_peer', peer_responded_at = NOW(), rejection_reason = ${body.reason || "Declined by peer"}
      WHERE id = ${reqId}
    `;

    return NextResponse.json({ success: true, message: "Request declined." });
  } catch (error) {
    console.error("Error rejecting point request:", error);
    return NextResponse.json({ error: "Failed to reject request" }, { status: 500 });
  }
}
