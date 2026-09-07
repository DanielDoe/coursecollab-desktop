import {
  environmentSourceLabel,
  type SystemLogGroupRow,
  type SystemLogRow,
} from "@/lib/system-log-constants"

export type SystemLogDescriptionInput = {
  severity?: string
  category?: string
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
  metadata?: Record<string, unknown>
}

/** Human-readable steps for admins and AI — auto-filled when description is omitted. */
export function buildSystemLogDescription(input: SystemLogDescriptionInput): string {
  if (input.description?.trim()) return input.description.trim()

  const parts: string[] = []

  if (input.errorMessage?.trim()) {
    parts.push(input.errorMessage.trim())
  }

  const where: string[] = []
  if (input.pageUrl) where.push(`Page: ${input.pageUrl}`)
  else if (input.route) where.push(`Route: ${input.route}`)
  if (input.apiEndpoint) {
    const req = [input.httpMethod, input.apiEndpoint, input.httpStatusCode != null ? `→ ${input.httpStatusCode}` : null]
      .filter(Boolean)
      .join(" ")
    where.push(`API: ${req}`)
  }
  if (input.featureName) where.push(`Feature: ${input.featureName}`)
  if (where.length) parts.push(where.join(" · "))

  const who: string[] = []
  if (input.userName || input.userId) {
    who.push(`User: ${input.userName ?? input.userId}${input.userRole ? ` (${input.userRole})` : ""}`)
  }
  if (input.courseId != null || input.courseName) {
    who.push(`Course: ${input.courseName ?? `#${input.courseId}`}`)
  }
  if (who.length) parts.push(who.join(" · "))

  const stackLine = input.stackTrace?.split("\n").map((l) => l.trim()).find(Boolean)
  if (stackLine) parts.push(`Stack: ${stackLine.slice(0, 280)}`)

  const meta = input.metadata ?? {}
  const metaBits: string[] = []
  if (meta.quizId != null) metaBits.push(`quizId=${meta.quizId}`)
  if (meta.attemptId != null) metaBits.push(`attemptId=${meta.attemptId}`)
  if (meta.assessmentId != null) metaBits.push(`assessmentId=${meta.assessmentId}`)
  if (meta.digest) metaBits.push(`digest=${meta.digest}`)
  if (metaBits.length) parts.push(`IDs: ${metaBits.join(", ")}`)

  return parts.join("\n") || input.title?.trim() || `${input.category} ${input.severity}`
}

export function formatLogDiagnosticBlock(log: SystemLogRow): string {
  return [
    `**Error:** ${log.error_message ?? log.title ?? "—"}`,
    log.description ? `**Summary:** ${log.description}` : null,
    log.page_url || log.route
      ? `**Where:** ${[log.page_url, log.route !== log.page_url ? log.route : null].filter(Boolean).join(" · ")}`
      : null,
    log.api_endpoint
      ? `**API:** ${[log.http_method, log.api_endpoint, log.http_status_code != null ? `HTTP ${log.http_status_code}` : null].filter(Boolean).join(" ")}`
      : null,
    log.user_name || log.user_id
      ? `**Who:** ${log.user_name ?? log.user_id}${log.user_role ? ` (${log.user_role})` : ""}${log.course_id != null ? ` · course #${log.course_id}` : ""}`
      : null,
    log.log_id ? `**Log ID:** ${log.log_id} (row #${log.id})` : null,
    log.stack_trace
      ? `**Stack (first lines):\n\`\`\`\n${log.stack_trace.split("\n").slice(0, 8).join("\n")}\n\`\`\``
      : null,
    log.root_cause_hints?.length
      ? `**Hints:** ${log.root_cause_hints.map((h) => `- ${h}`).join("\n")}`
      : null,
    Object.keys(log.metadata ?? {}).length
      ? `**Metadata:**\n\`\`\`json\n${JSON.stringify(log.metadata, null, 2)}\n\`\`\``
      : null,
  ]
    .filter(Boolean)
    .join("\n")
}

export function formatGroupForClaude(
  group: SystemLogGroupRow,
  sampleLog?: SystemLogRow | null,
): string {
  return [
    `## [groupId=${group.id}] ${group.title}`,
    `- Status: ${group.status}`,
    `- Severity: ${group.severity} · Category: ${group.category}`,
    `- Module: ${group.module_name ?? "Unknown"}`,
    `- Environment: ${environmentSourceLabel(sampleLog?.environment ?? group.latest_environment)}${
      sampleLog?.environment ?? group.latest_environment
        ? ` (${sampleLog?.environment ?? group.latest_environment})`
        : ""
    }`,
    `- Occurrences: ${group.occurrence_count} · Affected users: ${group.affected_user_count}`,
    `- Fingerprint: ${group.fingerprint}`,
    `- First seen: ${group.first_seen_at}`,
    `- Last seen: ${group.last_seen_at}`,
    group.assigned_to ? `- Assigned to: ${group.assigned_to}` : null,
    group.resolution_notes ? `- Notes: ${group.resolution_notes}` : null,
    sampleLog ? `\n### Latest event (log #${sampleLog.id})\n${formatLogDiagnosticBlock(sampleLog)}` : "\n### Latest event\n_No sample log attached — check Events tab._",
  ]
    .filter(Boolean)
    .join("\n")
}
