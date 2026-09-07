import { sql } from "@/lib/db"

export type AnalyticsScope = {
  institutionId?: number | null
  courseId?: number | null
  from?: string | Date | null
  to?: string | Date | null
}

export type AnalyticsDateRange = {
  from: string
  to: string
}

export type TimeBucket = "day" | "week" | "month"

export type RoleUsageRow = {
  key: string
  name: string
  activeUsers: number
}

export type SuppressedGroup = {
  key: string
  name: string
  suppressed: true
}

export type PeriodRoleSeries = {
  bucket: string
  label: string
  totalActiveUsers: number
  studentActiveUsers: number
  instructorActiveUsers: number
  adminActiveUsers: number
  guestActiveUsers: number
}

export type AdoptionMetrics = {
  range: AnalyticsDateRange
  daily: PeriodRoleSeries[]
  weekly: PeriodRoleSeries[]
  monthly: PeriodRoleSeries[]
  conversations: number
  messages: number
  agentRuns: number
  totalActiveUsers: number
  byRole: RoleUsageRow[]
  firstTimeUsersByWeek: Array<{
    week: string
    label: string
    firstTimeUsers: number
    studentFirstTimeUsers: number
    instructorFirstTimeUsers: number
    adminFirstTimeUsers: number
    guestFirstTimeUsers: number
  }>
}

export type EngagementMetrics = {
  range: AnalyticsDateRange
  activeUsers: number
  agentRuns: number
  messages: number
  avgRunsPerActiveUser: number
  avgToolCallsPerRun: number
  latencyP50Ms: number | null
  latencyP95Ms: number | null
  successRate: number
  errorRate: number
  byHourOfDay: Array<{ hour: number; label: string; requests: number; activeUsers: number }>
  byDayOfWeek: Array<{ dayIndex: number; label: string; requests: number; activeUsers: number }>
}

export type FeatureMixRow = {
  key: string
  name: string
  runs: number
  tokens: number
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  reasoningTokens: number
  providerCostUsd: number
  creditsCharged: number
  activeUsers: number
}

export type FeatureMixMetrics = {
  range: AnalyticsDateRange
  byFeature: FeatureMixRow[]
  byModule: FeatureMixRow[]
  byOperation: FeatureMixRow[]
  topIntents: Array<FeatureMixRow & { module: string; operation: string }>
}

export type CostMixRow = {
  key: string
  name: string
  requests: number
  activeUsers: number
  tokens: number
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  reasoningTokens: number
  providerCostUsd: number
  internalCostUsd: number
  creditsCharged: number
}

export type CostMetrics = {
  range: AnalyticsDateRange
  totals: {
    requests: number
    activeUsers: number
    tokens: number
    inputTokens: number
    cachedInputTokens: number
    outputTokens: number
    reasoningTokens: number
    providerCostUsd: number
    internalCostUsd: number
    creditsCharged: number
    cachedTokenSavingsRate: number
    costPerActiveUser: number
  }
  byRole: CostMixRow[]
  byFeature: CostMixRow[]
  byModel: CostMixRow[]
  byRoutingClass: CostMixRow[]
}

export type LearningSupportMetrics = {
  range: AnalyticsDateRange
  studentRuns: number
  studentActiveUsers: number
  studySupportRuns: number
  logisticsRuns: number
  otherRuns: number
  studySupportShare: number
  logisticsShare: number
  otherShare: number
  studySupportByFeature: FeatureMixRow[]
  logisticsByFeature: FeatureMixRow[]
  integrityRefusals: {
    count: number
    discovered: boolean
    note: string
  }
}

export type OutcomesCorrelationBucket =
  | (SuppressedGroup & { studentCount?: never })
  | {
      key: string
      name: string
      studentCount: number
      avgRunsPerWeek: number
      avgQuizPercent: number | null
      avgQuizScore: number | null
      avgQuizTotalQuestions: number | null
      avgQuizAttempts: number
    }

export type OutcomesCorrelationMetrics = {
  range: AnalyticsDateRange
  courseId: number | null
  weeksInRange: number
  buckets: OutcomesCorrelationBucket[]
}

export function resolveAnalyticsDateRange(input: AnalyticsScope = {}): AnalyticsDateRange {
  const to =
    input.to instanceof Date
      ? input.to.toISOString().slice(0, 10)
      : typeof input.to === "string" && input.to.trim()
        ? input.to.slice(0, 10)
        : new Date().toISOString().slice(0, 10)
  const from =
    input.from instanceof Date
      ? input.from.toISOString().slice(0, 10)
      : typeof input.from === "string" && input.from.trim()
        ? input.from.slice(0, 10)
        : new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return { from, to }
}

