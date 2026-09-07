import { type NextRequest, NextResponse } from "next/server";
import { requireBoundStudentCaller } from "@/lib/student-api-auth";
import { verifyStudentInSession } from "@/lib/trade-center-student-access";
import { syncActivityPoints } from "@/lib/trade-center-sync";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, session } = body;

    const bound = await requireBoundStudentCaller(request, studentId);
    if (!bound.ok) return bound.response;

    if (!session) {
      return NextResponse.json(
        { error: "Student ID and session are required" },
        { status: 400 }
      );
    }

    const sessionCheck = await verifyStudentInSession(bound.studentDbId, String(session));
    if (!sessionCheck.ok) {
      return NextResponse.json({ error: sessionCheck.error }, { status: sessionCheck.status });
    }

    const result = await syncActivityPoints(bound.studentDbId, sessionCheck.normalizedSession);

    return NextResponse.json({
      success: true,
      points: result,
      message: "Activity points synced successfully",
    });
  } catch (error) {
    console.error("Error syncing activity points:", error);
    return NextResponse.json(
      { error: "Failed to sync activity points" },
      { status: 500 }
    );
  }
}

