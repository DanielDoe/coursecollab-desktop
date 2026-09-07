/**
 * Shared Trade Center analytics queries for JSON API and PDF export.
 */
import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"

function asSqlRows<T extends Record<string, unknown> = Record<string, unknown>>(result: unknown): T[] {
  return Array.isArray(result) ? (result as T[]) : []
}

function formatSqlDateOnly(v: Date | string | null | undefined): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString().split("T")[0]
  const s = String(v).trim()
  return s.split("T")[0]
}

async function getLatestActivityWeekStartForCourse(
  courseId: number,
  sectionRestriction: string[] | null,
): Promise<string | null> {
  if (sectionRestriction) {
    const rows = asSqlRows<{ d?: Date | string }>(
      await sql`
        SELECT MAX(ap.week_start_date)::date AS d
        FROM student_activity_points ap
        JOIN students st ON ap.student_id = st.id
        JOIN sessions sess ON sess.id = st.session_id AND sess.course_id = ${courseId}
        WHERE TRIM(sess.code) = ANY(${sectionRestriction}::text[])
      `,
    )
    return formatSqlDateOnly(rows[0]?.d)
  }
  const rows = asSqlRows<{ d?: Date | string }>(
    await sql`
      SELECT MAX(ap.week_start_date)::date AS d
      FROM student_activity_points ap
      JOIN students st ON ap.student_id = st.id
      JOIN sessions sess ON sess.id = st.session_id AND sess.course_id = ${courseId}
    `,
  )
  return formatSqlDateOnly(rows[0]?.d)
}

export type TradeCenterAnalyticsPayload = {
  /** ISO week start used for weekly KPIs, session breakdown, and top traders */
  weekStartDate: string
  /** Today's calendar ISO week start (always current week in DB terms) */
  calendarWeekStart: string
  /** True when weekly KPIs use an older week because the current week had no snapshots */
  usedFallbackWeek: boolean
  stats: {
    total_students: number
    total_ec_earned: number
    avg_ec_per_student: number
    total_points_earned: number
    avg_points_per_student: number
    students_at_cap: number
  }
  topTraders: unknown[]
  transactions: unknown[]
  sessionBreakdown: unknown[]
  lowEngagement: unknown[]
  tradesOverTime: unknown[]
}

