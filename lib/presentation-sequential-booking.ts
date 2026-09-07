/**
 * Sequential presentation days (US Central): a later day unlocks when every earlier day is either
 * fully booked or that calendar day has ended (end-of-day rollover). Past dates cannot be booked.
 */

import {
  addCalendarDaysYmd,
  coerceLectureDays,
  formatLocalDateYmd,
  generateBookableSlotsForWindow,
  resolvePresentationTimeWindowsForDate,
  toYmdFromDb,
  weekdayNameFromYmd,
} from "@/lib/presentation-window-time";
import type { DayScheduleEntry, PresentationConfigLike } from "@/lib/presentation-window-time";

/** Calendar days in presentation window that are lecture days (in order), matching student scheduler rules. */
export function enumerateOrderedPresentationYmds(config: PresentationConfigLike): string[] {
  const startYmd = toYmdFromDb(config.presentation_start_date);
  const endYmd = toYmdFromDb(config.presentation_end_date);
  if (!startYmd || !endYmd) return [];

  const lectureSet = new Set(coerceLectureDays(config.lecture_days));
  let ymd = startYmd;
  const out: string[] = [];

  while (ymd <= endYmd) {
    if (ymd.endsWith("-11-26")) {
      ymd = addCalendarDaysYmd(ymd, 1);
      continue;
    }
    const dayName = weekdayNameFromYmd(ymd);
    if (dayName && lectureSet.has(dayName)) {
      out.push(ymd);
    }
    ymd = addCalendarDaysYmd(ymd, 1);
  }
  return out;
}

export function parseScheduleByDayFromDb(
  raw: Record<string, DayScheduleEntry> | string | null | undefined
): Record<string, DayScheduleEntry> | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, DayScheduleEntry>;
    } catch {
      return null;
    }
  }
  return raw;
}

export function toPresentationConfigLike(row: {
  lecture_days: unknown;
  presentation_start_date: unknown;
  presentation_end_date: unknown;
  start_time: unknown;
  end_time: unknown;
  slot_duration: unknown;
  schedule_by_day?: unknown;
}): PresentationConfigLike {
  return {
    lecture_days: coerceLectureDays(row.lecture_days),
    start_time: String(row.start_time),
    end_time: String(row.end_time),
    presentation_start_date: toYmdFromDb(row.presentation_start_date),
    presentation_end_date: toYmdFromDb(row.presentation_end_date),
    slot_duration: Number(row.slot_duration) || 20,
    schedule_by_day: parseScheduleByDayFromDb(
      row.schedule_by_day as Record<string, DayScheduleEntry> | string | null
    ),
  };
}

export type SequentialDayStatus = {
  date: string;
  unlocked: boolean;
  isFull: boolean;
  /** True when this calendar day (US Central) has ended and the day was not fully booked — unlock rolls forward. */
  expiredWithoutFullBooking: boolean;
  slotsTotal: number;
  slotsBooked: number;
};

/** “Today” in course timezone (America/Chicago) as YYYY-MM-DD. */
export function getTodayYmdCentral(now: Date = new Date()): string {
  return formatLocalDateYmd(now);
}

/**
 * Earlier lecture days stop blocking the chain when fully booked OR when that calendar day
 * has passed in Central time (end of day rollover), so the next day can open.
 */
function isEarlierDayResolvedForChain(
  row: { date: string; isFull: boolean; slotsTotal: number },
  todayYmd: string
): boolean {
  if (row.slotsTotal === 0) {
    return row.isFull;
  }
  if (row.isFull) return true;
  return row.date < todayYmd;
}

export type PresentationSqlTagged = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Array<{ c: number }>>;

export async function computeSequentialDayStatuses(
  sql: PresentationSqlTagged,
  session: string,
  config: PresentationConfigLike
): Promise<SequentialDayStatus[]> {
  const ordered = enumerateOrderedPresentationYmds(config);
  const slotDur = Number(config.slot_duration) || 20;
  const todayYmd = getTodayYmdCentral();
  const base: Array<{
    date: string;
    isFull: boolean;
    expiredWithoutFullBooking: boolean;
    slotsTotal: number;
    slotsBooked: number;
  }> = [];

  for (const ymd of ordered) {
    const windows = resolvePresentationTimeWindowsForDate(config, ymd);
    const slotsTotal = windows.reduce(
      (sum, w) => sum + generateBookableSlotsForWindow(w, slotDur).length,
      0
    );
    const countRows = await sql`
      SELECT COUNT(*)::int AS c
      FROM project_presentations
      WHERE session = ${session}
        AND scheduled_date = ${ymd}::date
        AND status != 'cancelled'
    `;
    const slotsBooked = Number(countRows[0]?.c ?? 0);
    const isFull = slotsTotal > 0 && slotsBooked >= slotsTotal;
    const expiredWithoutFullBooking =
      slotsTotal > 0 && ymd < todayYmd && !isFull;
    base.push({
      date: ymd,
      isFull,
      expiredWithoutFullBooking,
      slotsTotal,
      slotsBooked,
    });
  }

  return base.map((row, i) => ({
    ...row,
    unlocked:
      row.slotsTotal === 0
        ? false
        : base.slice(0, i).every((p) => isEarlierDayResolvedForChain(p, todayYmd)),
  }));
}

export async function assertSequentialBookingAllowed(
  sql: PresentationSqlTagged,
  session: string,
  config: PresentationConfigLike,
  scheduledYmd: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const todayYmd = getTodayYmdCentral();
  if (scheduledYmd < todayYmd) {
    return {
      ok: false,
      error: `Cannot book a past presentation date (${scheduledYmd}). Choose today or a future date (US Central).`,
    };
  }

  const ordered = enumerateOrderedPresentationYmds(config);
  const idx = ordered.indexOf(scheduledYmd);
  if (idx < 0) {
    return { ok: true };
  }
  if (idx === 0) {
    return { ok: true };
  }

  const slotDur = Number(config.slot_duration) || 20;
  for (let j = 0; j < idx; j++) {
    const ymd = ordered[j];
    const windows = resolvePresentationTimeWindowsForDate(config, ymd);
    const total = windows.reduce(
      (sum, w) => sum + generateBookableSlotsForWindow(w, slotDur).length,
      0
    );
    if (total === 0) continue;
    const rows = await sql`
      SELECT COUNT(*)::int AS c
      FROM project_presentations
      WHERE session = ${session}
        AND scheduled_date = ${ymd}::date
        AND status != 'cancelled'
    `;
    const booked = Number(rows[0]?.c ?? 0);
    const isFull = booked >= total;
    const dayEndedReleasesChain = ymd < todayYmd;
    if (!isFull && !dayEndedReleasesChain) {
      return {
        ok: false,
        error: `Earlier presentation day ${ymd} must be fully booked (${booked}/${total} slots) before booking ${scheduledYmd}, unless that day has already passed (US Central). Please use the next unlocked day.`,
      };
    }
  }
  return { ok: true };
}
