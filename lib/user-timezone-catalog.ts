/** IANA zones for the picker (Intl-backed labels; no external RSS/API). */
export const TIMEZONE_GROUP_ORDER = [
  "United States & Canada",
  "Americas",
  "Europe",
  "Asia & Pacific",
  "Africa & Middle East",
  "UTC",
] as const

const US_CANADA = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Winnipeg",
  "America/Edmonton",
  "America/Halifax",
  "America/St_Johns",
] as const

const AMERICAS = [
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  "America/Caracas",
] as const

const EUROPE = [
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Warsaw",
  "Europe/Athens",
  "Europe/Helsinki",
  "Europe/Moscow",
  "Europe/Istanbul",
] as const

const ASIA_PACIFIC = [
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Perth",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
] as const

const AFRICA_ME = ["Africa/Cairo", "Africa/Johannesburg", "Africa/Lagos", "Asia/Jerusalem"] as const

export const TIMEZONE_GROUPS: Record<(typeof TIMEZONE_GROUP_ORDER)[number], readonly string[]> = {
  "United States & Canada": US_CANADA,
  Americas: AMERICAS,
  Europe: EUROPE,
  "Asia & Pacific": ASIA_PACIFIC,
  "Africa & Middle East": AFRICA_ME,
  UTC: ["UTC"],
}

export const ALL_PICKER_TIMEZONES: string[] = TIMEZONE_GROUP_ORDER.flatMap(
  (g) => [...TIMEZONE_GROUPS[g]],
)

export type TimezoneOption = {
  value: string
  label: string
  offsetLabel: string
  group: string
}

function offsetLabelFor(timeZone: string, at: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(at)
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT"
  } catch {
    return "GMT"
  }
}

function labelFor(timeZone: string): string {
  if (timeZone === "UTC") return "UTC (Coordinated Universal Time)"
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longGeneric",
    }).formatToParts(new Date())
    const generic = parts.find((p) => p.type === "timeZoneName")?.value
    const city = timeZone.split("/").pop()?.replace(/_/g, " ") ?? timeZone
    return generic ? `${city} (${generic})` : city
  } catch {
    return timeZone.replace(/_/g, " ")
  }
}

export function buildTimezoneOptions(): TimezoneOption[] {
  const out: TimezoneOption[] = []
  for (const group of TIMEZONE_GROUP_ORDER) {
    for (const value of TIMEZONE_GROUPS[group]) {
      out.push({
        value,
        group,
        label: labelFor(value),
        offsetLabel: offsetLabelFor(value),
      })
    }
  }
  return out
}

export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago"
  } catch {
    return "America/Chicago"
  }
}