export async function fetchTradeCenterAnalytics(
  courseId: number,
  sectionFilter: string,
): Promise<TradeCenterAnalyticsPayload> {
  const narrowSection = sectionFilter.trim() !== "" && sectionFilter.trim().toUpperCase() !== "ALL"

  const weekResult = await sql`
    SELECT DATE_TRUNC('week', CURRENT_DATE)::date as week_start
  `
  const weekRows = asSqlRows<{ week_start?: Date | string }>(weekResult)
  const rawWeek = weekRows[0]?.week_start
  let calendarWeekStart: string
  if (rawWeek instanceof Date) {
    calendarWeekStart = rawWeek.toISOString().split("T")[0]
  } else if (rawWeek != null && rawWeek !== "") {
    calendarWeekStart = String(rawWeek).split("T")[0]
  } else {
    calendarWeekStart = new Date().toISOString().split("T")[0]
  }

  let effectiveWeekStart = calendarWeekStart
  let usedFallbackWeek = false

  const hasTradeTransactionsRows = await sql`
    SELECT (to_regclass('public.trade_transactions') IS NOT NULL) AS has_tt
  `
  const flagRows = asSqlRows<{ has_tt?: boolean }>(hasTradeTransactionsRows)
  const hasTradeTransactions = Boolean(flagRows[0]?.has_tt)

  const sectionVariants = narrowSection ? normalizedSectionVariantsForSql(sectionFilter.trim()) : []
  const sectionRestriction =
    narrowSection && sectionVariants.length > 0 ? sectionVariants : null

  let stats: Record<string, unknown>[] = []
  let topTraders: Record<string, unknown>[] = []
  let sessionBreakdown: Record<string, unknown>[] = []
  let lowEngagement: Record<string, unknown>[] = []

  for (let pass = 0; pass < 2; pass++) {
    if (sectionRestriction) {
      stats = asSqlRows(
        await sql`
      SELECT 
        COUNT(DISTINCT ap.student_id) as total_students,
        SUM(ap.engagement_credits) as total_ec_earned,
        AVG(ap.engagement_credits) as avg_ec_per_student,
        SUM(ap.total_points) as total_points_earned,
        AVG(ap.total_points) as avg_points_per_student,
        COUNT(*) FILTER (WHERE ap.engagement_credits >= 10) as students_at_cap
      FROM student_activity_points ap
      JOIN students st ON ap.student_id = st.id
      JOIN sessions sess ON sess.id = st.session_id AND sess.course_id = ${courseId}
      WHERE ap.week_start_date = ${effectiveWeekStart}::date
        AND TRIM(sess.code) = ANY(${sectionRestriction}::text[])
    `,
      )
      topTraders = asSqlRows(
        await sql`
      SELECT 
        st.id,
        st.full_name,
        st.student_id as student_number,
        st.section,
        ap.engagement_credits,
        ap.total_points,
        ap.total_trades_count,
        ap.total_donations_count
      FROM student_activity_points ap
      JOIN students st ON ap.student_id = st.id
      JOIN sessions sess ON sess.id = st.session_id AND sess.course_id = ${courseId}
      WHERE ap.week_start_date = ${effectiveWeekStart}::date
        AND TRIM(sess.code) = ANY(${sectionRestriction}::text[])
      ORDER BY ap.engagement_credits DESC, ap.total_points DESC
      LIMIT 10
    `,
      )
      sessionBreakdown = asSqlRows(
        await sql`
      SELECT 
        ap.session,
        COUNT(DISTINCT ap.student_id) as student_count,
        AVG(ap.engagement_credits) as avg_ec,
        AVG(ap.total_points) as avg_points
      FROM student_activity_points ap
      JOIN students st ON ap.student_id = st.id
      JOIN sessions sess ON sess.id = st.session_id AND sess.course_id = ${courseId}
      WHERE ap.week_start_date = ${effectiveWeekStart}::date
        AND TRIM(sess.code) = ANY(${sectionRestriction}::text[])
      GROUP BY ap.session
    `,
      )
    } else {
      stats = asSqlRows(
        await sql`
      SELECT 
        COUNT(DISTINCT ap.student_id) as total_students,
        SUM(ap.engagement_credits) as total_ec_earned,
        AVG(ap.engagement_credits) as avg_ec_per_student,
        SUM(ap.total_points) as total_points_earned,
        AVG(ap.total_points) as avg_points_per_student,
        COUNT(*) FILTER (WHERE ap.engagement_credits >= 10) as students_at_cap
      FROM student_activity_points ap
      JOIN students st ON ap.student_id = st.id
      JOIN sessions sess ON sess.id = st.session_id AND sess.course_id = ${courseId}
      WHERE ap.week_start_date = ${effectiveWeekStart}::date
    `,
      )
      topTraders = asSqlRows(
        await sql`
      SELECT 
        st.id,
        st.full_name,
        st.student_id as student_number,
        st.section,
        ap.engagement_credits,
        ap.total_points,
        ap.total_trades_count,
        ap.total_donations_count
      FROM student_activity_points ap
      JOIN students st ON ap.student_id = st.id
      JOIN sessions sess ON sess.id = st.session_id AND sess.course_id = ${courseId}
      WHERE ap.week_start_date = ${effectiveWeekStart}::date
      ORDER BY ap.engagement_credits DESC, ap.total_points DESC
      LIMIT 10
    `,
      )
      sessionBreakdown = asSqlRows(
        await sql`
      SELECT 
        ap.session,
        COUNT(DISTINCT ap.student_id) as student_count,
        AVG(ap.engagement_credits) as avg_ec,
        AVG(ap.total_points) as avg_points
      FROM student_activity_points ap
      JOIN students st ON ap.student_id = st.id
      JOIN sessions sess ON sess.id = st.session_id AND sess.course_id = ${courseId}
      WHERE ap.week_start_date = ${effectiveWeekStart}::date
      GROUP BY ap.session
    `,
      )
    }

    const probeStudents = Number((stats[0] || {}).total_students ?? 0)
    if (pass === 0 && probeStudents === 0) {
      const latest = await getLatestActivityWeekStartForCourse(courseId, sectionRestriction)
      if (latest && latest !== calendarWeekStart) {
        effectiveWeekStart = latest
        usedFallbackWeek = true
        continue
      }
    }
    break
  }

  if (sectionRestriction) {
    lowEngagement = asSqlRows(
      await sql`
      SELECT 
        st.id,
        st.full_name,
        st.student_id as student_number,
        st.section,
        COUNT(DISTINCT ap.week_start_date) as weeks_with_zero_ec
      FROM students st
      INNER JOIN sessions roster_sess ON roster_sess.id = st.session_id AND roster_sess.course_id = ${courseId}
      LEFT JOIN student_activity_points ap ON ap.student_id = st.id
        AND (
          TRIM(ap.session) = TRIM(roster_sess.code)
          OR TRIM(ap.session) = TRIM(COALESCE(st.section, ''))
          OR TRIM(ap.session) = 'ALL'
        )
        AND (
          COALESCE(ap.engagement_credits, 0) = 0
          OR ap.engagement_credits IS NULL
        )
        AND (
          ap.week_start_date >= CURRENT_DATE - INTERVAL '3 weeks'
          OR ap.week_start_date IS NULL
        )
      WHERE TRIM(roster_sess.code) = ANY(${sectionRestriction}::text[])
      GROUP BY st.id, st.full_name, st.student_id, st.section
      HAVING COUNT(DISTINCT ap.week_start_date) >= 3 OR COUNT(ap.id) = 0
      LIMIT 20
    `,
    )
  } else {
    lowEngagement = asSqlRows(
      await sql`
      SELECT 
        st.id,
        st.full_name,
        st.student_id as student_number,
        st.section,
        COUNT(DISTINCT ap.week_start_date) as weeks_with_zero_ec
      FROM students st
      INNER JOIN sessions roster_sess ON roster_sess.id = st.session_id AND roster_sess.course_id = ${courseId}
      LEFT JOIN student_activity_points ap ON ap.student_id = st.id
        AND (
          TRIM(ap.session) = TRIM(roster_sess.code)
          OR TRIM(ap.session) = TRIM(COALESCE(st.section, ''))
          OR TRIM(ap.session) = 'ALL'
        )
        AND (
          COALESCE(ap.engagement_credits, 0) = 0
          OR ap.engagement_credits IS NULL
        )
        AND (
          ap.week_start_date >= CURRENT_DATE - INTERVAL '3 weeks'
          OR ap.week_start_date IS NULL
        )
      GROUP BY st.id, st.full_name, st.student_id, st.section
      HAVING COUNT(DISTINCT ap.week_start_date) >= 3 OR COUNT(ap.id) = 0
      LIMIT 20
    `,
    )
  }

  let transactions: Record<string, unknown>[] = []
  let tradesOverTime: Record<string, unknown>[] = []

  if (hasTradeTransactions) {
    if (sectionRestriction) {
      transactions = asSqlRows(await sql`
        SELECT 
          tt.transaction_type,
          COUNT(*) as count,
          SUM(tt.points_used) as total_points,
          AVG(tt.points_used) as avg_points
        FROM trade_transactions tt
        LEFT JOIN students donor ON donor.id = tt.student_id
        LEFT JOIN sessions ds ON ds.id = donor.session_id
        LEFT JOIN students recip ON recip.id = tt.recipient_id
        LEFT JOIN sessions rs ON rs.id = recip.session_id
        WHERE tt.created_at >= ${effectiveWeekStart}::date
          AND (
            (ds.course_id = ${courseId}
              AND TRIM(ds.code) = ANY(${sectionRestriction}::text[]))
            OR (tt.recipient_id IS NOT NULL
              AND rs.course_id = ${courseId}
              AND TRIM(rs.code) = ANY(${sectionRestriction}::text[]))
          )
        GROUP BY tt.transaction_type
      `)
      tradesOverTime = asSqlRows(await sql`
        SELECT 
          DATE_TRUNC('week', tt.created_at)::date as week_start,
          SUM(tt.points_used) as total_points,
          COUNT(*) FILTER (WHERE tt.transaction_type = 'TRADE') as trade_count,
          COUNT(*) FILTER (WHERE tt.transaction_type = 'DONATION') as donation_count
        FROM trade_transactions tt
        LEFT JOIN students donor ON donor.id = tt.student_id
        LEFT JOIN sessions ds ON ds.id = donor.session_id
        LEFT JOIN students recip ON recip.id = tt.recipient_id
        LEFT JOIN sessions rs ON rs.id = recip.session_id
        WHERE tt.created_at >= CURRENT_DATE - INTERVAL '6 weeks'
          AND (
            (ds.course_id = ${courseId}
              AND TRIM(ds.code) = ANY(${sectionRestriction}::text[]))
            OR (tt.recipient_id IS NOT NULL
              AND rs.course_id = ${courseId}
              AND TRIM(rs.code) = ANY(${sectionRestriction}::text[]))
          )
        GROUP BY DATE_TRUNC('week', tt.created_at)::date
        ORDER BY week_start ASC
      `)
    } else {
      transactions = asSqlRows(await sql`
        SELECT 
          tt.transaction_type,
          COUNT(*) as count,
          SUM(tt.points_used) as total_points,
          AVG(tt.points_used) as avg_points
        FROM trade_transactions tt
        LEFT JOIN students donor ON donor.id = tt.student_id
        LEFT JOIN sessions ds ON ds.id = donor.session_id
        LEFT JOIN students recip ON recip.id = tt.recipient_id
        LEFT JOIN sessions rs ON rs.id = recip.session_id
        WHERE tt.created_at >= ${effectiveWeekStart}::date
          AND (
            ds.course_id = ${courseId}
            OR (
              tt.recipient_id IS NOT NULL
              AND rs.course_id = ${courseId}
            )
          )
        GROUP BY tt.transaction_type
      `)
      tradesOverTime = asSqlRows(await sql`
        SELECT 
          DATE_TRUNC('week', tt.created_at)::date as week_start,
          SUM(tt.points_used) as total_points,
          COUNT(*) FILTER (WHERE tt.transaction_type = 'TRADE') as trade_count,
          COUNT(*) FILTER (WHERE tt.transaction_type = 'DONATION') as donation_count
        FROM trade_transactions tt
        LEFT JOIN students donor ON donor.id = tt.student_id
        LEFT JOIN sessions ds ON ds.id = donor.session_id
        LEFT JOIN students recip ON recip.id = tt.recipient_id
        LEFT JOIN sessions rs ON rs.id = recip.session_id
        WHERE tt.created_at >= CURRENT_DATE - INTERVAL '6 weeks'
          AND (
            ds.course_id = ${courseId}
            OR (
              tt.recipient_id IS NOT NULL
              AND rs.course_id = ${courseId}
            )
          )
        GROUP BY DATE_TRUNC('week', tt.created_at)::date
        ORDER BY week_start ASC
      `)
    }
  }

  const statRow = stats[0] || {}

  return {
    weekStartDate: effectiveWeekStart,
    calendarWeekStart,
    usedFallbackWeek,
    stats: {
      total_students: Number(statRow.total_students ?? 0),
      total_ec_earned: Number(statRow.total_ec_earned ?? 0),
      avg_ec_per_student: Number(statRow.avg_ec_per_student ?? 0),
      total_points_earned: Number(statRow.total_points_earned ?? 0),
      avg_points_per_student: Number(statRow.avg_points_per_student ?? 0),
      students_at_cap: Number(statRow.students_at_cap ?? 0),
    },
    topTraders: topTraders || [],
    transactions: transactions || [],
    sessionBreakdown: sessionBreakdown || [],
    lowEngagement: lowEngagement || [],
    tradesOverTime: tradesOverTime || [],
  }
}
