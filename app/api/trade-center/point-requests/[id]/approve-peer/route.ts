import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireBoundStudentCaller } from "@/lib/student-api-auth";
import { notifyInstructorsPeerTransferInitiated, peerTransferSourceLabel } from "@/lib/trade-center-peer-transfer";

export const dynamic = "force-dynamic";

/**
 * POST - Peer (requestee) approves the point request. Moves to pending_instructor.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json().catch(() => ({} as { requesteeId?: unknown }));
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
      SET status = 'pending_instructor', peer_responded_at = NOW()
      WHERE id = ${reqId}
    `;

    const detail = await sql`
      SELECT pr.session, pr.points, pr.source,
        req.full_name as requester_name,
        ree.full_name as requestee_name
      FROM point_requests pr
      JOIN students req ON pr.requester_id = req.id
      JOIN students ree ON pr.requestee_id = ree.id
      WHERE pr.id = ${reqId}
      LIMIT 1
    `;
    const d = detail[0] as {
      session: string;
      points: number;
      source: string;
      requester_name: string;
      requestee_name: string;
    };
    notifyInstructorsPeerTransferInitiated({
      session: d.session,
      kind: "point_request_instructor",
      summaryLines: [
        `${d.requestee_name} approved giving ${d.points} ${peerTransferSourceLabel(d.source)} points to ${d.requester_name}.`,
        "Review and finalize the transfer in Trade Center.",
      ],
    });

    return NextResponse.json({
      success: true,
      message: "Request approved. Awaiting instructor approval to finalize.",
    });
  } catch (error) {
    console.error("Error approving point request:", error);
    return NextResponse.json({ error: "Failed to approve request" }, { status: 500 });
  }
}
