import { createHash, randomUUID } from "crypto"
import { type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { ensureSystemLogsSchema } from "@/lib/ensure-system-logs-schema"
import {
  type GroupStatus,
  type LogCategory,
  type LogSeverity,
  type SystemLogRow,
} from "@/lib/system-log-constants"
import { buildSystemLogDescription } from "@/lib/system-log-diagnostics"

export type GroupRecurrenceBehavior = "reopen_resolved" | "needs_attention" | "preserve"

export type SystemLogInput = {
  severity: LogSeverity
  category: LogCategory
  title?: string | null
  description?: string | null
  errorMessage?: string | null
  stackTrace?: string | null
  moduleName?: string | null
  featureName?: string | null
  pageUrl?: string | null
  route?: string | null
  apiEndpoint?: string | null
  httpMethod?: string | null
  httpStatusCode?: number | null
  userId?: string | null
  userName?: string | null
  userRole?: string | null
  courseId?: number | null
  courseName?: string | null
  browser?: string | null
  operatingSystem?: string | null
  deviceType?: string | null
  screenResolution?: string | null
  ipAddress?: string | null
  sessionId?: string | null
  executionTimeMs?: number | null
  metadata?: Record<string, unknown>
  rootCauseHints?: string[]
  userAgent?: string | null
  environment?: string | null
  /** Override error fingerprint for grouped issues (e.g. assessment-issue:123) */
  groupFingerprint?: string | null
  /** Initial / target group status when creating or on recurrence */
  groupStatus?: GroupStatus
  groupOnRecurrence?: GroupRecurrenceBehavior
  /** Group warnings/info (assessment panel items) not only errors */
  alwaysGroup?: boolean
}

export function getAppEnvironment(): string {
  return (
    process.env.VERCEL_ENV ||
    process.env.NODE_ENV ||
    "production"
  )
}

export function computeErrorFingerprint(input: {
  category: string
  moduleName?: string | null
  apiEndpoint?: string | null
  errorMessage?: string | null
  stackTrace?: string | null
}): string {
  const stackLine = input.stackTrace?.split("\n").find((l) => l.trim())?.trim() ?? ""
  const key = [
    input.category,
    input.moduleName ?? "",
    input.apiEndpoint ?? "",
    (input.errorMessage ?? "").slice(0, 300),
    stackLine.slice(0, 200),
  ].join("|")
  return createHash("sha256").update(key).digest("hex").slice(0, 32)
}

function inferRootCauseHints(input: SystemLogInput): string[] {
  const hints: string[] = []
  const msg = (input.errorMessage ?? "").toLowerCase()
  const stack = (input.stackTrace ?? "").toLowerCase()

  if (input.httpStatusCode === 401 || msg.includes("unauthorized")) {
    hints.push("Authentication token may be missing or expired")
  }
  if (input.httpStatusCode === 403 || msg.includes("forbidden") || msg.includes("permission")) {
    hints.push("User may lack required role or course permission")
  }
  if (input.httpStatusCode === 404 || msg.includes("not found")) {
    hints.push("Referenced resource may have been deleted or ID is invalid")
  }
  if (input.httpStatusCode === 409 || msg.includes("duplicate") || msg.includes("unique constraint")) {
    hints.push("Duplicate record or unique constraint violation")
  }
  if (input.httpStatusCode === 429) {
    hints.push("Rate limit exceeded — consider throttling or retry backoff")
  }
  if (msg.includes("timeout") || msg.includes("statement_timeout")) {
    hints.push("Database or API query exceeded timeout threshold")
  }
  if (msg.includes("connection") && (msg.includes("refused") || msg.includes("terminated"))) {
    hints.push("Database connection failure — check DATABASE_URL and pool health")
  }
  if (msg.includes("foreign key")) {
    hints.push("Foreign key constraint — parent record may be missing")
  }
  if (msg.includes("hydration")) {
    hints.push("React hydration mismatch — server/client HTML differs")
  }
  if (stack.includes("chunkloaderror") || msg.includes("loading chunk")) {
    hints.push("Stale deployment — user may need hard refresh after deploy")
  }
  if (input.category === "storage") {
    hints.push("File storage provider or upload configuration issue")
  }
  if (input.category === "email") {
    hints.push("SMTP or email delivery service configuration issue")
  }

  return [...new Set([...(input.rootCauseHints ?? []), ...hints])]
}

function deriveTitle(input: SystemLogInput): string {
  if (input.title?.trim()) return input.title.trim()
  if (input.errorMessage?.trim()) return input.errorMessage.trim().slice(0, 200)
  return `${input.category} ${input.severity}`.replace(/^\w/, (c) => c.toUpperCase())
}

async function incrementExistingLogGroup(
  fingerprint: string,
  input: SystemLogInput,
  options: {
    onRecurrence: GroupRecurrenceBehavior
    userId: string | null
  },
): Promise<number | null> {
  const existing = await sql`
    SELECT id, affected_user_count, status FROM system_log_groups WHERE fingerprint = ${fingerprint} LIMIT 1
  `
  if (existing.length === 0) return null

  const groupId = Number((existing[0] as { id: number }).id)
  const prevAffected = Number((existing[0] as { affected_user_count: number }).affected_user_count)

  let affectedDelta = 0
  if (options.userId) {
    const [userCheck] = await sql`
      SELECT 1 FROM system_logs
      WHERE fingerprint = ${fingerprint} AND user_id = ${options.userId}
      LIMIT 1
    `
    if (!userCheck) affectedDelta = 1
  }

  const prevStatus = String((existing[0] as { status: string }).status)
  const shouldReopenResolved =
    options.onRecurrence === "reopen_resolved" && prevStatus === "resolved"
  const shouldNeedsAttention =
    options.onRecurrence === "needs_attention" &&
    (prevStatus === "resolved" || prevStatus === "open")

  await sql`
    UPDATE system_log_groups SET
      occurrence_count = occurrence_count + 1,
      affected_user_count = ${prevAffected + affectedDelta},
      last_seen_at = NOW(),
      severity = CASE
        WHEN ${input.severity} = 'critical' THEN 'critical'
        WHEN severity = 'critical' THEN 'critical'
        WHEN ${input.severity} = 'error' AND severity NOT IN ('critical') THEN 'error'
        ELSE severity
      END,
      status = CASE
        WHEN ${shouldNeedsAttention} THEN 'needs_attention'
        WHEN ${shouldReopenResolved} THEN 'open'
        ELSE status
      END,
      resolved_at = CASE
        WHEN ${shouldNeedsAttention} OR ${shouldReopenResolved} THEN NULL
        ELSE resolved_at
      END,
      resolved_by = CASE
        WHEN ${shouldNeedsAttention} OR ${shouldReopenResolved} THEN NULL
        ELSE resolved_by
      END,
      updated_at = NOW()
    WHERE id = ${groupId}
  `
  return groupId
}

async function upsertLogGroup(
  fingerprint: string,
  input: SystemLogInput,
  title: string,
  options?: {
    initialStatus?: GroupStatus
    onRecurrence?: GroupRecurrenceBehavior
  },
): Promise<number | null> {
  const initialStatus = options?.initialStatus ?? "open"
  const onRecurrence = options?.onRecurrence ?? "reopen_resolved"
  const userId = input.userId?.trim() || null

  const existingId = await incrementExistingLogGroup(fingerprint, input, { onRecurrence, userId })
  if (existingId != null) return existingId

  try {
    const [inserted] = await sql`
      INSERT INTO system_log_groups (
        fingerprint, title, severity, category, module_name,
        occurrence_count, affected_user_count, first_seen_at, last_seen_at, status
      ) VALUES (
        ${fingerprint},
        ${title},
        ${input.severity},
        ${input.category},
        ${input.moduleName ?? null},
        1,
        ${userId ? 1 : 0},
        NOW(),
        NOW(),
        ${initialStatus}
      )
      RETURNING id
    `
    return inserted ? Number((inserted as { id: number }).id) : null
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : undefined
    if (code === "23505") {
      return incrementExistingLogGroup(fingerprint, input, { onRecurrence, userId })
    }
    throw error
  }
}

/** Fire-and-forget system log insert. Never throws. */
export async function logSystemEvent(input: SystemLogInput): Promise<string | null> {
  try {
    await ensureSystemLogsSchema()

    const logId = randomUUID()
    const title = deriveTitle(input)
    const description = buildSystemLogDescription(input)
    const fingerprint =
      input.groupFingerprint ??
      computeErrorFingerprint({
        category: input.category,
        moduleName: input.moduleName,
        apiEndpoint: input.apiEndpoint,
        errorMessage: input.errorMessage,
        stackTrace: input.stackTrace,
      })
    const hints = inferRootCauseHints(input)
    const metadata = JSON.stringify(input.metadata ?? {})
    const hintsJson = JSON.stringify(hints)
    const environment = input.environment ?? getAppEnvironment()

    const shouldGroup =
      input.alwaysGroup ||
      input.severity === "error" ||
      input.severity === "critical" ||
      input.groupStatus === "needs_attention"

    const groupId = shouldGroup
      ? await upsertLogGroup(fingerprint, input, title, {
          initialStatus: input.groupStatus ?? "open",
          onRecurrence: input.groupOnRecurrence ?? "reopen_resolved",
        })
      : null

    await sql`
      INSERT INTO system_logs (
        log_id, group_id, fingerprint, environment, severity, category,
        title, description, error_message, stack_trace,
        module_name, feature_name, page_url, route,
        api_endpoint, http_method, http_status_code,
        user_id, user_name, user_role, course_id, course_name,
        browser, operating_system, device_type, screen_resolution,
        ip_address, session_id, execution_time_ms,
        metadata, root_cause_hints, user_agent
      ) VALUES (
        ${logId},
        ${groupId},
        ${fingerprint},
        ${environment},
        ${input.severity},
        ${input.category},
        ${title},
        ${description},
        ${input.errorMessage ?? null},
        ${input.stackTrace ?? null},
        ${input.moduleName ?? null},
        ${input.featureName ?? null},
        ${input.pageUrl ?? null},
        ${input.route ?? null},
        ${input.apiEndpoint ?? null},
        ${input.httpMethod ?? null},
        ${input.httpStatusCode ?? null},
        ${input.userId ?? null},
        ${input.userName ?? null},
        ${input.userRole ?? null},
        ${input.courseId ?? null},
        ${input.courseName ?? null},
        ${input.browser ?? null},
        ${input.operatingSystem ?? null},
        ${input.deviceType ?? null},
        ${input.screenResolution ?? null},
        ${input.ipAddress ?? null},
        ${input.sessionId ?? null},
        ${input.executionTimeMs ?? null},
        ${metadata}::jsonb,
        ${hintsJson}::jsonb,
        ${input.userAgent ?? null}
      )
      ON CONFLICT (log_id) DO NOTHING
    `

    return logId
  } catch (e) {
    console.warn("[system-log] insert failed", e)
    return null
  }
}

export function getRequestLogContext(request: NextRequest | Request) {
  const headers = request.headers
  const forwarded = headers.get("x-forwarded-for")
  const ipAddress = forwarded?.split(",")[0]?.trim() || headers.get("x-real-ip") || null
  const userAgent = headers.get("user-agent")
  const path = new URL(request.url).pathname
  return { ipAddress, userAgent, path, method: request.method }
}

export async function logSystemEventFromRequest(
  request: NextRequest | Request,
  input: Omit<SystemLogInput, "ipAddress" | "userAgent" | "apiEndpoint" | "httpMethod"> &
    Partial<Pick<SystemLogInput, "apiEndpoint" | "httpMethod">>,
) {
  const ctx = getRequestLogContext(request)
  await logSystemEvent({
    ...input,
    apiEndpoint: input.apiEndpoint ?? ctx.path,
    httpMethod: input.httpMethod ?? ctx.method,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  })
}

export function errorToMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  try {
    return JSON.stringify(error)
  } catch {
    return "Unknown error"
  }
}

