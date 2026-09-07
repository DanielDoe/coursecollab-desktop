/**
 * Client-safe Trade Center helpers (no DB).
 */

import type { TradeCenterPointCaps } from "@/lib/engagement-points-system"

export type TradeCenterConfigRow = {
  session: string
  practice_weight: number
  playground_weight: number
  reading_weight: number
  weekly_practice_cap: number
  weekly_playground_cap: number
  weekly_reading_cap: number
  ec_conversion_multiplier: number
  max_engagement_credits: number
  trading_enabled: boolean
  donations_enabled: boolean
  min_donation_points: number
  weekly_reset_day: number
  is_active: boolean
  practice_enabled: boolean
  playground_enabled: boolean
  reading_enabled: boolean
}

export const DEFAULT_TRADE_CENTER_CONFIG: TradeCenterConfigRow = {
  session: "ALL",
  practice_weight: 1.0,
  playground_weight: 1.0,
  reading_weight: 0.8,
  weekly_practice_cap: 60,
  weekly_playground_cap: 36,
  weekly_reading_cap: 40,
  ec_conversion_multiplier: 0.01,
  max_engagement_credits: 10,
  trading_enabled: true,
  donations_enabled: true,
  min_donation_points: 100,
  weekly_reset_day: 1,
  is_active: true,
  practice_enabled: true,
  playground_enabled: true,
  reading_enabled: true,
}

export function parseTradeCenterConfigRow(raw: Record<string, unknown> | null | undefined): TradeCenterConfigRow {
  const d = DEFAULT_TRADE_CENTER_CONFIG
  if (!raw) return { ...d }
  const maxEcRaw = raw.max_engagement_credits ?? raw.ec_cap
  const donationsRaw = raw.donations_enabled ?? raw.donation_enabled
  return {
    session: String(raw.session ?? d.session),
    practice_weight: num(raw.practice_weight, d.practice_weight),
    playground_weight: num(raw.playground_weight, d.playground_weight),
    reading_weight: num(raw.reading_weight, d.reading_weight),
    weekly_practice_cap: int(raw.weekly_practice_cap, d.weekly_practice_cap),
    weekly_playground_cap: int(raw.weekly_playground_cap, d.weekly_playground_cap),
    weekly_reading_cap: int(raw.weekly_reading_cap, d.weekly_reading_cap),
    ec_conversion_multiplier: num(raw.ec_conversion_multiplier, d.ec_conversion_multiplier),
    max_engagement_credits: int(maxEcRaw, d.max_engagement_credits),
    trading_enabled: bool(raw.trading_enabled, d.trading_enabled),
    donations_enabled: bool(donationsRaw, d.donations_enabled),
    min_donation_points: int(raw.min_donation_points, d.min_donation_points),
    weekly_reset_day: int(raw.weekly_reset_day, d.weekly_reset_day),
    is_active: bool(raw.is_active, d.is_active),
    practice_enabled: bool(raw.practice_enabled, d.practice_enabled),
    playground_enabled: bool(raw.playground_enabled, d.playground_enabled),
    reading_enabled: bool(raw.reading_enabled, d.reading_enabled),
  }
}

function num(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function int(v: unknown, fallback: number): number {
  return Math.floor(num(v, fallback))
}

function bool(v: unknown, fallback: boolean): boolean {
  if (v === true || v === false) return v
  if (v === "true") return true
  if (v === "false") return false
  return fallback
}

export type TradeCenterConfigValidation =
  | { ok: true; config: TradeCenterConfigRow }
  | { ok: false; error: string }

/** Validate instructor POST body before persisting. */
export function validateTradeCenterConfigInput(body: Record<string, unknown>): TradeCenterConfigValidation {
  const session = String(body.session ?? "").trim()
  if (!session) return { ok: false, error: "Session is required" }

  const merged = parseTradeCenterConfigRow({
    ...DEFAULT_TRADE_CENTER_CONFIG,
    ...body,
    session,
    // UI legacy aliases
    max_engagement_credits: body.max_engagement_credits ?? body.ec_cap,
    donations_enabled: body.donations_enabled ?? body.donation_enabled,
  })

  if (merged.practice_weight < 0.5 || merged.practice_weight > 2) {
    return { ok: false, error: "Practice weight must be between 0.5 and 2.0" }
  }
  if (merged.playground_weight < 0.5 || merged.playground_weight > 2) {
    return { ok: false, error: "Playground weight must be between 0.5 and 2.0" }
  }
  if (merged.reading_weight < 0.5 || merged.reading_weight > 2) {
    return { ok: false, error: "Reading weight must be between 0.5 and 2.0" }
  }
  if (merged.weekly_practice_cap < 0 || merged.weekly_playground_cap < 0 || merged.weekly_reading_cap < 0) {
    return { ok: false, error: "Weekly caps cannot be negative" }
  }
  if (merged.ec_conversion_multiplier <= 0 || merged.ec_conversion_multiplier > 1) {
    return { ok: false, error: "EC conversion multiplier must be between 0 and 1" }
  }
  if (merged.max_engagement_credits < 1 || merged.max_engagement_credits > 100) {
    return { ok: false, error: "Max engagement credits must be between 1 and 100" }
  }
  if (merged.min_donation_points < 1) {
    return { ok: false, error: "Minimum donation must be at least 1 point" }
  }
  if (merged.weekly_reset_day < 0 || merged.weekly_reset_day > 6) {
    return { ok: false, error: "Weekly reset day must be 0 (Sunday) through 6 (Saturday)" }
  }

  return { ok: true, config: merged }
}

export function mergeCapsFromConfig(config: TradeCenterConfigRow): TradeCenterPointCaps {
  return {
    weekly_practice_cap: config.weekly_practice_cap,
    weekly_playground_cap: config.weekly_playground_cap,
    weekly_reading_cap: config.weekly_reading_cap,
    practice_weight: config.practice_weight,
    playground_weight: config.playground_weight,
    reading_weight: config.reading_weight,
    ec_conversion_multiplier: config.ec_conversion_multiplier,
    max_engagement_credits: config.max_engagement_credits,
    min_donation_points: config.min_donation_points,
  }
}

/** Week start for a configured reset day (0=Sun … 6=Sat; default 1=Mon). */
export function getWeekStartDateString(reference = new Date(), resetDay = 1): string {
  const d = new Date(reference)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const normalizedReset = ((resetDay % 7) + 7) % 7
  const diff = (day - normalizedReset + 7) % 7
  d.setDate(d.getDate() - diff)
  return formatLocalYmd(d)
}

/** Exclusive end of the trade week (start + 7 days). */
export function getWeekEndExclusiveDateString(weekStartYmd: string): string {
  const d = new Date(`${weekStartYmd}T12:00:00`)
  d.setDate(d.getDate() + 7)
  return formatLocalYmd(d)
}

function formatLocalYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** @deprecated Use getWeekStartDateString(ref, 1) */
export function getIsoWeekStartDateString(reference = new Date()): string {
  return getWeekStartDateString(reference, 1)
}

export function parsePositiveInt(raw: unknown): number | null {
  const n = parseInt(String(raw ?? "").trim(), 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}
