/**
 * Server-side Trade Center helpers (DB access).
 */

import { sql } from "@/lib/db"
import { ensureTradeCenterConfigSchema } from "@/lib/ensure-trade-center-config-schema"
import { normalizeSessionForStorage } from "@/lib/session-catalog"
import {
  DEFAULT_TRADE_CENTER_CONFIG,
  getWeekEndExclusiveDateString,
  getWeekStartDateString,
  parseTradeCenterConfigRow,
  type TradeCenterConfigRow,
} from "@/lib/trade-center-shared"

export async function loadActiveTradeCenterConfig(session: string): Promise<TradeCenterConfigRow> {
  const normalizedSession = await normalizeSessionForStorage(session)
  try {
    await ensureTradeCenterConfigSchema()
    const rows = await sql`
      SELECT * FROM trade_center_config
      WHERE (session = ${normalizedSession} OR session = 'ALL')
        AND is_active = true
      ORDER BY CASE WHEN session = ${normalizedSession} THEN 0 ELSE 1 END
      LIMIT 1
    `
    if (rows.length > 0) {
      return parseTradeCenterConfigRow(rows[0] as Record<string, unknown>)
    }
  } catch {
    /* table may be missing */
  }
  return { ...DEFAULT_TRADE_CENTER_CONFIG, session: normalizedSession }
}

export type TradeCenterWeekWindow = {
  weekStart: string
  weekEndExclusive: string
  resetDay: number
}

export async function resolveTradeCenterWeek(
  session: string,
  referenceDate?: string,
): Promise<TradeCenterWeekWindow> {
  const config = await loadActiveTradeCenterConfig(session)
  const ref = referenceDate?.trim() ? new Date(referenceDate) : new Date()
  const weekStart = getWeekStartDateString(ref, config.weekly_reset_day)
  return {
    weekStart,
    weekEndExclusive: getWeekEndExclusiveDateString(weekStart),
    resetDay: config.weekly_reset_day,
  }
}
