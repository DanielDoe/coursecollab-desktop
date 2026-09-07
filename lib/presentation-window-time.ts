/**
 * Resolve presentation booking windows from `presentation_config`, including optional
 * per-weekday overrides in `schedule_by_day`.
 *
 * Course calendar and slot times are defined in US Central Time (America/Chicago, CST/CDT).
 */

import { enUS } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { CENTRAL_TIMEZONE } from "@/lib/timezone";

export type DayScheduleWindow = { start_time: string; end_time: string };

/** One window or several on the same weekday (e.g. Wed noon + Wed afternoon). */
export type DayScheduleEntry = DayScheduleWindow | DayScheduleWindow[];

export type PresentationConfigLike = {
  lecture_days: string[];
  start_time: string;
  end_time: string;
  presentation_start_date: string;
  presentation_end_date: string;
  slot_duration?: number;
  schedule_by_day?: Record<string, DayScheduleEntry> | null;
};

/** Coerce Postgres/JSON date or ISO string to YYYY-MM-DD for comparisons and parsing. */
export function toYmdFromDb(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const mo = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getUTCFullYear();
    const mo = String(parsed.getUTCMonth() + 1).padStart(2, "0");
    const d = String(parsed.getUTCDate()).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }
  return "";
}

/** Normalize DB `lecture_days` (text[], jsonb, or string) to weekday names. */
export function coerceLectureDays(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x).trim()).filter(Boolean);
      }
    } catch {
      const inner = value.replace(/^\{|\}$/g, "");
      if (inner.length > 0) {
        return inner.split(",").map((part) => part.replace(/^"|"$/g, "").trim()).filter(Boolean);
      }
    }
  }
  return [];
}

/** Normalize Postgres TIME / string for lexicographic comparison (HH:MM:SS). */
export function normalizePgTime(value: unknown): string {
  if (value == null) return "00:00:00";
  if (typeof value === "string") {
    return normalizePresentationTime(value);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // TIME without TZ: node-postgres typically uses calendar 1970-01-01 UTC + HH:mm:ss (UTC getters).
    // With TZ-dependent decoding the UTC calendar day shifts — use local getters for wall-clock then.
    const utcEncodedPgTime =
      value.getUTCFullYear() === 1970 &&
      value.getUTCMonth() === 0 &&
      value.getUTCDate() === 1;
    const h = utcEncodedPgTime ? value.getUTCHours() : value.getHours();
    const m = utcEncodedPgTime ? value.getUTCMinutes() : value.getMinutes();
    const sec = utcEncodedPgTime ? value.getUTCSeconds() : value.getSeconds();
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  const o = value as { hours?: number; minutes?: number; seconds?: number };
  if (typeof o?.hours === "number") {
    return `${String(o.hours).padStart(2, "0")}:${String(o.minutes ?? 0).padStart(2, "0")}:${String(o.seconds ?? 0).padStart(2, "0")}`;
  }
  return normalizePresentationTime(String(value));
}

/**
 * Calendar date (YYYY-MM-DD) in the course timezone (America/Chicago).
 * Use for DatePicker values and API `date=` params so bookings match Texas lecture days.
 */
export function formatLocalDateYmd(date: Date): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  return formatInTimeZone(date, CENTRAL_TIMEZONE, "yyyy-MM-dd");
}

/** Pure calendar YMD +/− days (no wall-clock / DST ambiguity). */
export function addCalendarDaysYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/** Stable noon on a Central calendar day (for calendar UI components). */
export function centralNoonOnYmd(ymd: string): Date {
  const normalized =
    ymd.length >= 10 ? `${ymd.slice(0, 4)}-${ymd.slice(5, 7)}-${ymd.slice(8, 10)}` : ymd;
  return fromZonedTime(`${normalized}T12:00:00`, CENTRAL_TIMEZONE);
}

export function normalizePresentationTime(t: string): string {
  const parts = t.split(":");
  const h = (parts[0] ?? "0").padStart(2, "0");
  const m = (parts[1] ?? "0").padStart(2, "0");
  const s = (parts[2] ?? "00").replace(/\D/g, "") || "00";
  const sec = s.padStart(2, "0").slice(0, 2);
  return `${h}:${m}:${sec}`;
}

export function weekdayNameFromYmd(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return "";
  const noon = fromZonedTime(
    `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T12:00:00`,
    CENTRAL_TIMEZONE
  );
  return formatInTimeZone(noon, CENTRAL_TIMEZONE, "EEEE", { locale: enUS });
}

