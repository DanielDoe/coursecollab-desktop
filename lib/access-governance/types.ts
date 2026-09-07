/** Central account types — server resolves these; never trust client role fields. */
export const ACCESS_ACCOUNT_TYPES = [
  "student",
  "faculty",
  "career_member",
  "summer_student",
  "admin",
] as const

export type AccessAccountType = (typeof ACCESS_ACCOUNT_TYPES)[number]

export const ACCESS_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "expired",
] as const

export type AccessRequestStatus = (typeof ACCESS_REQUEST_STATUSES)[number]

export const ACCOUNT_LIFECYCLE_STATUSES = [
  "pending_email_verification",
  "pending_approval",
  "active",
  "suspended",
  "rejected",
  "expired",
  "deactivated",
] as const

export type AccountLifecycleStatus = (typeof ACCOUNT_LIFECYCLE_STATUSES)[number]

export const ACCESS_SCOPE_TYPES = [
  "platform",
  "institution",
  "course",
  "section",
  "program",
  "sponsorship",
] as const

export type AccessScopeType = (typeof ACCESS_SCOPE_TYPES)[number]

export const APPROVAL_SOURCES = [
  "admin",
  "faculty",
  "invitation",
  "import",
  "system_policy",
] as const

export type ApprovalSource = (typeof APPROVAL_SOURCES)[number]

export const INVITATION_APPROVAL_BEHAVIORS = [
  "auto_approve_verified_invite",
  "require_faculty_approval",
] as const

export type InvitationApprovalBehavior = (typeof INVITATION_APPROVAL_BEHAVIORS)[number]

/** Legacy `account_requests.request_kind` values still stored in DB. */
export const LEGACY_REQUEST_KINDS = [
  "roster",
  "guest",
  "faculty",
  "summer_camper",
  "summer_student",
  "camp_password_reset",
] as const

export type LegacyRequestKind = (typeof LEGACY_REQUEST_KINDS)[number]

export type AccessRequestRow = {
  id: number
  full_name: string
  student_id: string
  section: string | null
  email: string | null
  status: AccessRequestStatus
  request_kind: string
  account_type: AccessAccountType | null
  guest_purpose: string | null
  guest_purpose_detail: string | null
  organization: string | null
  faculty_job_title: string | null
  faculty_password: string | null
  guest_password_hash: string | null
  school_affiliation: string | null
  school_affiliation: string | null
  university_id: number | null
  course_id: number | null
  session_id: number | null
  camp_id: number | null
  sponsoring_faculty_id: number | null
  invitation_id: number | null
  approval_source: ApprovalSource | null
  reviewer_role: string | null
  email_verified_at: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  approved_by: string | number | null
  approved_at: string | null
  rejected_at: string | null
  rejection_reason: string | null
}

export type ReviewerContext =
  | { role: "admin"; adminId: number | string; isActive?: boolean }
  | {
      role: "faculty"
      instructorId: number
      courseId: number
      isActive: boolean
    }

export type GovernanceDecision =
  | { ok: true }
  | { ok: false; code: string; reason: string }
