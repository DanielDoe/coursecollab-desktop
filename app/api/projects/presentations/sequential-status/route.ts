import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireProjectsListScope } from "@/lib/project-request-auth";
import {
  computeSequentialDayStatuses,
  enumerateOrderedPresentationYmds,
  getTodayYmdCentral,
  toPresentationConfigLike,
} from "@/lib/presentation-sequential-booking";
import type { PresentationSqlTagged } from "@/lib/presentation-sequential-booking";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const scope = await requireProjectsListScope(request)
    if (!scope.ok) return scope.response
    const session = new URL(request.url).searchParams.get("session");
    if (!session) {
      return NextResponse.json({ error: "session is required" }, { status: 400 });
    }

    const rows = await sql`
      SELECT
        lecture_days,
        presentation_start_date,
        presentation_end_date,
        start_time,
        end_time,
        slot_duration,
        schedule_by_day
      FROM presentation_config
      WHERE session = ${session} AND is_active = TRUE
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No presentation configuration for this session" },
        { status: 404 }
      );
    }

    const config = toPresentationConfigLike(rows[0] as never);
    const orderedDates = enumerateOrderedPresentationYmds(config);
    const days = await computeSequentialDayStatuses(
      sql as unknown as PresentationSqlTagged,
      session,
      config
    );

    return NextResponse.json({
      session,
      /** Chronological lecture days in the presentation window (same order as sequential unlock). */
      orderedDates,
      todayYmd: getTodayYmdCentral(),
      policy:
        "Each day opens in order. A day clears when every slot is booked OR when that calendar day ends (US Central), whichever comes first; then the next day unlocks. Past dates cannot be booked.",
      days,
    });
  } catch (e) {
    console.error("[sequential-status]", e);
    return NextResponse.json(
      { error: "Failed to load sequential booking status" },
      { status: 500 }
    );
  }
}