export function isDateInPresentationRange(
  dateStr: string,
  startYmd: string,
  endYmd: string
): boolean {
  return dateStr >= startYmd && dateStr <= endYmd;
}

/** Normalize one JSON value into 0+ windows (object or array of objects). */
export function coerceDayScheduleWindows(raw: unknown): DayScheduleWindow[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    const out: DayScheduleWindow[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const o = item as { start_time?: unknown; end_time?: unknown };
      if (o.start_time == null || o.end_time == null) continue;
      out.push({
        start_time: normalizePresentationTime(String(o.start_time)),
        end_time: normalizePresentationTime(String(o.end_time)),
      });
    }
    return out;
  }
  if (typeof raw === "object" && "start_time" in raw && "end_time" in raw) {
    const o = raw as { start_time: unknown; end_time: unknown };
    if (o.start_time == null || o.end_time == null) return [];
    return [
      {
        start_time: normalizePresentationTime(String(o.start_time)),
        end_time: normalizePresentationTime(String(o.end_time)),
      },
    ];
  }
  return [];
}

/**
 * All bookable time windows for this calendar day (Central), in order.
 * Empty = not a lecture day or outside the configured date range.
 */
export function resolvePresentationTimeWindowsForDate(
  config: PresentationConfigLike,
  dateStr: string
): DayScheduleWindow[] {
  const startYmd = toYmdFromDb(config.presentation_start_date);
  const endYmd = toYmdFromDb(config.presentation_end_date);
  const dayYmd = toYmdFromDb(dateStr);
  if (!startYmd || !endYmd || !dayYmd) {
    return [];
  }

  if (!isDateInPresentationRange(dayYmd, startYmd, endYmd)) {
    return [];
  }

  const dayName = weekdayNameFromYmd(dayYmd);
  const lectureDays = coerceLectureDays(config.lecture_days);
  if (!dayName || !lectureDays.includes(dayName)) {
    return [];
  }

  const byDay = config.schedule_by_day;
  if (byDay && typeof byDay === "object" && dayName in byDay) {
    const windows = coerceDayScheduleWindows((byDay as Record<string, unknown>)[dayName]);
    if (windows.length > 0) return windows;
  }

  return [
    {
      start_time: normalizePresentationTime(config.start_time),
      end_time: normalizePresentationTime(config.end_time),
    },
  ];
}

/**
 * First window only (legacy). Prefer `resolvePresentationTimeWindowsForDate` when generating slots.
 */
export function resolvePresentationTimeWindowForDate(
  config: PresentationConfigLike,
  dateStr: string
): { start_time: string; end_time: string } | null {
  const windows = resolvePresentationTimeWindowsForDate(config, dateStr);
  return windows.length > 0 ? windows[0] : null;
}

function parseTimeToMinutes(t: string): number {
  const [h = 0, m = 0] = t.split(":").map((x) => Number.parseInt(x, 10));
  return h * 60 + m;
}

function formatMinutesToHms(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

export function generateBookableSlotsForWindow(
  window: { start_time: string; end_time: string },
  slotDurationMinutes: number
): { startTime: string; endTime: string }[] {
  const out: { startTime: string; endTime: string }[] = [];
  let cur = parseTimeToMinutes(normalizePresentationTime(window.start_time));
  const end = parseTimeToMinutes(normalizePresentationTime(window.end_time));
  while (cur + slotDurationMinutes <= end) {
    out.push({
      startTime: formatMinutesToHms(cur),
      endTime: formatMinutesToHms(cur + slotDurationMinutes),
    });
    cur += slotDurationMinutes;
  }
  return out;
}

export function isStartEndValidBookableSlot(
  startTime: string,
  endTime: string,
  window: { start_time: string; end_time: string },
  slotDurationMinutes: number
): boolean {
  const slots = generateBookableSlotsForWindow(window, slotDurationMinutes);
  const ns = normalizePresentationTime(startTime);
  const ne = normalizePresentationTime(endTime);
  return slots.some((s) => s.startTime === ns && s.endTime === ne);
}

export function isStartEndValidBookableSlotInWindows(
  startTime: string,
  endTime: string,
  windows: DayScheduleWindow[],
  slotDurationMinutes: number
): boolean {
  return windows.some((w) => isStartEndValidBookableSlot(startTime, endTime, w, slotDurationMinutes));
}
