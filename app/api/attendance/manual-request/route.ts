import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireBoundStudentCaller } from "@/lib/student-api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST - Student requests manual check-in
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, studentId: claimedStudentId, studentName, studentNumber } = body;

    const bound = await requireBoundStudentCaller(
      req,
      claimedStudentId != null ? String(claimedStudentId) : null,
    );
    if (!bound.ok) return bound.response;
    const studentId = bound.studentDbId;

    if (!sessionId || !studentName || !studentNumber) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify session exists and is active
    const session = await sql`
      SELECT * FROM attendance_sessions
      WHERE id = ${sessionId} AND is_active = true
    `;

    if (session.length === 0) {
      return NextResponse.json(
        { error: "Session not found or inactive" },
        { status: 404 }
      );
    }

    // Check if already marked attendance
    const existing = await sql`
      SELECT id FROM attendance_records
      WHERE student_id = ${studentId} AND session_id = ${sessionId}
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Attendance already recorded" },
        { status: 400 }
      );
    }

    // Create manual check-in request (store in a requests table or flag in records)
    // For now, we'll create a pending record that instructor can approve
    await sql`
      INSERT INTO attendance_records (
        student_id,
        session_id,
        student_name,
        student_number,
        section,
        status,
        check_in_method,
        points_earned,
        timestamp
      ) VALUES (
        ${studentId},
        ${sessionId},
        ${studentName},
        ${studentNumber},
        ${session[0].section},
        'pending_manual',
        'manual_request',
        0,
        NOW()
      )
      ON CONFLICT (student_id, session_id) DO NOTHING
    `;

    return NextResponse.json({
      success: true,
      message: "Manual check-in request submitted. Your instructor will review it.",
    });
  } catch (error: any) {
    console.error("Error creating manual check-in request:", error);
    return NextResponse.json(
      { error: "Failed to submit request" },
      { status: 500 }
    );
  }
}
