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
 * POST - Student requests points from a peer
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session, requesteeId, points, source, message } = body;

    if (!body.requesterId || !session || !requesteeId || !points || !source) {
      return NextResponse.json(
        { error: "requesterId, session, requesteeId, points, and source are required" },
        { status: 400 }
      );
    }

    const access = await requireAuthenticatedStudentTradeAccess(request, body.requesterId, String(session));
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    const requesterIdNum = access.studentId;
    const normalizedSession = access.normalizedSession;

    const requesteeIdNum = parseInt(requesteeId, 10);
    const pointsNum = parseInt(points, 10);

    if (isNaN(requesterIdNum) || isNaN(requesteeIdNum) || isNaN(pointsNum) || pointsNum < 1) {
      return NextResponse.json({ error: "Invalid IDs or points" }, { status: 400 });
    }

    if (requesterIdNum === requesteeIdNum) {
      return NextResponse.json({ error: "Cannot request from yourself" }, { status: 400 });
    }

    if (!SOURCES.includes(source)) {
      return NextResponse.json(
        { error: "Source must be one of: practice, playground, reading, total, classroom" },
        { status: 400 }
      );
    }

    const config = await sql`
      SELECT donations_enabled, min_donation_points FROM trade_center_config
      WHERE (session = ${normalizedSession} OR session = 'ALL') AND is_active = true
      ORDER BY CASE WHEN session = ${normalizedSession} THEN 0 ELSE 1 END
      LIMIT 1
    `;
    if (config.length === 0 || !config[0].donations_enabled) {
      return NextResponse.json({ error: "Point requests are disabled" }, { status: 403 });
    }
    const minPts = config[0].min_donation_points || 100;
    if (pointsNum < minPts) {
      return NextResponse.json({ error: `Minimum request is ${minPts} points` }, { status: 400 });
    }

    const { weekStart: weekStartDate } = await resolveTradeCenterWeek(normalizedSession);

    let available = 0;
    if (source === "classroom") {
      const approved = await getClassroomApprovedTotal(requesteeIdNum, normalizedSession);
      available = getClassroomTradableAmount(approved);
      if (available < pointsNum) {
        return NextResponse.json(
          {
            error: `Peer does not have enough tradable classroom points (they keep at least ${MIN_CLASSROOM_PEER_RESERVE} pts). Their tradable: ${available}.`,
          },
          { status: 400 }
        );
      }
    } else {
      const requesteePoints = await sql`
        SELECT * FROM student_activity_points
        WHERE student_id = ${requesteeIdNum} AND session = ${normalizedSession} AND week_start_date = ${weekStartDate}
      `;
      if (requesteePoints.length === 0) {
        return NextResponse.json({ error: "Peer has no activity points" }, { status: 400 });
      }

      const pts = requesteePoints[0];
      if (source === "practice") available = pts.practice_points || 0;
      else if (source === "playground") available = pts.playground_points || 0;
      else if (source === "reading") available = pts.reading_points || 0;
      else available = tradableActivityPoints(pts);

      if (available < pointsNum) {
        return NextResponse.json(
          { error: `Peer does not have enough points from ${source}. Available: ${available}` },
          { status: 400 }
        );
      }
    }

    const requesteeOk = await studentMatchesSessionFragment(requesteeIdNum, normalizedSession);
    if (!requesteeOk) {
      return NextResponse.json({ error: "Peer not found or not in your session" }, { status: 400 });
    }

    await sql`
      INSERT INTO point_requests (requester_id, requestee_id, session, points, source, message, status)
      VALUES (${requesterIdNum}, ${requesteeIdNum}, ${normalizedSession}, ${pointsNum}, ${source}, ${message || null}, 'pending')
    `;

    const names = await sql`
      SELECT
        (SELECT full_name FROM students WHERE id = ${requesterIdNum} LIMIT 1) as requester_name,
        (SELECT full_name FROM students WHERE id = ${requesteeIdNum} LIMIT 1) as requestee_name
    `;
    const nm = (names[0] as { requester_name?: string; requestee_name?: string }) || {};
    notifyInstructorsPeerTransferInitiated({
      session: normalizedSession,
      kind: "point_request_peer",
      summaryLines: [
        `${nm.requester_name ?? "A student"} requested ${pointsNum} ${peerTransferSourceLabel(source)} points from ${nm.requestee_name ?? "a peer"}.`,
        "The peer must approve first; you will get another notice when instructor sign-off is required.",
      ],
    });

    return NextResponse.json({
      success: true,
      message: "Point request sent. Awaiting peer approval.",
    });
  } catch (error) {
    console.error("Error creating point request:", error);
    return NextResponse.json({ error: "Failed to create point request" }, { status: 500 });
  }
}

/**
 * GET - List point requests
 * ?role=instructor -> pending_instructor (awaiting instructor approval)
 * ?studentId=X -> my requests (as requester or requestee)
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
        SELECT pr.*,
          req.full_name as requester_name, req.student_id as requester_student_id,
          ree.full_name as requestee_name, ree.student_id as requestee_student_id
        FROM point_requests pr
        JOIN students req ON pr.requester_id = req.id
        LEFT JOIN sessions sreq ON sreq.id = req.session_id
        JOIN students ree ON pr.requestee_id = ree.id
        LEFT JOIN sessions sree ON sree.id = ree.session_id
        WHERE (
            pr.status = 'pending_instructor'
            OR (
              ${includeReviewed}
              AND pr.status IN ('approved_by_instructor', 'rejected_by_instructor')
              AND pr.instructor_responded_at IS NOT NULL
              AND pr.instructor_responded_at > NOW() - INTERVAL '90 days'
            )
          )
          AND (
            (sreq.course_id = ${courseId} AND sree.course_id = ${courseId})
            OR EXISTS (
              SELECT 1 FROM sessions sc
              WHERE sc.course_id = ${courseId}
                AND TRIM(sc.code) = TRIM(pr.session)
            )
          )
        ORDER BY
          CASE WHEN pr.status = 'pending_instructor' THEN 0 ELSE 1 END,
          COALESCE(pr.instructor_responded_at, pr.created_at) DESC
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
        SELECT pr.*,
          req.full_name as requester_name, req.student_id as requester_student_id,
          ree.full_name as requestee_name, ree.student_id as requestee_student_id
        FROM point_requests pr
        JOIN students req ON pr.requester_id = req.id
        JOIN students ree ON pr.requestee_id = ree.id
        WHERE pr.requester_id = ${sid} OR pr.requestee_id = ${sid}
        ORDER BY pr.created_at DESC
      `;
      return NextResponse.json({ requests: mine || [] });
    }

    return NextResponse.json({ error: "role=instructor or studentId required" }, { status: 400 });
  } catch (error) {
    console.error("Error fetching point requests:", error);
    return NextResponse.json({ error: "Failed to fetch point requests" }, { status: 500 });
  }
}
