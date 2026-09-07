// Session-based lecture schedule configuration for presentations (fallback when DB config is unavailable)

import { enUS } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { CENTRAL_TIMEZONE } from "@/lib/timezone";
import { addCalendarDaysYmd, centralNoonOnYmd, weekdayNameFromYmd } from "./presentation-window-time";

export interface SessionSchedule {
  session: string;
  lectureTime: string;
  days: string[]; // Day names
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  location: string;
  daysOfWeek: number[]; // 0 = Sunday, 1 = Monday, etc.
}

const SCHEDULE_1304_BODY = {
  lectureTime: "Mon 12:00 PM – 1:00 PM • Wed 12:00 PM – 1:00 PM • Wed 4:00 PM – 5:00 PM",
  days: ["Monday", "Wednesday"],
  startHour: 12,
  startMinute: 0,
  endHour: 13,
  endMinute: 0,
  location: "New Electrical Engineering Bldg 119",
  daysOfWeek: [1, 3],
} as const;

const SCHEDULE_1301_BODY = {
  lectureTime: "Mon & Wed 6:00 PM – 7:00 PM",
  days: ["Monday", "Wednesday"],
  startHour: 18,
  startMinute: 0,
  endHour: 19,
  endMinute: 0,
  location: "New Electrical Engineering Bldg 119",
  daysOfWeek: [1, 3],
} as const;

const FALLBACK_SPAN = { start: [2026, 3, 20] as [number, number, number], end: [2026, 3, 29] as [number, number, number] };

/** Fallback clocks only approximate Monday windows; live bookings use `presentation_config` + `schedule_by_day`. */
export const SESSION_SCHEDULES: Record<string, SessionSchedule> = {
  ELEG1304P01: { session: "ELEG1304P01", ...SCHEDULE_1304_BODY },
  /** @deprecated Prefer ELEG1304P01; kept if DB still has short session code */
  E1304P01: { session: "E1304P01", ...SCHEDULE_1304_BODY },
  ELEG1301P01: { session: "ELEG1301P01", ...SCHEDULE_1301_BODY },
  /** @deprecated Prefer ELEG1301P01 */
  E1301P01: { session: "E1301P01", ...SCHEDULE_1301_BODY },
};

/** Local calendar range [y, m0, d] for fallback date lists (month 0-indexed). */
const SESSION_PRESENTATION_FALLBACK_SPAN: Partial<
  Record<string, { start: [number, number, number]; end: [number, number, number] }>
> = {
  ELEG1304P01: FALLBACK_SPAN,
  E1304P01: FALLBACK_SPAN,
  ELEG1301P01: FALLBACK_SPAN,
  E1301P01: FALLBACK_SPAN,
};

function ymdFromCalendarParts(ymdParts: [number, number, number]): string {
  const [year, month0, day] = ymdParts;
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isValidPresentationDate(date: Date, session: string): boolean {
  const schedule = SESSION_SCHEDULES[session];
  if (!schedule) return false;

  const weekday = formatInTimeZone(date, CENTRAL_TIMEZONE, "EEEE", { locale: enUS });
  const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(
    weekday
  );
  return dayOfWeek >= 0 && schedule.daysOfWeek.includes(dayOfWeek);
}

export function getAvailableDatesForSession(session: string): Date[] {
  const schedule = SESSION_SCHEDULES[session];
  if (!schedule) return [];

  const span = SESSION_PRESENTATION_FALLBACK_SPAN[session];
  if (!span) return [];

  const dayNameSet = new Set(schedule.days);
  const dates: Date[] = [];
  let ymd = ymdFromCalendarParts(span.start);
  const endYmd = ymdFromCalendarParts(span.end);

  while (ymd <= endYmd) {
    const name = weekdayNameFromYmd(ymd);
    if (name && dayNameSet.has(name)) {
      dates.push(centralNoonOnYmd(ymd));
    }
    ymd = addCalendarDaysYmd(ymd, 1);
  }

  return dates.sort((a, b) => a.getTime() - b.getTime());
}

export function generateSessionTimeSlots(session: string): string[] {
  const schedule = SESSION_SCHEDULES[session];
  if (!schedule) return [];

  const slots: string[] = [];
  const slotDuration = 20;

  let currentMinute = schedule.startHour * 60 + schedule.startMinute;
  const endMinute = schedule.endHour * 60 + schedule.endMinute;

  while (currentMinute + slotDuration <= endMinute) {
    const startHour = Math.floor(currentMinute / 60);
    const startMin = currentMinute % 60;
    const endMinuteCalc = currentMinute + slotDuration;
    const endHour = Math.floor(endMinuteCalc / 60);
    const endMin = endMinuteCalc % 60;

    const startTime = `${startHour.toString().padStart(2, "0")}:${startMin.toString().padStart(2, "0")}:00`;
    slots.push(startTime);
    currentMinute += slotDuration;
  }

  return slots;
}

export function formatTimeDisplay(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minutes} ${ampm}`;
}