export function errorToStack(error: unknown): string | null {
  if (error instanceof Error && error.stack) return error.stack
  return null
}

function shouldSuppressDatabaseErrorLog(
  error: unknown,
  context?: { metadata?: Record<string, unknown> },
): boolean {
  const msg = errorToMessage(error)
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : undefined
  const preview = String(context?.metadata?.queryPreview ?? "")

  // Schema drift handled by route-level fallbacks — avoid opening issue groups
  if (code === "42703" && msg.includes("deleted_at")) return true
  if (code === "42703" && msg.includes("created_at") && preview.includes("practice_attempts")) {
    return true
  }
  if (code === "42703" && msg.includes("lecture_workspace")) return true
  if (
    code === "42703" &&
    msg.includes("completed") &&
    preview.includes("playground_results")
  ) {
    return true
  }
  if (code === "22003" && preview.includes("playground_results") && preview.includes("completed_at")) {
    return true
  }
  if (code === "23505" && msg.includes("system_log_groups_fingerprint_key")) return true
  if (code === "42P01" && preview.includes("attempt_creation_audit")) return true
  if (preview.includes("update_student_learning_profile") && msg.includes("completed")) {
    return true
  }
  if (
    preview.includes("generate_quiz_report") &&
    (code === "57014" || msg.toLowerCase().includes("timeout"))
  ) {
    return true
  }
  if (
    preview.includes("save_learning_report") &&
    (code === "57014" || msg.toLowerCase().includes("timeout"))
  ) {
    return true
  }
  if (code === "42P01" && preview.includes("student_answer_backup")) return true
  if (code === "42883" && msg.includes("digest")) return true
  if (code === "42703" && preview.includes("quiz_attempts") && msg.includes("is_finalized")) return true
  if (code === "42703" && preview.includes("quizzes") && msg.includes("anti_cheat_config")) return true
  if (code === "42P01" && preview.includes("classroom_submissions")) return true
  if (code === "42703" && preview.includes("classroom_point_submissions") && msg.includes("active")) return true
  if (
    code === "23503" &&
    msg.includes("student_learning_profile_student_id_fkey") &&
    preview.includes("playground_results")
  ) {
    return true
  }
  if (code === "42P01" && preview.includes("practice_hub_attempts")) return true
  if (code === "42703" && preview.includes("quizzes") && msg.includes("is_active")) return true
  if (code === "42703" && preview.includes("quiz_questions") && msg.includes("updated_at")) return true
  if (code === "42702" && preview.includes("attendance_streaks") && msg.includes("ambiguous")) return true
  if (code === "42P01" && preview.includes("platform_activity_log")) return true
  if (code === "42703" && preview.includes("password_reset_requests") && msg.includes("full_name")) {
    return true
  }
  if (code === "42703" && preview.includes("circuit_spec")) return true
  if (code === "42703" && preview.includes("pdf_blob_url")) return true
  if (code === "42703" && preview.includes("week_number") && preview.includes("lectures")) {
    return true
  }
  if (code === "42703" && preview.includes("activity_type") && preview.includes("student_activity_points")) {
    return true
  }
  if (msg.includes("fetch failed") && preview.includes("system_log_groups")) return true
  if (
    msg.toLowerCase().includes("timeout") &&
    (preview.includes("system_log_groups") || preview.includes("system_logs"))
  ) {
    return true
  }

  return false
}

