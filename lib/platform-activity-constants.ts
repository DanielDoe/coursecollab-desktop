import {
  clientPlatformLabel,
  resolveActivityClientPlatform,
  type ClientPlatformId,
} from "@/lib/client-platform"
import { CAREER_MEMBER_LABEL } from "@/lib/guest/display"

export type { ClientPlatformId }
export { clientPlatformLabel, resolveActivityClientPlatform }

export type PlatformPortal = "admin" | "faculty" | "student" | "summer_camper" | "guest" | "system"
export type ActivityCategory = "auth" | "navigation" | "assessment" | "profile" | "admin" | "general"

export type PlatformActivityRow = {
  id: number
  portal: string
  actor_type: string
  actor_id: number | null
  actor_label: string | null
  actor_email: string | null
  /** Roster student ID (e.g. E123456), resolved from students table when available */
  actor_student_id?: string | null
  action: string
  category: string
  entity_type: string | null
  entity_id: string | null
  course_id: number | null
  path: string | null
  method: string | null
  success: boolean
  summary: string | null
  metadata: Record<string, unknown>
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

function metadataStudentId(row: PlatformActivityRow): string | null {
  const raw = row.metadata?.studentId
  if (raw == null || raw === "") return null
  return String(raw)
}

function isStudentActor(row: PlatformActivityRow): boolean {
  return (
    row.actor_type === "student" ||
    row.portal === "student" ||
    row.portal === "summer_camper"
  )
}

/** Primary display name for audit log user column */
export function formatActivityActorPrimary(row: PlatformActivityRow): string {
  const rosterId = row.actor_student_id ?? metadataStudentId(row)
  let label = row.actor_label?.trim() ?? ""
  // Legacy rows sometimes stored roster ID in actor_label
  if (label && rosterId && label === rosterId) label = ""
  if (label) return label
  const metaName = row.metadata?.fullName
  if (typeof metaName === "string" && metaName.trim()) return metaName.trim()
  if (row.actor_email?.trim()) return row.actor_email.trim()
  if (rosterId) return rosterId
  if (row.actor_id != null) return `#${row.actor_id}`
  return "—"
}

/** Secondary line — roster student ID when name is shown, otherwise portal label */
export function formatActivityActorSecondary(
  row: PlatformActivityRow,
): string {
  const studentId = row.actor_student_id ?? metadataStudentId(row)
  const primary = formatActivityActorPrimary(row)
  if (isStudentActor(row) && studentId && primary !== studentId) {
    return studentId
  }
  return portalLabel(row.portal)
}

/** Primary event description for audit log table */
export function formatActivitySummaryPrimary(row: PlatformActivityRow): string {
  if (row.summary?.trim()) return row.summary.trim()
  const action = row.action.replace(/_/g, " ")
  return `${categoryLabel(row.category)} · ${action}`
}

/** Secondary context — route path when available */
export function formatActivitySummarySecondary(row: PlatformActivityRow): string | null {
  const path = row.path?.trim()
  if (path) return path
  return portalLabel(row.portal)
}

export const ACTIVITY_ACTIONS = {
  LOGIN_SUCCESS: "login_success",
  LOGIN_FAILED: "login_failed",
  LOGOUT: "logout",
  PASSWORD_CHANGED: "password_changed",
  PAGE_VIEW: "page_view",
  QUIZ_STARTED: "quiz_started",
  MODULE_ACCESSED: "module_accessed",
} as const

export function portalLabel(portal: string): string {
  switch (portal) {
    case "admin":
      return "Admin"
    case "faculty":
      return "Faculty"
    case "student":
      return "Student"
    case "summer_camper":
      return "Summer Camp"
    case "guest":
      return CAREER_MEMBER_LABEL
    default:
      return portal
  }
}

export function categoryLabel(category: string): string {
  switch (category) {
    case "auth":
      return "Authentication"
    case "navigation":
      return "Navigation"
    case "assessment":
      return "Assessment"
    case "profile":
      return "Profile"
    case "admin":
      return "Administration"
    default:
      return "General"
  }
}
