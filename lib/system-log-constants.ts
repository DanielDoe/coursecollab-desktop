export const LOG_SEVERITIES = ["info", "warning", "error", "critical"] as const
export type LogSeverity = (typeof LOG_SEVERITIES)[number]

export const LOG_CATEGORIES = [
  "frontend",
  "backend",
  "api",
  "database",
  "authentication",
  "authorization",
  "storage",
  "email",
  "deployment",
  "security",
  "performance",
  "assessment",
] as const
export type LogCategory = (typeof LOG_CATEGORIES)[number]

/**
 * Issue group lifecycle:
 * - needs_attention: student/instructor assessment panel items awaiting admin review
 * - open: confirmed bugs/tasks for Claude or devs to fix
 * - resolved: fixed or dismissed
 */
export const GROUP_STATUSES = ["needs_attention", "open", "resolved"] as const
export type GroupStatus = (typeof GROUP_STATUSES)[number]

/** Legacy DB values mapped to open for reads */
export const LEGACY_OPEN_STATUSES = ["open", "active", "ignored"] as const

export function groupStatusLabel(status: string): string {
  if (status === "resolved") return "Resolved"
  if (status === "needs_attention") return "Needs attention"
  if (LEGACY_OPEN_STATUSES.includes(status as (typeof LEGACY_OPEN_STATUSES)[number])) return "Open"
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function normalizeGroupStatus(status: string): GroupStatus {
  if (status === "resolved") return "resolved"
  if (status === "needs_attention") return "needs_attention"
  return "open"
}

export function groupStatusBadgeVariant(
  status: string,
): "destructive" | "secondary" | "default" | "outline" {
  if (status === "needs_attention") return "destructive"
  if (status === "resolved") return "secondary"
  return "default"
}

/** CourseCollab feature modules for error attribution */
export const COURSE_COLLAB_MODULES = [
  "Attendance Module",
  "Assignments Module",
  "Homework Module",
  "Quiz Module",
  "Exam Module",
  "Gradebook Module",
  "Analytics Module",
  "Course Management Module",
  "Discussion Module",
  "Messaging Module",
  "AI Assistant Module",
  "Summer Camp Module",
  "Administration Module",
  "Lectures Module",
  "Practice Module",
  "Trade Center Module",
  "Platform Module",
] as const
export type CourseCollabModule = (typeof COURSE_COLLAB_MODULES)[number]

export type SystemLogRow = {
  id: number
  log_id: string
  group_id: number | null
  fingerprint: string | null
  environment: string
  severity: LogSeverity
  category: LogCategory
  title: string | null
  description: string | null
  error_message: string | null
  stack_trace: string | null
  module_name: string | null
  feature_name: string | null
  page_url: string | null
  route: string | null
  api_endpoint: string | null
  http_method: string | null
  http_status_code: number | null
  user_id: string | null
  user_name: string | null
  user_role: string | null
  course_id: number | null
  course_name: string | null
  browser: string | null
  operating_system: string | null
  device_type: string | null
  screen_resolution: string | null
  ip_address: string | null
  session_id: string | null
  execution_time_ms: number | null
  metadata: Record<string, unknown>
  root_cause_hints: string[]
  user_agent: string | null
  created_at: string
}

export type SystemLogGroupRow = {
  id: number
  fingerprint: string
  title: string
  severity: LogSeverity
  category: LogCategory
  module_name: string | null
  /** Environment of the most recent event in this group (development vs production). */
  latest_environment: string | null
  occurrence_count: number
  affected_user_count: number
  first_seen_at: string
  last_seen_at: string
  status: GroupStatus
  assigned_to: string | null
  resolution_notes: string | null
  resolved_at: string | null
  resolved_by: string | null
}

/** Collapse DB env values into Dev (localhost/development) vs Prod for the issues table. */
export function environmentSourceLabel(environment: string | null | undefined): "Dev" | "Prod" | "—" {
  if (!environment?.trim()) return "—"
  const e = environment.trim().toLowerCase()
  if (e === "production" || e === "prod") return "Prod"
  return "Dev"
}

export function isDevLogEnvironment(environment: string | null | undefined): boolean {
  return environmentSourceLabel(environment) === "Dev"
}

export function isProdLogEnvironment(environment: string | null | undefined): boolean {
  return environmentSourceLabel(environment) === "Prod"
}

/** Dev-only groups with no new events for this long are auto-marked resolved. */
export const DEV_QUIET_RESOLVE_MINUTES = 30

export function environmentSourceBadgeVariant(
  environment: string | null | undefined,
): "default" | "secondary" | "outline" {
  return environmentSourceLabel(environment) === "Prod" ? "outline" : "secondary"
}

export function severityLabel(severity: string): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1)
}

export function categoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1)
}

export function severityTone(severity: string): "default" | "warning" | "danger" | "critical" {
  if (severity === "critical") return "critical"
  if (severity === "error") return "danger"
  if (severity === "warning") return "warning"
  return "default"
}
