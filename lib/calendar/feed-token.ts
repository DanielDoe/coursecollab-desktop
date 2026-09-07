import { randomBytes } from "node:crypto"
import { sql } from "@/lib/db"
import { getPermanentPublicBaseUrl } from "@/lib/get-base-url"

export type CalendarFeedPortal = "faculty" | "student"

export type CalendarFeedRecord = {
  token: string
  portal: CalendarFeedPortal
  userId: number
  beforeMinutes: number
  atStart: boolean
  httpsUrl: string
  webcalUrl: string
}

let ensured = false

export async function ensureCalendarFeedTokenSchema(): Promise<void> {
  if (ensured) return
  await sql`
    CREATE TABLE IF NOT EXISTS calendar_feed_tokens (
      token TEXT PRIMARY KEY,
      portal TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      before_minutes INTEGER NOT NULL DEFAULT 15,
      at_start BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS calendar_feed_tokens_user_idx
    ON calendar_feed_tokens (portal, user_id)
  `
  ensured = true
}

function feedUrls(token: string): { httpsUrl: string; webcalUrl: string } {
  const origin = getPermanentPublicBaseUrl().replace(/\/+$/, "")
  const httpsUrl = `${origin}/api/calendar/feed/${encodeURIComponent(token)}`
  const webcalUrl = httpsUrl.replace(/^https:/i, "webcal:")
  return { httpsUrl, webcalUrl }
}

function mapRow(row: Record<string, unknown>): CalendarFeedRecord {
  const token = String(row.token)
  return {
    token,
    portal: row.portal === "faculty" ? "faculty" : "student",
    userId: Number(row.user_id),
    beforeMinutes: Number(row.before_minutes) === 0 ? 0 : 15,
    atStart: row.at_start !== false,
    ...feedUrls(token),
  }
}

export async function touchCalendarFeed(portal: CalendarFeedPortal, userId: number): Promise<void> {
  await ensureCalendarFeedTokenSchema()
  await sql`
    UPDATE calendar_feed_tokens
    SET updated_at = NOW()
    WHERE portal = ${portal} AND user_id = ${userId}
  `
}

export async function getCalendarFeedByToken(token: string): Promise<CalendarFeedRecord | null> {
  await ensureCalendarFeedTokenSchema()
  const trimmed = token.trim()
  if (!trimmed) return null
  const rows = (await sql`
    SELECT token, portal, user_id, before_minutes, at_start
    FROM calendar_feed_tokens
    WHERE token = ${trimmed}
    LIMIT 1
  `) as Record<string, unknown>[]
  return rows[0] ? mapRow(rows[0]) : null
}

export async function getOrCreateCalendarFeed(
  portal: CalendarFeedPortal,
  userId: number,
): Promise<CalendarFeedRecord> {
  await ensureCalendarFeedTokenSchema()
  const existing = (await sql`
    SELECT token, portal, user_id, before_minutes, at_start
    FROM calendar_feed_tokens
    WHERE portal = ${portal} AND user_id = ${userId}
    LIMIT 1
  `) as Record<string, unknown>[]
  if (existing[0]) return mapRow(existing[0])

  const token = randomBytes(24).toString("base64url")
  const inserted = (await sql`
    INSERT INTO calendar_feed_tokens (token, portal, user_id)
    VALUES (${token}, ${portal}, ${userId})
    ON CONFLICT (portal, user_id) DO UPDATE SET updated_at = NOW()
    RETURNING token, portal, user_id, before_minutes, at_start
  `) as Record<string, unknown>[]
  return mapRow(inserted[0]!)
}

export async function updateCalendarFeedPrefs(
  portal: CalendarFeedPortal,
  userId: number,
  prefs: { beforeMinutes?: number; atStart?: boolean },
): Promise<CalendarFeedRecord> {
  const current = await getOrCreateCalendarFeed(portal, userId)
  const beforeMinutes = prefs.beforeMinutes === 0 ? 0 : prefs.beforeMinutes === 15 ? 15 : current.beforeMinutes
  const atStart = prefs.atStart ?? current.atStart
  const rows = (await sql`
    UPDATE calendar_feed_tokens
    SET before_minutes = ${beforeMinutes},
        at_start = ${atStart},
        updated_at = NOW()
    WHERE token = ${current.token}
    RETURNING token, portal, user_id, before_minutes, at_start
  `) as Record<string, unknown>[]
  return mapRow(rows[0] ?? current)
}
