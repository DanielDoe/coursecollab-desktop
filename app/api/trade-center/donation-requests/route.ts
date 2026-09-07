import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  getClassroomApprovedTotal,
  getClassroomTradableAmount,
  MIN_CLASSROOM_PEER_RESERVE,
  notifyInstructorsPeerTransferInitiated,
  peerTransferSourceLabel,
} from "@/lib/trade-center-peer-transfer";
import { requireInstructorCourse } from "@/lib/instructor-course-scope";
import {
  requireAuthenticatedStudentFromRequest,
  requireAuthenticatedStudentTradeAccess,
  studentMatchesSessionFragment,
} from "@/lib/trade-center-student-access";
import { resolveTradeCenterWeek } from "@/lib/trade-center-server";
import { tradableActivityPoints } from "@/lib/trade-center-carry-forward";

export const dynamic = "force-dynamic";

const SOURCES = ["practice", "playground", "reading", "total", "classroom"] as const;

/**
 * POST - Student submits donation request (pending instructor approval)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session, recipientId, points, source } = body;

    if (!body.studentId || !session || !recipientId || !points || !source) {
      return NextResponse.json(
        { error: "studentId, session, recipientId, points, and source are required" },
        { status: 400 }
      );
    }

    const access = await requireAuthenticatedStudentTradeAccess(request, body.studentId, String(session));
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    const donorId = access.studentId;
    const normalizedSession = access.normalizedSession;

    const recipientIdNum = parseInt(recipientId, 10);
    const pointsNum = parseInt(points, 10);

    if (isNaN(donorId) || isNaN(recipientIdNum) || isNaN(pointsNum) || pointsNum < 1) {
      return NextResponse.json({ error: "Invalid IDs or points" }, { status: 400 });
    }

    if (donorId === recipientIdNum) {
      return NextResponse.json({ error: "Cannot donate to yourself" }, { status: 400 });
    }

    if (!SOURCES.includes(source)) {
      return NextResponse.json(
        { error: "Source must be one of: practice, playground, reading, total, classroom" },
        { status: 400 }
      );
    }

    // Check config
    const config = await sql`
      SELECT donations_enabled, min_donation_points FROM trade_center_config
      WHERE (session = ${normalizedSession} OR session = 'ALL') AND is_active = true
      ORDER BY CASE WHEN session = ${normalizedSession} THEN 0 ELSE 1 END
      LIMIT 1
    `;
    if (config.length === 0 || !config[0].donations_enabled) {
      return NextResponse.json({ error: "Donations are disabled" }, { status: 403 });
    }
    const minPts = config[0].min_donation_points || 100;
    if (pointsNum < minPts) {
      return NextResponse.json({ error: `Minimum donation is ${minPts} points` }, { status: 400 });
    }

    const { weekStart: weekStartDate } = await resolveTradeCenterWeek(normalizedSession);

    let available = 0;
    if (source === "classroom") {
      const approved = await getClassroomApprovedTotal(donorId, normalizedSession);
      available = getClassroomTradableAmount(approved);
      if (available < pointsNum) {
        return NextResponse.json(
          {
            error: `Insufficient tradable classroom points. Minimum ${MIN_CLASSROOM_PEER_RESERVE} pts must remain; tradable now: ${available} (approved classroom total: ${approved}).`,
          },
          { status: 400 }
        );
      }
    } else {
      const donorPoints = await sql`
        SELECT * FROM student_activity_points
        WHERE student_id = ${donorId} AND session = ${normalizedSession} AND week_start_date = ${weekStartDate}
      `;
      if (donorPoints.length === 0) {
        return NextResponse.json({ error: "No activity points found" }, { status: 400 });
      }

      const pts = donorPoints[0];
      if (source === "practice") available = pts.practice_points || 0;
      else if (source === "playground") available = pts.playground_points || 0;
      else if (source === "reading") available = pts.reading_points || 0;
      else available = tradableActivityPoints(pts);

      if (available < pointsNum) {
        return NextResponse.json(
          { error: `Insufficient points from ${source}. Available: ${available}` },
          { status: 400 }
        );
      }
    }

    const recipientOk = await studentMatchesSessionFragment(recipientIdNum, normalizedSession);
    if (!recipientOk) {
      return NextResponse.json({ error: "Recipient not found or not in your session" }, { status: 400 });
    }

    await sql`
      INSERT INTO donation_requests (donor_id, recipient_id, session, points, source, status)
      VALUES (${donorId}, ${recipientIdNum}, ${normalizedSession}, ${pointsNum}, ${source}, 'pending')
    `;

    const names = await sql`
      SELECT
        (SELECT full_name FROM students WHERE id = ${donorId} LIMIT 1) as donor_name,
        (SELECT full_name FROM students WHERE id = ${recipientIdNum} LIMIT 1) as recipient_name
    `;
    const dn = (names[0] as { donor_name?: string; recipient_name?: string }) || {};
    notifyInstructorsPeerTransferInitiated({
      session: normalizedSession,
      kind: "donation_pending",
      summaryLines: [
        `${dn.donor_name ?? "A student"} requested to donate ${pointsNum} ${peerTransferSourceLabel(source)} points to ${dn.recipient_name ?? "a classmate"}.`,
        "Approve or reject this transfer in Trade Center → Donations.",
      ],
    });

    return NextResponse.json({
      success: true,
      message: "Donation request submitted. Awaiting instructor approval.",
    });
  } catch (error) {
    console.error("Error creating donation request:", error);
    return NextResponse.json({ error: "Failed to create donation request" }, { status: 500 });
  }
}

/**
 * GET - List donation requests
 * ?role=instructor -> all pending (for approval)
 * ?studentId=X -> my donations (as donor or recipient)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const studentId = searchParams.get("studentId");

    if (role === "instructor") {
      const scope = await requireInstructorCourse(request);
      if (!scope.ok) return scope.response;
      const courseId = scope.course.id;
      const includeReviewed =
        searchParams.get("includeReviewed") === "1" ||
        searchParams.get("includeReviewed") === "true";
      const pending = await sql`
        SELECT dr.*,
          d.full_name as donor_name, d.student_id as donor_student_id, d.section as donor_section,
          r.full_name as recipient_name, r.student_id as recipient_student_id
        FROM donation_requests dr
        JOIN students d ON dr.donor_id = d.id
        JOIN students r ON dr.recipient_id = r.id
        LEFT JOIN sessions sd ON sd.id = d.session_id
        LEFT JOIN sessions sr ON sr.id = r.session_id
        WHERE (
            dr.status = 'pending'
            OR (
              ${includeReviewed}
              AND dr.status IN ('approved', 'rejected')
              AND dr.reviewed_at IS NOT NULL
              AND dr.reviewed_at > NOW() - INTERVAL '90 days'
            )
          )
          AND (
            (sd.course_id = ${courseId} AND sr.course_id = ${courseId})
            OR EXISTS (
              SELECT 1 FROM sessions sc
              WHERE sc.course_id = ${courseId}
                AND TRIM(sc.code) = TRIM(dr.session)
            )
          )
        ORDER BY
          CASE WHEN dr.status = 'pending' THEN 0 ELSE 1 END,
          COALESCE(dr.reviewed_at, dr.created_at) DESC
      `;
      return NextResponse.json({ requests: pending || [] });
    }

    if (studentId) {
      const resolved = await requireAuthenticatedStudentFromRequest(request, studentId);
      if (!resolved.ok) {
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });
      }
      const sid = resolved.studentId;
      const mine = await sql`
        SELECT dr.*,
          d.full_name as donor_name, d.student_id as donor_student_id,
          r.full_name as recipient_name, r.student_id as recipient_student_id
        FROM donation_requests dr
        JOIN students d ON dr.donor_id = d.id
        JOIN students r ON dr.recipient_id = r.id
        WHERE dr.donor_id = ${sid} OR dr.recipient_id = ${sid}
        ORDER BY dr.created_at DESC
      `;
      return NextResponse.json({ requests: mine || [] });
    }

    return NextResponse.json({ error: "role=instructor or studentId required" }, { status: 400 });
  } catch (error) {
    console.error("Error fetching donation requests:", error);
    return NextResponse.json({ error: "Failed to fetch donation requests" }, { status: 500 });
  }
}
