import { type NextRequest, NextResponse } from "next/server";
import { PRIVACY_PLACEHOLDER_NAME } from "@/lib/student-privacy";
import {
  fetchTradeCenterPeers,
  requireAuthenticatedStudentFromRequest,
  verifyStudentInSession,
} from "@/lib/trade-center-student-access";

export const dynamic = "force-dynamic";

/**
 * GET /api/trade-center/peers?session=P01&excludeId=123
 * Returns students in the same session for donation/request recipient selection.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const session = searchParams.get("session");
    const excludeId = searchParams.get("excludeId");

    if (!session) {
      return NextResponse.json({ error: "Session is required" }, { status: 400 });
    }

    const caller = await requireAuthenticatedStudentFromRequest(request, excludeId);
    if (!caller.ok) {
      return NextResponse.json({ error: caller.error }, { status: caller.status });
    }
    if (session !== "ALL") {
      const sessionCheck = await verifyStudentInSession(caller.studentId, session);
      if (!sessionCheck.ok) {
        return NextResponse.json({ error: sessionCheck.error }, { status: sessionCheck.status });
      }
    }

    const peers = await fetchTradeCenterPeers(session, caller.studentId);
    const isStudentView = true;

    const responsePeers = isStudentView
      ? peers.map((peer) => ({
          id: peer.id,
          student_id: peer.student_id,
          section: peer.section,
          display_label: PRIVACY_PLACEHOLDER_NAME,
        }))
      : peers;

    return NextResponse.json({ peers: responsePeers || [], privacyMode: isStudentView });
  } catch (error) {
    console.error("Error fetching peers:", error);
    return NextResponse.json({ error: "Failed to fetch peers" }, { status: 500 });
  }
}