export async function logDatabaseError(
  error: unknown,
  context?: {
    operation?: string
    table?: string
    moduleName?: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  if (shouldSuppressDatabaseErrorLog(error, context)) return

  const msg = errorToMessage(error)
  const stack = errorToStack(error)
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : undefined

  await logSystemEvent({
    severity: msg.toLowerCase().includes("timeout") ? "critical" : "error",
    category: "database",
    title: context?.operation ? `Database error: ${context.operation}` : "Database error",
    errorMessage: msg,
    stackTrace: stack,
    moduleName: context?.moduleName ?? "Platform Module",
    featureName: context?.table ?? undefined,
    metadata: {
      operation: context?.operation,
      table: context?.table,
      errorCode: code,
      ...(context?.metadata ?? {}),
    },
    rootCauseHints: code ? [`PostgreSQL error code: ${code}`] : undefined,
  })
}

export async function logApiError(
  request: NextRequest | Request,
  error: unknown,
  context: {
    statusCode: number
    moduleName?: string
    userId?: string | null
    userRole?: string | null
    requestSummary?: Record<string, unknown>
    responseSummary?: Record<string, unknown>
    executionTimeMs?: number
  },
): Promise<void> {
  const ctx = getRequestLogContext(request)
  const severity: LogSeverity =
    context.statusCode >= 500 ? "critical" : context.statusCode >= 400 ? "error" : "warning"

  await logSystemEvent({
    severity,
    category: context.statusCode === 401 || context.statusCode === 403 ? "authorization" : "api",
    title: `API ${context.statusCode}: ${ctx.path}`,
    errorMessage: errorToMessage(error),
    stackTrace: errorToStack(error),
    moduleName: context.moduleName ?? "Platform Module",
    apiEndpoint: ctx.path,
    httpMethod: ctx.method,
    httpStatusCode: context.statusCode,
    userId: context.userId,
    userRole: context.userRole,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    executionTimeMs: context.executionTimeMs,
    metadata: {
      requestSummary: context.requestSummary,
      responseSummary: context.responseSummary,
    },
  })
}

export async function logAuthError(
  request: NextRequest | Request,
  context: {
    action: string
    userId?: string | null
    userRole?: string | null
    pageAttempted?: string
    requiredPermission?: string
    errorMessage?: string
    success?: boolean
  },
): Promise<void> {
  const ctx = getRequestLogContext(request)
  const isAuth = context.action.includes("login") || context.action.includes("session")
  await logSystemEvent({
    severity: context.success === false ? "warning" : "info",
    category: isAuth ? "authentication" : "authorization",
    title: context.action,
    errorMessage: context.errorMessage,
    moduleName: "Administration Module",
    pageUrl: context.pageAttempted,
    route: ctx.path,
    apiEndpoint: ctx.path,
    httpMethod: ctx.method,
    userId: context.userId,
    userRole: context.userRole,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    metadata: {
      requiredPermission: context.requiredPermission,
      success: context.success,
    },
  })
}

export async function logFrontendError(input: SystemLogInput): Promise<string | null> {
  const msg = (input.errorMessage ?? "").toLowerCase()
  const stack = (input.stackTrace ?? "").toLowerCase()
  if (msg.includes("loading chunk") || stack.includes("chunkloaderror")) {
    return null
  }

  return logSystemEvent({
    ...input,
    category: input.category ?? "frontend",
    severity: input.severity ?? "error",
  })
}

export async function logStorageError(
  error: unknown,
  context: {
    fileName?: string
    fileSize?: number
    userId?: string
    moduleName?: string
    action?: string
  },
): Promise<void> {
  await logSystemEvent({
    severity: "error",
    category: "storage",
    title: context.action ? `Storage error: ${context.action}` : "Storage error",
    errorMessage: errorToMessage(error),
    stackTrace: errorToStack(error),
    moduleName: context.moduleName ?? "Platform Module",
    userId: context.userId,
    metadata: {
      fileName: context.fileName,
      fileSize: context.fileSize,
      action: context.action,
    },
  })
}

export async function logEmailError(
  error: unknown,
  context: {
    template?: string
    recipient?: string
    moduleName?: string
  },
): Promise<void> {
  await logSystemEvent({
    severity: "error",
    category: "email",
    title: context.template ? `Email failed: ${context.template}` : "Email delivery failed",
    errorMessage: errorToMessage(error),
    stackTrace: errorToStack(error),
    moduleName: context.moduleName ?? "Messaging Module",
    metadata: {
      template: context.template,
      recipient: context.recipient,
    },
  })
}

export async function logDeploymentError(
  error: unknown,
  context: {
    action: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  await logSystemEvent({
    severity: "critical",
    category: "deployment",
    title: context.action,
    errorMessage: errorToMessage(error),
    stackTrace: errorToStack(error),
    moduleName: "Administration Module",
    metadata: context.metadata,
  })
}

export function mapRowToSystemLog(row: Record<string, unknown>): SystemLogRow {
  return {
    id: Number(row.id),
    log_id: String(row.log_id),
    group_id: row.group_id != null ? Number(row.group_id) : null,
    fingerprint: row.fingerprint != null ? String(row.fingerprint) : null,
    environment: String(row.environment),
    severity: row.severity as LogSeverity,
    category: row.category as LogCategory,
    title: row.title != null ? String(row.title) : null,
    description: row.description != null ? String(row.description) : null,
    error_message: row.error_message != null ? String(row.error_message) : null,
    stack_trace: row.stack_trace != null ? String(row.stack_trace) : null,
    module_name: row.module_name != null ? String(row.module_name) : null,
    feature_name: row.feature_name != null ? String(row.feature_name) : null,
    page_url: row.page_url != null ? String(row.page_url) : null,
    route: row.route != null ? String(row.route) : null,
    api_endpoint: row.api_endpoint != null ? String(row.api_endpoint) : null,
    http_method: row.http_method != null ? String(row.http_method) : null,
    http_status_code: row.http_status_code != null ? Number(row.http_status_code) : null,
    user_id: row.user_id != null ? String(row.user_id) : null,
    user_name: row.user_name != null ? String(row.user_name) : null,
    user_role: row.user_role != null ? String(row.user_role) : null,
    course_id: row.course_id != null ? Number(row.course_id) : null,
    course_name: row.course_name != null ? String(row.course_name) : null,
    browser: row.browser != null ? String(row.browser) : null,
    operating_system: row.operating_system != null ? String(row.operating_system) : null,
    device_type: row.device_type != null ? String(row.device_type) : null,
    screen_resolution: row.screen_resolution != null ? String(row.screen_resolution) : null,
    ip_address: row.ip_address != null ? String(row.ip_address) : null,
    session_id: row.session_id != null ? String(row.session_id) : null,
    execution_time_ms: row.execution_time_ms != null ? Number(row.execution_time_ms) : null,
    metadata:
      typeof row.metadata === "object" && row.metadata !== null
        ? (row.metadata as Record<string, unknown>)
        : {},
    root_cause_hints: Array.isArray(row.root_cause_hints)
      ? (row.root_cause_hints as string[])
      : [],
    user_agent: row.user_agent != null ? String(row.user_agent) : null,
    created_at: String(row.created_at),
  }
}
