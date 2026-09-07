import { SUPERPOWER_IDS, type SuperpowerId } from "@/lib/superpowers-constants"

const VALID_ID = new Set<string>(SUPERPOWER_IDS)

/** Normalize jsonb / API payloads into canonical superpower id strings. */
export function normalizeSuperpowerListFromUnknown(raw: unknown): SuperpowerId[] {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is SuperpowerId => typeof x === "string" && VALID_ID.has(x))
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is SuperpowerId => typeof x === "string" && VALID_ID.has(x))
      }
    } catch {
      /* ignore */
    }
  }
  return []
}

/** When superpowers are enabled but the allow-list is missing/invalid, expose every power except "none". */
export function defaultAllowedSuperpowersWhenEnabled(): SuperpowerId[] {
  return SUPERPOWER_IDS.filter((id) => id !== "none") as SuperpowerId[]
}
