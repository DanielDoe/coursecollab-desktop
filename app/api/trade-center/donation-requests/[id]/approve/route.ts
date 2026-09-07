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
  ensureWeekOpeningCarryColumn,
  tradableActivityPoints,
} from "@/lib/trade-center-carry-forward";
import { requireInstructorCourse } from "@/lib/instructor-course-scope";

export const dynamic = "force-dynamic";

/**
 * POST - Instructor approves donation request and executes transfer
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

    const pending = await sql`
      SELECT dr.id
      FROM donation_requests dr
      JOIN students d ON dr.donor_id = d.id
      JOIN students r ON dr.recipient_id = r.id
      LEFT JOIN sessions sd ON sd.id = d.session_id
      LEFT JOIN sessions sr ON sr.id = r.session_id
      WHERE dr.id = ${reqId}
        AND dr.status = 'pending'
        AND (
          (sd.course_id = ${courseId} AND sr.course_id = ${courseId})
          OR EXISTS (
            SELECT 1 FROM sessions sc
            WHERE sc.course_id = ${courseId}
              AND TRIM(sc.code) = TRIM(dr.session)
          )
        )
      LIMIT 1
    `;
    if (pending.length === 0) {
      return NextResponse.json({ error: "Request not found or already processed" }, { status: 404 });
    }

    const claimed = await sql`
      UPDATE donation_requests
      SET status = 'approved', reviewed_at = NOW(), reviewed_by = ${instructorId}
      WHERE id = ${reqId}
        AND status = 'pending'
      RETURNING *
    `;
    if (claimed.length === 0) {
      return NextResponse.json({ error: "Request not found or already processed" }, { status: 404 });
    }

    const dr = claimed[0] as {
      donor_id: number;
      recipient_id: number;
      session: string;
      points: number;
      source: string;
    };
    const donorId = dr.donor_id;
    const recipientId = dr.recipient_id;
    const session = dr.session;
    const pointsToDonate = Number(dr.points);
    const source = dr.source;

    const revertApproval = async (reason: string) => {
      await sql`
        UPDATE donation_requests
        SET status = 'rejected', reviewed_at = NOW(), reviewed_by = ${instructorId},
            rejection_reason = ${reason}
        WHERE id = ${reqId} AND status = 'approved'
      `;
    };

    if (source === "classroom") {
      const approved = await getClassroomApprovedTotal(donorId, session);
      const tradable = getClassroomTradableAmount(approved);
      if (tradable < pointsToDonate) {
        await revertApproval("Donor no longer has enough tradable classroom points");
        return NextResponse.json(
          { error: "Donor no longer has enough tradable classroom points for this donation" },
          { status: 400 }
        );
      }

      const awardedBy = await resolveInstructorIdForTransfer(instructorId);
      const ptsOut = -Math.abs(pointsToDonate);
      const reasonOut = `Classroom pts donated to peer (−${pointsToDonate}, instructor-approved trade)`;
      const reasonIn = `Classroom pts received from peer (+${pointsToDonate}, instructor-approved trade)`;
      const donorSession = await resolveClassroomPointsStorageSession(donorId, session);
      const recipientSession = await resolveClassroomPointsStorageSession(recipientId, session);

      await sql`
        INSERT INTO classroom_points (student_id, points, reason, category, awarded_by, session, status)
        VALUES (${donorId}, ${ptsOut}, ${reasonOut}, 'peer_transfer_out', ${awardedBy}, ${donorSession}, 'approved')
      `;
      await sql`
        INSERT INTO classroom_points (student_id, points, reason, category, awarded_by, session, status)
        VALUES (${recipientId}, ${pointsToDonate}, ${reasonIn}, 'peer_transfer_in', ${awardedBy}, ${recipientSession}, 'approved')
      `;

      await sql`
        INSERT INTO trade_transactions (student_id, session, transaction_type, points_used, recipient_id, donation_pool_type)
        VALUES (${donorId}, ${donorSession}, 'DONATION', ${pointsToDonate}, ${recipientId}, 'DIRECT')
      `;

      await syncGradesAfterClassroomPeerTransfer(donorId, recipientId, session);

      const students = await sql`
        SELECT id, full_name, email FROM students WHERE id IN (${donorId}, ${recipientId})
      `;
      const byId = new Map((students as { id: number; full_name: string; email: string | null }[]).map((s) => [s.id, s]));
      const donorStudent = byId.get(donorId)!;
      const recStudent = byId.get(recipientId)!;
      sendPeerTransferCompletionEmails({
        kind: "donation",
        source: "classroom",
        points: pointsToDonate,
        fromStudent: donorStudent,
        toStudent: recStudent,
      });

      return NextResponse.json({
        success: true,
        message: `Donation of ${pointsToDonate} classroom points approved and transferred.`,
      });
    }

    const { weekStart: weekStartDate } = await resolveTradeCenterWeek(session);

    await ensureCarriedOverPointsColumn();

    const donorPoints = await sql`
      SELECT * FROM student_activity_points
      WHERE student_id = ${donorId} AND session = ${session} AND week_start_date = ${weekStartDate}
      FOR UPDATE
    `;
    if (donorPoints.length === 0) {
      await revertApproval("Donor has no activity points");
      return NextResponse.json({ error: "Donor has no activity points" }, { status: 400 });
    }

    const pts = donorPoints[0] as Record<string, unknown>;
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

    if (available < pointsToDonate) {
      await revertApproval("Donor no longer has enough activity points");
      return NextResponse.json({ error: "Donor no longer has enough activity points" }, { status: 400 });
    }

    const deducted =
      source === "total"
        ? applyTradePointDeduction(pointsToDonate, carriedOver, practice, playground, reading)
        : source === "practice"
          ? { carriedOver, practice: practice - pointsToDonate, playground, reading }
          : source === "playground"
            ? { carriedOver, practice, playground: playground - pointsToDonate, reading }
            : { carriedOver, practice, playground, reading: reading - pointsToDonate };

    /* Credit recipient carry balance — weekly practice/playground/reading are recomputed on sync and would erase a split credit. */
    await ensureCarriedOverPointsColumn();
    await ensureWeekOpeningCarryColumn();

    const recipientPoints = await sql`
      SELECT id FROM student_activity_points
      WHERE student_id = ${recipientId} AND session = ${session} AND week_start_date = ${weekStartDate}
    `;

    if (recipientPoints.length === 0) {
      await sql`
        INSERT INTO student_activity_points (
          student_id, session, week_start_date,
          practice_points, playground_points, reading_points,
          carried_over_points, week_opening_carry
        )
        VALUES (
          ${recipientId}, ${session}, ${weekStartDate},
          0, 0, 0,
          ${pointsToDonate}, 0
        )
      `;
    } else {
      await sql`
        UPDATE student_activity_points
        SET carried_over_points = COALESCE(carried_over_points, 0) + ${pointsToDonate},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${(recipientPoints[0] as { id: number }).id}
      `;
    }

    await sql`
      UPDATE student_activity_points
      SET carried_over_points = ${deducted.carriedOver},
          practice_points = GREATEST(0, ${deducted.practice}),
          playground_points = GREATEST(0, ${deducted.playground}),
          reading_points = GREATEST(0, ${deducted.reading}),
          total_donations_count = total_donations_count + 1,
          total_donated_points = total_donated_points + ${pointsToDonate},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${(pts as { id: number }).id}
    `;

    await sql`
      INSERT INTO trade_transactions (student_id, session, transaction_type, points_used, recipient_id, donation_pool_type)
      VALUES (${donorId}, ${session}, 'DONATION', ${pointsToDonate}, ${recipientId}, 'DIRECT')
    `;

    const students = await sql`
      SELECT id, full_name, email FROM students WHERE id IN (${donorId}, ${recipientId})
    `;
    const byId = new Map((students as { id: number; full_name: string; email: string | null }[]).map((s) => [s.id, s]));
    sendPeerTransferCompletionEmails({
      kind: "donation",
      source,
      points: pointsToDonate,
      fromStudent: byId.get(donorId)!,
      toStudent: byId.get(recipientId)!,
    });

    return NextResponse.json({
      success: true,
      message: `Donation of ${pointsToDonate} points approved and transferred.`,
    });
  } catch (error) {
    console.error("Error approving donation:", error);
    return NextResponse.json({ error: "Failed to approve donation" }, { status: 500 });
  }
}