function makeDateLabel(value: string, granularity: TimeBucket): string {
  const d = new Date(`${value}T00:00:00Z`)
  switch (granularity) {
    case "day":
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    case "week":
      return `Week of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
    case "month":
      return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
  }
}

function weekCount(from: string, to: string): number {
  const fromMs = new Date(`${from}T00:00:00Z`).getTime()
  const toMs = new Date(`${to}T00:00:00Z`).getTime()
  const days = Math.max(1, Math.floor((toMs - fromMs) / 86_400_000) + 1)
  return Math.max(1, Math.ceil(days / 7))
}

function asNumber(value: unknown): number {
  return Number(value ?? 0)
}

function labelFromKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim()
}

function scopeClauses(scope: AnalyticsScope) {
  const institutionId = scope.institutionId ?? null
  const courseId = scope.courseId ?? null
  return { institutionId, courseId }
}

function filterScopeParams(scope: AnalyticsScope) {
  const { institutionId, courseId } = scopeClauses(scope)
  return { institutionId, courseId }
}

function roleSeriesFromRows(
  rows: Array<{
    bucket: string
    user_role: string
    active_users: number
  }>,
  granularity: TimeBucket,
): PeriodRoleSeries[] {
  const map = new Map<string, PeriodRoleSeries>()
  for (const row of rows) {
    const bucket = String(row.bucket).slice(0, 10)
    const current =
      map.get(bucket) ??
      ({
        bucket,
        label: makeDateLabel(bucket, granularity),
        totalActiveUsers: 0,
        studentActiveUsers: 0,
        instructorActiveUsers: 0,
        adminActiveUsers: 0,
        guestActiveUsers: 0,
      } satisfies PeriodRoleSeries)
    const activeUsers = asNumber(row.active_users)
    current.totalActiveUsers += activeUsers
    if (row.user_role === "student") current.studentActiveUsers += activeUsers
    else if (row.user_role === "instructor") current.instructorActiveUsers += activeUsers
    else if (row.user_role === "admin") current.adminActiveUsers += activeUsers
    else if (row.user_role === "guest") current.guestActiveUsers += activeUsers
    map.set(bucket, current)
  }
  return [...map.values()].sort((a, b) => a.bucket.localeCompare(b.bucket))
}

function coerceFeatureMixRow(row: Record<string, unknown>): FeatureMixRow {
  const key = String(row.key ?? row.feature ?? row.module ?? row.operation ?? "unknown")
  return {
    key,
    name: String(row.name ?? labelFromKey(key)),
    runs: asNumber(row.runs ?? row.requests),
    tokens: asNumber(row.tokens ?? row.total_tokens),
    inputTokens: asNumber(row.input_tokens),
    cachedInputTokens: asNumber(row.cached_input_tokens),
    outputTokens: asNumber(row.output_tokens),
    reasoningTokens: asNumber(row.reasoning_tokens),
    providerCostUsd: asNumber(row.provider_cost_usd),
    creditsCharged: asNumber(row.credits_charged),
    activeUsers: asNumber(row.active_users),
  }
}

function coerceCostRow(row: Record<string, unknown>): CostMixRow {
  const key = String(row.key ?? row.feature ?? row.model ?? row.routing_class ?? row.user_role ?? "unknown")
  return {
    key,
    name: String(row.name ?? labelFromKey(key)),
    requests: asNumber(row.requests),
    activeUsers: asNumber(row.active_users),
    tokens: asNumber(row.tokens),
    inputTokens: asNumber(row.input_tokens),
    cachedInputTokens: asNumber(row.cached_input_tokens),
    outputTokens: asNumber(row.output_tokens),
    reasoningTokens: asNumber(row.reasoning_tokens),
    providerCostUsd: asNumber(row.provider_cost_usd),
    internalCostUsd: asNumber(row.internal_cost_usd),
    creditsCharged: asNumber(row.credits_charged),
  }
}

export function suppressSmallGroups<T extends { key: string; name: string; studentCount: number }>(
  rows: T[],
  minSize: number,
): Array<T | SuppressedGroup> {
  return rows.map((row) => {
    if (row.studentCount < minSize) {
      return { key: row.key, name: row.name, suppressed: true }
    }
    return row
  })
}

export async function adoptionMetrics(scope: AnalyticsScope = {}): Promise<AdoptionMetrics> {
  const range = resolveAnalyticsDateRange(scope)
  const params = filterScopeParams(scope)

  const [dailyRows, weeklyRows, monthlyRows, firstTimeRows, conversationsRows, messagesRows, roleRows, agentRunsRows] =
    await Promise.all([
      sql`
        SELECT
          date_trunc('day', created_at)::date AS bucket,
          user_role,
          COUNT(DISTINCT user_id)::int AS active_users
        FROM cora_usage_events
        WHERE created_at >= ${range.from}::date
          AND created_at < (${range.to}::date + INTERVAL '1 day')
          AND ((${
            params.institutionId
          }::int IS NULL) OR institution_id = ${params.institutionId})
          AND ((${
            params.courseId
          }::int IS NULL) OR course_id = ${params.courseId})
        GROUP BY 1, 2
        ORDER BY 1, 2
      `,
      sql`
        SELECT
          date_trunc('week', created_at)::date AS bucket,
          user_role,
          COUNT(DISTINCT user_id)::int AS active_users
        FROM cora_usage_events
        WHERE created_at >= ${range.from}::date
          AND created_at < (${range.to}::date + INTERVAL '1 day')
          AND ((${
            params.institutionId
          }::int IS NULL) OR institution_id = ${params.institutionId})
          AND ((${
            params.courseId
          }::int IS NULL) OR course_id = ${params.courseId})
        GROUP BY 1, 2
        ORDER BY 1, 2
      `,
      sql`
        SELECT
          date_trunc('month', created_at)::date AS bucket,
          user_role,
          COUNT(DISTINCT user_id)::int AS active_users
        FROM cora_usage_events
        WHERE created_at >= ${range.from}::date
          AND created_at < (${range.to}::date + INTERVAL '1 day')
          AND ((${
            params.institutionId
          }::int IS NULL) OR institution_id = ${params.institutionId})
          AND ((${
            params.courseId
          }::int IS NULL) OR course_id = ${params.courseId})
        GROUP BY 1, 2
        ORDER BY 1, 2
      `,
      sql`
        WITH first_seen AS (
          SELECT
            user_role,
            user_id,
            MIN(created_at)::date AS first_seen_at
          FROM cora_usage_events
          WHERE ((${
            params.institutionId
          }::int IS NULL) OR institution_id = ${params.institutionId})
            AND ((${
              params.courseId
            }::int IS NULL) OR course_id = ${params.courseId})
          GROUP BY 1, 2
        )
        SELECT
          date_trunc('week', first_seen_at)::date AS week,
          COUNT(*)::int AS first_time_users,
          COUNT(*) FILTER (WHERE user_role = 'student')::int AS student_first_time_users,
          COUNT(*) FILTER (WHERE user_role = 'instructor')::int AS instructor_first_time_users,
          COUNT(*) FILTER (WHERE user_role = 'admin')::int AS admin_first_time_users,
          COUNT(*) FILTER (WHERE user_role = 'guest')::int AS guest_first_time_users
        FROM first_seen
        WHERE first_seen_at >= ${range.from}::date
          AND first_seen_at < (${range.to}::date + INTERVAL '1 day')
        GROUP BY 1
        ORDER BY 1
      `,
      sql`
        SELECT COUNT(DISTINCT conversation_id)::int AS conversations
        FROM (
          SELECT conversation_id
          FROM cora_usage_events
          WHERE conversation_id IS NOT NULL
            AND created_at >= ${range.from}::date
            AND created_at < (${range.to}::date + INTERVAL '1 day')
            AND ((${
              params.institutionId
            }::int IS NULL) OR institution_id = ${params.institutionId})
            AND ((${
              params.courseId
            }::int IS NULL) OR course_id = ${params.courseId})
          UNION
          SELECT conversation_id
          FROM cora_agent_runs
          WHERE conversation_id IS NOT NULL
            AND started_at >= ${range.from}::date
            AND started_at < (${range.to}::date + INTERVAL '1 day')
            AND ((${
              params.institutionId
            }::int IS NULL) OR institution_id = ${params.institutionId})
            AND ((${
              params.courseId
            }::int IS NULL) OR course_id = ${params.courseId})
        ) conversations
      `,
      sql`
        SELECT COUNT(*)::int AS messages
        FROM cora_usage_events
        WHERE created_at >= ${range.from}::date
          AND created_at < (${range.to}::date + INTERVAL '1 day')
          AND ((${
            params.institutionId
          }::int IS NULL) OR institution_id = ${params.institutionId})
          AND ((${
            params.courseId
          }::int IS NULL) OR course_id = ${params.courseId})
      `,
      sql`
        SELECT
          user_role,
          COUNT(DISTINCT user_id)::int AS active_users
        FROM cora_usage_events
        WHERE created_at >= ${range.from}::date
          AND created_at < (${range.to}::date + INTERVAL '1 day')
          AND ((${
            params.institutionId
          }::int IS NULL) OR institution_id = ${params.institutionId})
          AND ((${
            params.courseId
          }::int IS NULL) OR course_id = ${params.courseId})
        GROUP BY 1
        ORDER BY 1
      `,
      sql`
        SELECT COUNT(*)::int AS agent_runs
        FROM cora_agent_runs
        WHERE started_at >= ${range.from}::date
          AND started_at < (${range.to}::date + INTERVAL '1 day')
          AND ((${
            params.institutionId
          }::int IS NULL) OR institution_id = ${params.institutionId})
          AND ((${
            params.courseId
          }::int IS NULL) OR course_id = ${params.courseId})
      `,
    ])

  const conversations = conversationsRows as Array<{ conversations?: number }>
  const messages = messagesRows as Array<{ messages?: number }>
  const agentRuns = agentRunsRows as Array<{ agent_runs?: number }>
  const roles = roleRows as Array<{ user_role: string; active_users: number }>
  const firstSeen = firstTimeRows as Array<Record<string, unknown>>

  const byRole = roles.map((row) => ({
    key: row.user_role,
    name: labelFromKey(row.user_role),
    activeUsers: asNumber(row.active_users),
  }))

  return {
    range,
    daily: roleSeriesFromRows(dailyRows as Array<{ bucket: string; user_role: string; active_users: number }>, "day"),
    weekly: roleSeriesFromRows(weeklyRows as Array<{ bucket: string; user_role: string; active_users: number }>, "week"),
    monthly: roleSeriesFromRows(monthlyRows as Array<{ bucket: string; user_role: string; active_users: number }>, "month"),
    conversations: asNumber(conversations[0]?.conversations),
    messages: asNumber(messages[0]?.messages),
    agentRuns: asNumber(agentRuns[0]?.agent_runs),
    totalActiveUsers: byRole.reduce((sum, row) => sum + row.activeUsers, 0),
    byRole,
    firstTimeUsersByWeek: firstSeen.map((row) => {
      const week = String(row.week).slice(0, 10)
      return {
        week,
        label: makeDateLabel(week, "week"),
        firstTimeUsers: asNumber(row.first_time_users),
        studentFirstTimeUsers: asNumber(row.student_first_time_users),
        instructorFirstTimeUsers: asNumber(row.instructor_first_time_users),
        adminFirstTimeUsers: asNumber(row.admin_first_time_users),
        guestFirstTimeUsers: asNumber(row.guest_first_time_users),
      }
    }),
  }
}

export async function engagementMetrics(scope: AnalyticsScope = {}): Promise<EngagementMetrics> {
  const range = resolveAnalyticsDateRange(scope)
  const params = filterScopeParams(scope)
  const [totalsRows, hourRows, dowRows, latencyRows, toolCallRows] = await Promise.all([
    sql`
      SELECT
        COUNT(*)::int AS messages,
        COUNT(DISTINCT user_id)::int AS active_users,
        COUNT(DISTINCT agent_run_id)::int AS agent_runs
      FROM cora_usage_events
      WHERE created_at >= ${range.from}::date
        AND created_at < (${range.to}::date + INTERVAL '1 day')
        AND ((${
          params.institutionId
        }::int IS NULL) OR institution_id = ${params.institutionId})
        AND ((${
          params.courseId
        }::int IS NULL) OR course_id = ${params.courseId})
    `,
    sql`
      SELECT
        EXTRACT(HOUR FROM created_at)::int AS hour,
        COUNT(*)::int AS requests,
        COUNT(DISTINCT user_id)::int AS active_users
      FROM cora_usage_events
      WHERE created_at >= ${range.from}::date
        AND created_at < (${range.to}::date + INTERVAL '1 day')
        AND ((${
          params.institutionId
        }::int IS NULL) OR institution_id = ${params.institutionId})
        AND ((${
          params.courseId
        }::int IS NULL) OR course_id = ${params.courseId})
      GROUP BY 1
      ORDER BY 1
    `,
    sql`
      SELECT
        EXTRACT(DOW FROM created_at)::int AS day_index,
        COUNT(*)::int AS requests,
        COUNT(DISTINCT user_id)::int AS active_users
      FROM cora_usage_events
      WHERE created_at >= ${range.from}::date
        AND created_at < (${range.to}::date + INTERVAL '1 day')
        AND ((${
          params.institutionId
        }::int IS NULL) OR institution_id = ${params.institutionId})
        AND ((${
          params.courseId
        }::int IS NULL) OR course_id = ${params.courseId})
      GROUP BY 1
      ORDER BY 1
    `,
    sql`
      SELECT
        percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms) AS p50,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95,
        COUNT(*) FILTER (WHERE status = 'success')::int AS successes,
        COUNT(*) FILTER (WHERE status = 'error')::int AS errors
      FROM cora_usage_events
      WHERE latency_ms IS NOT NULL
        AND created_at >= ${range.from}::date
        AND created_at < (${range.to}::date + INTERVAL '1 day')
        AND ((${
          params.institutionId
        }::int IS NULL) OR institution_id = ${params.institutionId})
        AND ((${
          params.courseId
        }::int IS NULL) OR course_id = ${params.courseId})
    `,
    sql`
      SELECT COALESCE(AVG(tool_calls), 0)::float AS avg_tool_calls
      FROM cora_agent_runs
      WHERE started_at >= ${range.from}::date
        AND started_at < (${range.to}::date + INTERVAL '1 day')
        AND ((${
          params.institutionId
        }::int IS NULL) OR institution_id = ${params.institutionId})
        AND ((${
          params.courseId
        }::int IS NULL) OR course_id = ${params.courseId})
    `,
  ])

  const totalRows = totalsRows as Array<{ messages?: number; active_users?: number; agent_runs?: number }>
  const latencyResultRows = latencyRows as Array<{ p50?: number; p95?: number; successes?: number; errors?: number }>
  const toolCalls = toolCallRows as Array<{ avg_tool_calls?: number }>
  const total = totalRows[0] ?? {}
  const latency = latencyResultRows[0] ?? {}
  const messages = asNumber(total.messages)
  const activeUsers = asNumber(total.active_users)
  const agentRuns = asNumber(total.agent_runs)
  const successCount = asNumber(latency.successes)
  const errorCount = asNumber(latency.errors)
  const requestCount = successCount + errorCount

  return {
    range,
    activeUsers,
    agentRuns,
    messages,
    avgRunsPerActiveUser: activeUsers > 0 ? Math.round((agentRuns / activeUsers) * 100) / 100 : 0,
    avgToolCallsPerRun: agentRuns > 0 ? Math.round(asNumber(toolCalls[0]?.avg_tool_calls) * 100) / 100 : 0,
    latencyP50Ms: latency.p50 != null ? Math.round(Number(latency.p50)) : null,
    latencyP95Ms: latency.p95 != null ? Math.round(Number(latency.p95)) : null,
    successRate: requestCount > 0 ? Math.round((successCount / requestCount) * 1000) / 10 : 0,
    errorRate: requestCount > 0 ? Math.round((errorCount / requestCount) * 1000) / 10 : 0,
    byHourOfDay: (hourRows as Array<{ hour: number; requests: number; active_users: number }>).map((row) => ({
      hour: Number(row.hour),
      label: `${String(row.hour).padStart(2, "0")}:00`,
      requests: asNumber(row.requests),
      activeUsers: asNumber(row.active_users),
    })),
    byDayOfWeek: (dowRows as Array<{ day_index: number; requests: number; active_users: number }>).map((row) => {
      const labelByIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      const dayIndex = Number(row.day_index)
      return {
        dayIndex,
        label: labelByIndex[dayIndex] ?? String(dayIndex),
        requests: asNumber(row.requests),
        activeUsers: asNumber(row.active_users),
      }
    }),
  }
}

export async function featureMix(scope: AnalyticsScope = {}): Promise<FeatureMixMetrics> {
  const range = resolveAnalyticsDateRange(scope)
  const params = filterScopeParams(scope)
  const featureRows = await sql`
    SELECT
      feature AS key,
      feature AS name,
      COUNT(*)::int AS runs,
      COALESCE(SUM(total_tokens), 0)::bigint AS tokens,
      COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
      COALESCE(SUM(cached_input_tokens), 0)::bigint AS cached_input_tokens,
      COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
      COALESCE(SUM(reasoning_tokens), 0)::bigint AS reasoning_tokens,
      COALESCE(SUM(provider_cost_usd), 0)::float AS provider_cost_usd,
      COALESCE(SUM(credits_charged), 0)::int AS credits_charged,
      COUNT(DISTINCT user_id)::int AS active_users
    FROM cora_usage_events
    WHERE created_at >= ${range.from}::date
      AND created_at < (${range.to}::date + INTERVAL '1 day')
      AND ((${
        params.institutionId
      }::int IS NULL) OR institution_id = ${params.institutionId})
      AND ((${
        params.courseId
      }::int IS NULL) OR course_id = ${params.courseId})
    GROUP BY 1, 2
    ORDER BY tokens DESC, runs DESC
  `
  const moduleRows = await sql`
    SELECT
      COALESCE(NULLIF(TRIM(module), ''), 'unknown') AS key,
      COALESCE(NULLIF(TRIM(module), ''), 'unknown') AS name,
      COUNT(*)::int AS runs,
      COALESCE(SUM(total_tokens), 0)::bigint AS tokens,
      COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
      COALESCE(SUM(cached_input_tokens), 0)::bigint AS cached_input_tokens,
      COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
      COALESCE(SUM(reasoning_tokens), 0)::bigint AS reasoning_tokens,
      COALESCE(SUM(provider_cost_usd), 0)::float AS provider_cost_usd,
      COALESCE(SUM(credits_charged), 0)::int AS credits_charged,
      COUNT(DISTINCT user_id)::int AS active_users
    FROM cora_usage_events
    WHERE created_at >= ${range.from}::date
      AND created_at < (${range.to}::date + INTERVAL '1 day')
      AND ((${
        params.institutionId
      }::int IS NULL) OR institution_id = ${params.institutionId})
      AND ((${
        params.courseId
      }::int IS NULL) OR course_id = ${params.courseId})
    GROUP BY 1, 2
    ORDER BY tokens DESC, runs DESC
  `
  const operationRows = await sql`
    SELECT
      COALESCE(NULLIF(TRIM(operation), ''), 'unknown') AS key,
      COALESCE(NULLIF(TRIM(operation), ''), 'unknown') AS name,
      COUNT(*)::int AS runs,
      COALESCE(SUM(total_tokens), 0)::bigint AS tokens,
      COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
      COALESCE(SUM(cached_input_tokens), 0)::bigint AS cached_input_tokens,
      COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
      COALESCE(SUM(reasoning_tokens), 0)::bigint AS reasoning_tokens,
      COALESCE(SUM(provider_cost_usd), 0)::float AS provider_cost_usd,
      COALESCE(SUM(credits_charged), 0)::int AS credits_charged,
      COUNT(DISTINCT user_id)::int AS active_users
    FROM cora_usage_events
    WHERE created_at >= ${range.from}::date
      AND created_at < (${range.to}::date + INTERVAL '1 day')
      AND ((${
        params.institutionId
      }::int IS NULL) OR institution_id = ${params.institutionId})
      AND ((${
        params.courseId
      }::int IS NULL) OR course_id = ${params.courseId})
    GROUP BY 1, 2
    ORDER BY tokens DESC, runs DESC
  `
  const intentRows = await sql`
    SELECT
      feature,
      COALESCE(NULLIF(TRIM(module), ''), 'unknown') AS module,
      COALESCE(NULLIF(TRIM(operation), ''), 'unknown') AS operation,
      COUNT(*)::int AS runs,
      COALESCE(SUM(total_tokens), 0)::bigint AS tokens,
      COALESCE(SUM(provider_cost_usd), 0)::float AS provider_cost_usd,
      COUNT(DISTINCT user_id)::int AS active_users
    FROM cora_usage_events
    WHERE created_at >= ${range.from}::date
      AND created_at < (${range.to}::date + INTERVAL '1 day')
      AND ((${
        params.institutionId
      }::int IS NULL) OR institution_id = ${params.institutionId})
      AND ((${
        params.courseId
      }::int IS NULL) OR course_id = ${params.courseId})
    GROUP BY 1, 2, 3
    ORDER BY tokens DESC, runs DESC
    LIMIT 20
  `

  return {
    range,
    byFeature: (featureRows as Array<Record<string, unknown>>).map(coerceFeatureMixRow),
    byModule: (moduleRows as Array<Record<string, unknown>>).map(coerceFeatureMixRow),
    byOperation: (operationRows as Array<Record<string, unknown>>).map(coerceFeatureMixRow),
    topIntents: (intentRows as Array<Record<string, unknown>>).map((row) => ({
      ...coerceFeatureMixRow({
        key: `${String(row.feature ?? "unknown")}:${String(row.module ?? "unknown")}:${String(row.operation ?? "unknown")}`,
        name: `${String(row.feature ?? "unknown")} · ${String(row.module ?? "unknown")} · ${String(row.operation ?? "unknown")}`,
        runs: row.runs,
        tokens: row.tokens,
        provider_cost_usd: row.provider_cost_usd,
        active_users: row.active_users,
      }),
      module: String(row.module ?? "unknown"),
      operation: String(row.operation ?? "unknown"),
    })),
  }
}

export async function costMetrics(scope: AnalyticsScope = {}): Promise<CostMetrics> {
  const range = resolveAnalyticsDateRange(scope)
  const params = filterScopeParams(scope)
  const [totalsRows, byRoleRows, byFeatureRows, byModelRows, byRoutingRows] = await Promise.all([
    sql`
      SELECT
        COUNT(*)::int AS requests,
        COUNT(DISTINCT user_id)::int AS active_users,
        COALESCE(SUM(total_tokens), 0)::bigint AS tokens,
        COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
        COALESCE(SUM(cached_input_tokens), 0)::bigint AS cached_input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
        COALESCE(SUM(reasoning_tokens), 0)::bigint AS reasoning_tokens,
        COALESCE(SUM(provider_cost_usd), 0)::float AS provider_cost_usd,
        COALESCE(SUM(internal_cost_usd), 0)::float AS internal_cost_usd,
        COALESCE(SUM(credits_charged), 0)::int AS credits_charged
      FROM cora_usage_events
      WHERE created_at >= ${range.from}::date
        AND created_at < (${range.to}::date + INTERVAL '1 day')
        AND ((${
          params.institutionId
        }::int IS NULL) OR institution_id = ${params.institutionId})
        AND ((${
          params.courseId
        }::int IS NULL) OR course_id = ${params.courseId})
    `,
    sql`
      SELECT
        user_role AS key,
        user_role AS name,
        COUNT(*)::int AS requests,
        COUNT(DISTINCT user_id)::int AS active_users,
        COALESCE(SUM(total_tokens), 0)::bigint AS tokens,
        COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
        COALESCE(SUM(cached_input_tokens), 0)::bigint AS cached_input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
        COALESCE(SUM(reasoning_tokens), 0)::bigint AS reasoning_tokens,
        COALESCE(SUM(provider_cost_usd), 0)::float AS provider_cost_usd,
        COALESCE(SUM(internal_cost_usd), 0)::float AS internal_cost_usd,
        COALESCE(SUM(credits_charged), 0)::int AS credits_charged
      FROM cora_usage_events
      WHERE created_at >= ${range.from}::date
        AND created_at < (${range.to}::date + INTERVAL '1 day')
        AND ((${
          params.institutionId
        }::int IS NULL) OR institution_id = ${params.institutionId})
        AND ((${
          params.courseId
        }::int IS NULL) OR course_id = ${params.courseId})
      GROUP BY 1, 2
      ORDER BY provider_cost_usd DESC
    `,
    sql`
      SELECT
        feature AS key,
        feature AS name,
        COUNT(*)::int AS requests,
        COUNT(DISTINCT user_id)::int AS active_users,
        COALESCE(SUM(total_tokens), 0)::bigint AS tokens,
        COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
        COALESCE(SUM(cached_input_tokens), 0)::bigint AS cached_input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
        COALESCE(SUM(reasoning_tokens), 0)::bigint AS reasoning_tokens,
        COALESCE(SUM(provider_cost_usd), 0)::float AS provider_cost_usd,
        COALESCE(SUM(internal_cost_usd), 0)::float AS internal_cost_usd,
        COALESCE(SUM(credits_charged), 0)::int AS credits_charged
      FROM cora_usage_events
      WHERE created_at >= ${range.from}::date
        AND created_at < (${range.to}::date + INTERVAL '1 day')
        AND ((${
          params.institutionId
        }::int IS NULL) OR institution_id = ${params.institutionId})
        AND ((${
          params.courseId
        }::int IS NULL) OR course_id = ${params.courseId})
      GROUP BY 1, 2
      ORDER BY provider_cost_usd DESC
    `,
    sql`
      SELECT
        COALESCE(NULLIF(TRIM(model), ''), 'unknown') AS key,
        COALESCE(NULLIF(TRIM(model), ''), 'unknown') AS name,
        COUNT(*)::int AS requests,
        COUNT(DISTINCT user_id)::int AS active_users,
        COALESCE(SUM(total_tokens), 0)::bigint AS tokens,
        COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
        COALESCE(SUM(cached_input_tokens), 0)::bigint AS cached_input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
        COALESCE(SUM(reasoning_tokens), 0)::bigint AS reasoning_tokens,
        COALESCE(SUM(provider_cost_usd), 0)::float AS provider_cost_usd,
        COALESCE(SUM(internal_cost_usd), 0)::float AS internal_cost_usd,
        COALESCE(SUM(credits_charged), 0)::int AS credits_charged
      FROM cora_usage_events
      WHERE created_at >= ${range.from}::date
        AND created_at < (${range.to}::date + INTERVAL '1 day')
        AND ((${
          params.institutionId
        }::int IS NULL) OR institution_id = ${params.institutionId})
        AND ((${
          params.courseId
        }::int IS NULL) OR course_id = ${params.courseId})
      GROUP BY 1, 2
      ORDER BY provider_cost_usd DESC
    `,
    sql`
      SELECT
        COALESCE(NULLIF(TRIM(routing_class), ''), 'unknown') AS key,
        COALESCE(NULLIF(TRIM(routing_class), ''), 'unknown') AS name,
        COUNT(*)::int AS requests,
        COUNT(DISTINCT user_id)::int AS active_users,
        COALESCE(SUM(total_tokens), 0)::bigint AS tokens,
        COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
        COALESCE(SUM(cached_input_tokens), 0)::bigint AS cached_input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
        COALESCE(SUM(reasoning_tokens), 0)::bigint AS reasoning_tokens,
        COALESCE(SUM(provider_cost_usd), 0)::float AS provider_cost_usd,
        COALESCE(SUM(internal_cost_usd), 0)::float AS internal_cost_usd,
        COALESCE(SUM(credits_charged), 0)::int AS credits_charged
      FROM cora_usage_events
      WHERE created_at >= ${range.from}::date
        AND created_at < (${range.to}::date + INTERVAL '1 day')
        AND ((${
          params.institutionId
        }::int IS NULL) OR institution_id = ${params.institutionId})
        AND ((${
          params.courseId
        }::int IS NULL) OR course_id = ${params.courseId})
      GROUP BY 1, 2
      ORDER BY provider_cost_usd DESC
    `,
  ])

  const totalsRowsTyped = totalsRows as Array<Record<string, unknown>>
  const totals = totalsRowsTyped[0] ?? {}
  const inputTokens = asNumber(totals.input_tokens)
  const cachedInputTokens = asNumber(totals.cached_input_tokens)
  const activeUsers = asNumber(totals.active_users)
  return {
    range,
    totals: {
      requests: asNumber(totals.requests),
      activeUsers,
      tokens: asNumber(totals.tokens),
      inputTokens,
      cachedInputTokens,
      outputTokens: asNumber(totals.output_tokens),
      reasoningTokens: asNumber(totals.reasoning_tokens),
      providerCostUsd: asNumber(totals.provider_cost_usd),
      internalCostUsd: asNumber(totals.internal_cost_usd),
      creditsCharged: asNumber(totals.credits_charged),
      cachedTokenSavingsRate: inputTokens > 0 ? Math.round((cachedInputTokens / inputTokens) * 1000) / 10 : 0,
      costPerActiveUser: activeUsers > 0 ? Math.round((asNumber(totals.provider_cost_usd) / activeUsers) * 100) / 100 : 0,
    },
    byRole: (byRoleRows as Array<Record<string, unknown>>).map(coerceCostRow),
    byFeature: (byFeatureRows as Array<Record<string, unknown>>).map(coerceCostRow),
    byModel: (byModelRows as Array<Record<string, unknown>>).map(coerceCostRow),
    byRoutingClass: (byRoutingRows as Array<Record<string, unknown>>).map(coerceCostRow),
  }
}

function classifySupportCategory(feature: string, moduleName: string, operation: string): "study_support" | "logistics" | "other" {
  const blob = `${feature} ${moduleName} ${operation}`.toLowerCase()
  if (/(practice|flashcard|note|study|tutor|quiz|homework|lecture|remediation|step_by_step|step-by-step)/.test(blob)) {
    return "study_support"
  }
  if (/(calendar|message|announcement|syllabus|notification|deadline|logistics|schedule|attendance|remind)/.test(blob)) {
    return "logistics"
  }
  return "other"
}

export async function learningSupportMetrics(scope: AnalyticsScope = {}): Promise<LearningSupportMetrics> {
  const range = resolveAnalyticsDateRange(scope)
  const params = filterScopeParams(scope)
  const [rows, studentCountRows] = await Promise.all([
    sql`
    SELECT
      feature,
      COALESCE(NULLIF(TRIM(module), ''), 'unknown') AS module,
      COALESCE(NULLIF(TRIM(operation), ''), 'unknown') AS operation,
      COUNT(*)::int AS runs,
      COUNT(DISTINCT user_id)::int AS active_users,
      COALESCE(SUM(total_tokens), 0)::bigint AS tokens,
      COALESCE(SUM(provider_cost_usd), 0)::float AS provider_cost_usd,
      COALESCE(SUM(credits_charged), 0)::int AS credits_charged
    FROM cora_usage_events
    WHERE user_role = 'student'
      AND created_at >= ${range.from}::date
      AND created_at < (${range.to}::date + INTERVAL '1 day')
      AND ((${
        params.institutionId
      }::int IS NULL) OR institution_id = ${params.institutionId})
      AND ((${
        params.courseId
      }::int IS NULL) OR course_id = ${params.courseId})
    GROUP BY 1, 2, 3
    ORDER BY runs DESC, tokens DESC
  `,
    sql`
      SELECT COUNT(DISTINCT user_id)::int AS active_students
      FROM cora_usage_events
      WHERE user_role = 'student'
        AND created_at >= ${range.from}::date
        AND created_at < (${range.to}::date + INTERVAL '1 day')
        AND ((${
          params.institutionId
        }::int IS NULL) OR institution_id = ${params.institutionId})
        AND ((${
          params.courseId
        }::int IS NULL) OR course_id = ${params.courseId})
    `,
  ])

  const studentCountTyped = studentCountRows as Array<{ active_students?: number }>
  let studentRuns = 0
  let studentActiveUsers = asNumber(studentCountTyped[0]?.active_students)
  let studySupportRuns = 0
  let logisticsRuns = 0
  let otherRuns = 0
  const studySupportByFeature: FeatureMixRow[] = []
  const logisticsByFeature: FeatureMixRow[] = []
  for (const row of rows as Array<Record<string, unknown>>) {
    const feature = String(row.feature ?? "OTHER")
    const moduleName = String(row.module ?? "unknown")
    const operation = String(row.operation ?? "unknown")
    const category = classifySupportCategory(feature, moduleName, operation)
    const mapped: FeatureMixRow = {
      key: `${feature}:${moduleName}:${operation}`,
      name: `${feature} · ${moduleName} · ${operation}`,
      runs: asNumber(row.runs),
      tokens: asNumber(row.tokens),
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      providerCostUsd: asNumber(row.provider_cost_usd),
      creditsCharged: asNumber(row.credits_charged),
      activeUsers: asNumber(row.active_users),
    }
    studentRuns += mapped.runs
    if (category === "study_support") {
      studySupportRuns += mapped.runs
      studySupportByFeature.push(mapped)
    } else if (category === "logistics") {
      logisticsRuns += mapped.runs
      logisticsByFeature.push(mapped)
    } else {
      otherRuns += mapped.runs
    }
  }

  const integrityRows = await sql`
    SELECT COUNT(*)::int AS count
    FROM cora_usage_events
    WHERE user_role = 'student'
      AND created_at >= ${range.from}::date
      AND created_at < (${range.to}::date + INTERVAL '1 day')
      AND ((${
        params.institutionId
      }::int IS NULL) OR institution_id = ${params.institutionId})
      AND ((${
        params.courseId
      }::int IS NULL) OR course_id = ${params.courseId})
      AND (
        feature ILIKE '%integrity%'
        OR COALESCE(module, '') ILIKE '%integrity%'
        OR COALESCE(operation, '') ILIKE '%integrity%'
        OR COALESCE(tool_name, '') ILIKE '%integrity%'
        OR (status = 'error' AND COALESCE(error_code, '') ILIKE '%integrity%')
        OR (status = 'error' AND COALESCE(error_code, '') ILIKE '%refus%')
      )
  `
  const integrityCount = asNumber((integrityRows as Array<{ count?: number }>)[0]?.count)

  return {
    range,
    studentRuns,
    studentActiveUsers,
    studySupportRuns,
    logisticsRuns,
    otherRuns,
    studySupportShare: studentRuns > 0 ? Math.round((studySupportRuns / studentRuns) * 1000) / 10 : 0,
    logisticsShare: studentRuns > 0 ? Math.round((logisticsRuns / studentRuns) * 1000) / 10 : 0,
    otherShare: studentRuns > 0 ? Math.round((otherRuns / studentRuns) * 1000) / 10 : 0,
    studySupportByFeature: studySupportByFeature.sort((a, b) => b.runs - a.runs),
    logisticsByFeature: logisticsByFeature.sort((a, b) => b.runs - a.runs),
    integrityRefusals: {
      count: integrityCount,
      discovered: integrityCount > 0,
      note:
        integrityCount > 0
          ? "A refusal-like integrity signal is present in usage_events."
          : "No direct integrity refusal signal was observed in usage_events; this is likely logged elsewhere today.",
    },
  }
}

export async function outcomesCorrelation(scope: AnalyticsScope & { courseId?: number | null } = {}): Promise<OutcomesCorrelationMetrics> {
  const range = resolveAnalyticsDateRange(scope)
  const params = filterScopeParams(scope)
  const weeksInRange = weekCount(range.from, range.to)
  const rows = await sql`
    WITH scoped_students AS (
      SELECT
        st.id,
        st.course_id
      FROM students st
      LEFT JOIN courses c ON c.id = st.course_id
      WHERE st.deleted_at IS NULL
        AND (
          (${params.courseId}::int IS NOT NULL AND st.course_id = ${params.courseId})
          OR (${params.courseId}::int IS NULL AND ${params.institutionId}::int IS NOT NULL AND c.university_id = ${params.institutionId})
        )
    ),
    usage AS (
      SELECT
        u.user_id::int AS student_id,
        COUNT(*)::int AS runs
      FROM cora_usage_events u
      JOIN scoped_students ss ON ss.id = u.user_id
      WHERE u.user_role = 'student'
        AND u.created_at >= ${range.from}::date
        AND u.created_at < (${range.to}::date + INTERVAL '1 day')
      GROUP BY 1
    ),
    quizzes AS (
      SELECT
        qa.student_id,
        COUNT(*)::int AS attempts,
        AVG(CASE WHEN qa.total_questions > 0 THEN (qa.score::numeric / qa.total_questions::numeric) * 100 END) AS avg_percent,
        AVG(qa.score::numeric) AS avg_score,
        AVG(qa.total_questions::numeric) AS avg_total_questions
      FROM quiz_attempts qa
      JOIN scoped_students ss ON ss.id = qa.student_id
      WHERE qa.deleted_at IS NULL
        AND COALESCE(qa.completed_at, qa.started_at)::date >= ${range.from}::date
        AND COALESCE(qa.completed_at, qa.started_at)::date < (${range.to}::date + INTERVAL '1 day')
      GROUP BY 1
    )
    SELECT
      ss.id AS student_id,
      COALESCE(u.runs, 0)::int AS runs,
      COALESCE(q.attempts, 0)::int AS attempts,
      q.avg_percent,
      q.avg_score,
      q.avg_total_questions
    FROM scoped_students ss
    LEFT JOIN usage u ON u.student_id = ss.id
    LEFT JOIN quizzes q ON q.student_id = ss.id
    ORDER BY ss.id
  `

  type StudentRow = {
    student_id: number
    runs: number
    attempts: number
    avg_percent: number | null
    avg_score: number | null
    avg_total_questions: number | null
  }

  const studentRows = rows as StudentRow[]
  const bucketMap = new Map<
    string,
    {
      key: string
      name: string
      studentCount: number
      totalRunsPerWeek: number
      quizPercentSum: number
      quizScoreSum: number
      quizTotalQuestionsSum: number
      quizAttemptsSum: number
      quizPercentSamples: number
    }
  >()

  for (const row of studentRows) {
    const runsPerWeek = row.runs / weeksInRange
    const key =
      row.runs === 0
        ? "none"
        : runsPerWeek <= 2
          ? "light"
          : runsPerWeek <= 5
            ? "moderate"
            : "heavy"
    const bucket =
      bucketMap.get(key) ??
      {
        key,
        name: labelFromKey(key),
        studentCount: 0,
        totalRunsPerWeek: 0,
        quizPercentSum: 0,
        quizScoreSum: 0,
        quizTotalQuestionsSum: 0,
        quizAttemptsSum: 0,
        quizPercentSamples: 0,
      }
    bucket.studentCount += 1
    bucket.totalRunsPerWeek += runsPerWeek
    if (row.avg_percent != null) {
      bucket.quizPercentSum += Number(row.avg_percent)
      bucket.quizPercentSamples += 1
    }
    if (row.avg_score != null) bucket.quizScoreSum += Number(row.avg_score)
    if (row.avg_total_questions != null) bucket.quizTotalQuestionsSum += Number(row.avg_total_questions)
    bucket.quizAttemptsSum += row.attempts
    bucketMap.set(key, bucket)
  }

  const orderedBuckets = ["none", "light", "moderate", "heavy"].map((key) => {
    const bucket =
      bucketMap.get(key) ??
      {
        key,
        name: labelFromKey(key),
        studentCount: 0,
        totalRunsPerWeek: 0,
        quizPercentSum: 0,
        quizScoreSum: 0,
        quizTotalQuestionsSum: 0,
        quizAttemptsSum: 0,
        quizPercentSamples: 0,
      }
    const avgRunsPerWeek = bucket.studentCount > 0 ? bucket.totalRunsPerWeek / bucket.studentCount : 0
    return {
      key: bucket.key,
      name: bucket.name,
      studentCount: bucket.studentCount,
      avgRunsPerWeek: Math.round(avgRunsPerWeek * 100) / 100,
      avgQuizPercent:
        bucket.quizPercentSamples > 0 ? Math.round((bucket.quizPercentSum / bucket.quizPercentSamples) * 10) / 10 : null,
      avgQuizScore:
        bucket.studentCount > 0 ? Math.round((bucket.quizScoreSum / bucket.studentCount) * 10) / 10 : null,
      avgQuizTotalQuestions:
        bucket.studentCount > 0 ? Math.round((bucket.quizTotalQuestionsSum / bucket.studentCount) * 10) / 10 : null,
      avgQuizAttempts: bucket.studentCount > 0 ? Math.round((bucket.quizAttemptsSum / bucket.studentCount) * 10) / 10 : 0,
    }
  })

  const minSize = scope.courseId != null ? 5 : 3
  const buckets = suppressSmallGroups(orderedBuckets, minSize) as OutcomesCorrelationBucket[]

  return {
    range,
    courseId: scope.courseId ?? null,
    weeksInRange,
    buckets,
  }
}

