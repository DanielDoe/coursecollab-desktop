import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireProjectsListScope } from "@/lib/project-request-auth";
import {
  generateBookableSlotsForWindow,
  normalizePgTime,
  resolvePresentationTimeWindowsForDate,
  toYmdFromDb,
} from "@/lib/presentation-window-time";
import {
  assertSequentialBookingAllowed,
  toPresentationConfigLike,
} from "@/lib/presentation-sequential-booking";
import type { PresentationSqlTagged } from "@/lib/presentation-sequential-booking";

// GET - Get available time slots for a given date and session
export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const scope = await requireProjectsListScope(request)
    if (!scope.ok) return scope.response
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    let startTime = searchParams.get("startTime") || "09:00:00";
    let endTime = searchParams.get("endTime") || "17:00:00";
    let slotDuration = parseInt(searchParams.get("slotDuration") || "20", 10);
    const session = searchParams.get("session");

    if (!date) {
      return NextResponse.json(
        { error: "Date is required" },
        { status: 400 }
      );
    }

    if (!session) {
      return NextResponse.json(
        { error: "Session is required" },
        { status: 400 }
      );
    }

    const configRows = await sql`
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

    let templateSlots: { startTime: string; endTime: string }[] = [];

    if (configRows.length > 0) {
      const cfg = configRows[0] as {
        lecture_days: string[];
        presentation_start_date: string;
        presentation_end_date: string;
        start_time: string;
        end_time: string;
        slot_duration: number;
        schedule_by_day: Record<string, unknown> | string | null;
      };
      slotDuration = Number(cfg.slot_duration) || slotDuration;

      let scheduleByDay: Record<string, unknown> | null = cfg.schedule_by_day as Record<string, unknown> | null;
      if (typeof scheduleByDay === "string") {
        try {
          scheduleByDay = JSON.parse(scheduleByDay) as Record<string, unknown>;
        } catch {
          scheduleByDay = null;
        }
      }

      const windows = resolvePresentationTimeWindowsForDate(
        {
          lecture_days: cfg.lecture_days,
          start_time: String(cfg.start_time),
          end_time: String(cfg.end_time),
          presentation_start_date: toYmdFromDb(cfg.presentation_start_date),
          presentation_end_date: toYmdFromDb(cfg.presentation_end_date),
          slot_duration: slotDuration,
          schedule_by_day: scheduleByDay as never,
        },
        date
      );

      if (windows.length === 0) {
        return NextResponse.json({
          date,
          session,
          slots: [],
          bookedCount: 0,
          availableCount: 0,
          message: "No presentation window for this date (outside range or not a lecture day).",
        });
      }

      const configLike = toPresentationConfigLike(cfg as never);
      const sequential = await assertSequentialBookingAllowed(
        sql as unknown as PresentationSqlTagged,
        session,
        configLike,
        date
      );
      if (!sequential.ok) {
        return NextResponse.json({
          date,
          session,
          slots: [],
          bookedCount: 0,
          availableCount: 0,
          sequentialLock: true,
          message: sequential.error,
        });
      }

      templateSlots = windows
        .flatMap((w) => generateBookableSlotsForWindow(w, slotDuration))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
    } else {
      templateSlots = generateBookableSlotsForWindow(
        { start_time: startTime, end_time: endTime },
        slotDuration
      );
    }

    // Get all presentations for the given date and session only
    const bookedSlots = await sql`
      SELECT 
        pp.start_time,
        pp.end_time,
        p.title as project_title,
        g.name as group_name,
        pp.session
      FROM project_presentations pp
      JOIN projects p ON pp.project_id = p.id
      JOIN groups g ON pp.group_id = g.id
      WHERE pp.scheduled_date = ${date}
        AND pp.session = ${session}
        AND pp.status != 'cancelled'
      ORDER BY pp.start_time ASC
    `;

    const allSlots: any[] = templateSlots.map(({ startTime: st, endTime: et }) => {
      const isBooked = bookedSlots.some((slot) => {
        const slotStart = normalizePgTime(slot.start_time);
        const slotEnd = normalizePgTime(slot.end_time);
        return (
          (st >= slotStart && st < slotEnd) ||
          (et > slotStart && et <= slotEnd) ||
          (st <= slotStart && et >= slotEnd)
        );
      });

      const bookedSlot = isBooked
        ? bookedSlots.find((slot) => {
            const slotStart = normalizePgTime(slot.start_time);
            const slotEnd = normalizePgTime(slot.end_time);
            return (
              (st >= slotStart && st < slotEnd) ||
              (et > slotStart && et <= slotEnd) ||
              (st <= slotStart && et >= slotEnd)
            );
          })
        : null;

      return {
        startTime: st,
        endTime: et,
        available: !isBooked,
        ...(bookedSlot && {
          projectTitle: bookedSlot.project_title,
          groupName: bookedSlot.group_name,
        }),
      };
    });


    return NextResponse.json({
      date,
      slots: allSlots,
      bookedCount: bookedSlots.length,
      availableCount: allSlots.filter((s) => s.available).length,
    });
  } catch (error) {
    console.error("Error fetching available slots:", error);
    return NextResponse.json(
      { error: "Failed to fetch available slots" },
      { status: 500 }
    );
  }
}

