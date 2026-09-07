import { addDays } from "date-fns"
import { formatInTimeZone, fromZonedTime } from "date-fns-tz"
import { CENTRAL_TIMEZONE, ensureUtcDate } from "@/lib/timezone"

/** Calendar weeks (21 days after the open date in Central Time). */
export const HOMEWORK_DEFAULT_DUE_DAYS_AFTER_OPEN = 21

/**
 * Default homework due moment: 11:59:59.999 PM Central on the calendar day that is
 * {@link HOMEWORK_DEFAULT_DUE_DAYS_AFTER_OPEN} days after the open date (Central calendar date of `available_from`).
 */
export function defaultHomeworkAvailableUntilUtc(availableFrom: Date | string): Date {
  const anchor = ensureUtcDate(availableFrom)
  const openYmd = formatInTimeZone(anchor, CENTRAL_TIMEZONE, "yyyy-MM-dd")
  const openNoonCentral = fromZonedTime(`${openYmd}T12:00:00`, CENTRAL_TIMEZONE)
  const dueDayCentral = addDays(openNoonCentral, HOMEWORK_DEFAULT_DUE_DAYS_AFTER_OPEN)
  const dueYmd = formatInTimeZone(dueDayCentral, CENTRAL_TIMEZONE, "yyyy-MM-dd")
  return fromZonedTime(`${dueYmd}T23:59:59.999`, CENTRAL_TIMEZONE)
}
