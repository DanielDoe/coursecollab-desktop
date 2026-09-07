import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  getClassroomApprovedTotal,
  getClassroomTradableAmount,
  resolveInstructorIdForTransfer,
  sendPeerTransferCompletionEmails,
  syncGradesAfterClassroomPeerTransfer,
} from "@/lib/trade-center-peer-transfer";
import { resolveClassroomPointsStorageSession } from "@/lib/trade-center-student-access";
import { resolveTradeCenterWeek } from "@/lib/trade-center-server";
import {
  applyTradePointDeduction,
  ensureCarriedOverPointsColumn,
  tradableActivityPoints,
} from "@/lib/trade-center-carry-forward";
import { requireInstructorCourse } from "@/lib/instructor-course-scope";

export const dynamic = "force-dynamic";

/**
 * POST - Instructor approves point request and executes transfer (requestee -> requester)
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

    const instructorId = scope.instructorId;
    const courseId = scope.course.id;

    const rows = await sql`
      SELECT pr.* FROM point_requests pr
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

    const pr = rows[0] as {
      requestee_id: number;
      requester_id: number;
      session: string;
      points: number;
      source: string;
    };
    const requesteeId = pr.requestee_id;
    const requesterId = pr.requester_id;
    const session = pr.session;
    const pointsToTransfer = Number(pr.points);
    const source = pr.source;

    if (source === "classroom") {
      const approved = await getClassroomApprovedTotal(requesteeId, session);
      const tradable = getClassroomTradableAmount(approved);
      if (tradable < pointsToTransfer) {
        await sql`
          UPDATE point_requests
          SET status = 'rejected_by_instructor', instructor_responded_at = NOW(), reviewed_by = ${instructorId},
              rejection_reason = 'Requestee no longer has enough tradable classroom points'
          WHERE id = ${reqId}
        `;
        return NextResponse.json(
          { error: "Requestee no longer has enough tradable classroom points" },
          { status: 400 }
        );
      }

      const awardedBy = await resolveInstructorIdForTransfer(instructorId);
      const ptsOut = -Math.abs(pointsToTransfer);
      const reasonOut = `Classroom pts sent to peer (−${pointsToTransfer}, instructor-approved peer request)`;
      const reasonIn = `Classroom pts from peer (+${pointsToTransfer}, instructor-approved peer request)`;
      const requesteeSession = await resolveClassroomPointsStorageSession(requesteeId, session);
      const requesterSession = await resolveClassroomPointsStorageSession(requesterId, session);

      await sql`
        INSERT INTO classroom_points (student_id, points, reason, category, awarded_by, session, status)
        VALUES (${requesteeId}, ${ptsOut}, ${reasonOut}, 'peer_transfer_out', ${awardedBy}, ${requesteeSession}, 'approved')
      `;
      await sql`
        INSERT INTO classroom_points (student_id, points, reason, category, awarded_by, session, status)
        VALUES (${requesterId}, ${pointsToTransfer}, ${reasonIn}, 'peer_transfer_in', ${awardedBy}, ${requesterSession}, 'approved')
      `;

      await sql`
        INSERT INTO trade_transactions (student_id, session, transaction_type, points_used, recipient_id, donation_pool_type)
        VALUES (${requesteeId}, ${requesteeSession}, 'DONATION', ${pointsToTransfer}, ${requesterId}, 'DIRECT')
      `;

      await syncGradesAfterClassroomPeerTransfer(requesteeId, requesterId, session);

      await sql`
        UPDATE point_requests
        SET status = 'approved_by_instructor', instructor_responded_at = NOW(), reviewed_by = ${instructorId}
        WHERE id = ${reqId}
      `;

      const students = await sql`
        SELECT id, full_name, email FROM students WHERE id IN (${requesteeId}, ${requesterId})
      `;
      const byId = new Map((students as { id: number; full_name: string; email: string | null }[]).map((s) => [s.id, s]));
      sendPeerTransferCompletionEmails({
        kind: "point_request",
        source: "classroom",
        points: pointsToTransfer,
        fromStudent: byId.get(requesteeId)!,
        toStudent: byId.get(requesterId)!,
      });

      return NextResponse.json({
        success: true,
        message: `Point transfer of ${pointsToTransfer} classroom points approved.`,
      });
    }

    const { weekStart: weekStartDate } = await resolveTradeCenterWeek(session);

    await ensureCarriedOverPointsColumn();

    const requesteePoints = await sql`
      SELECT * FROM student_activity_points
      WHERE student_id = ${requesteeId} AND session = ${session} AND week_start_date = ${weekStartDate}
      FOR UPDATE
    `;
    if (requesteePoints.length === 0) {
      await sql`
        UPDATE point_requests SET status = 'rejected_by_instructor', instructor_responded_at = NOW(), reviewed_by = ${instructorId}, rejection_reason = 'Requestee has no activity points'
        WHERE id = ${reqId}
      `;
      return NextResponse.json({ error: "Requestee has no activity points" }, { status: 400 });
    }

    const pts = requesteePoints[0] as Record<string, unknown>;
    const practice = Number(pts.practice_points ?? 0);
    const playground = Number(pts.playground_points ?? 0);
    const reading = Number(pts.reading_points ?? 0);
    const carriedOver = Number(pts.carried_over_points ?? 0);

    const available =
      source === "practice"
        ? practice
        : source === "playground"
          ? playground
          : source === "reading"
            ? reading
            : tradableActivityPoints({
                practice_points: practice,
                playground_points: playground,
                reading_points: reading,
                total_points: pts.total_points as number | null,
                carried_over_points: carriedOver,
              });

    if (available < pointsToTransfer) {
      await sql`
        UPDATE point_requests
        SET status = 'rejected_by_instructor', instructor_responded_at = NOW(), reviewed_by = ${instructorId},
            rejection_reason = 'Requestee no longer has enough activity points'
        WHERE id = ${reqId}
      `;
      return NextResponse.json({ error: "Requestee no longer has enough activity points" }, { status: 400 });
    }

    const deducted =
      source === "total"
        ? applyTradePointDeduction(pointsToTransfer, carriedOver, practice, playground, reading)
        : source === "practice"
          ? { carriedOver, practice: practice - pointsToTransfer, playground, reading }
          : source === "playground"
            ? { carriedOver, practice, playground: playground - pointsToTransfer, reading }
            : { carriedOver, practice, playground, reading: reading - pointsToTransfer };

    const pointsPerType = Math.floor(pointsToTransfer / 3);
    const remainder = pointsToTransfer % 3;

    const requesterPoints = await sql`
      SELECT * FROM student_activity_points
      WHERE student_id = ${requesterId} AND session = ${session} AND week_start_date = ${weekStartDate}
    `;

    if (requesterPoints.length === 0) {
      await sql`
        INSERT INTO student_activity_points (student_id, session, week_start_date, practice_points, playground_points, reading_points)
        VALUES (${requesterId}, ${session}, ${weekStartDate}, ${pointsPerType}, ${pointsPerType}, ${pointsPerType + remainder})
      `;
    } else {
      await sql`
        UPDATE student_activity_points
        SET practice_points = practice_points + ${pointsPerType},
            playground_points = playground_points + ${pointsPerType},
            reading_points = reading_points + ${pointsPerType + remainder},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${(requesterPoints[0] as { id: number }).id}
      `;
    }

    await sql`
      UPDATE student_activity_points
      SET carried_over_points = ${deducted.carriedOver},
          practice_points = GREATEST(0, ${deducted.practice}),
          playground_points = GREATEST(0, ${deducted.playground}),
          reading_points = GREATEST(0, ${deducted.reading}),
          total_donations_count = total_donations_count + 1,
          total_donated_points = total_donated_points + ${pointsToTransfer},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${(pts as { id: number }).id}
    `;

    await sql`
      INSERT INTO trade_transactions (student_id, session, transaction_type, points_used, recipient_id, donation_pool_type)
      VALUES (${requesteeId}, ${session}, 'DONATION', ${pointsToTransfer}, ${requesterId}, 'DIRECT')
    `;

    await sql`
      UPDATE point_requests
      SET status = 'approved_by_instructor', instructor_responded_at = NOW(), reviewed_by = ${instructorId}
      WHERE id = ${reqId}
    `;

    const students = await sql`
      SELECT id, full_name, email FROM students WHERE id IN (${requesteeId}, ${requesterId})
    `;
    const byId = new Map((students as { id: number; full_name: string; email: string | null }[]).map((s) => [s.id, s]));
    sendPeerTransferCompletionEmails({
      kind: "point_request",
      source,
      points: pointsToTransfer,
      fromStudent: byId.get(requesteeId)!,
      toStudent: byId.get(requesterId)!,
    });

    return NextResponse.json({
      success: true,
      message: `Point transfer of ${pointsToTransfer} points approved.`,
    });
  } catch (error) {
    console.error("Error approving point request:", error);
    return NextResponse.json({ error: "Failed to approve point request" }, { status: 500 });
  }
}
