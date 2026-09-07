import type { AccessAccountType, LegacyRequestKind } from "@/lib/access-governance/types"

/** Map stored request_kind → canonical account type (server-side only). */
export function accountTypeFromRequestKind(kind: string): AccessAccountType | null {
  switch (kind) {
    case "roster":
      return "student"
    case "faculty":
      return "faculty"
    case "guest":
      return "career_member"
    case "summer_camper":
    case "summer_student":
      return "summer_student"
    default:
      return null
  }
}

/** Canonical account type → legacy request_kind for DB storage. */
export function requestKindFromAccountType(type: AccessAccountType): LegacyRequestKind {
  switch (type) {
    case "student":
      return "roster"
    case "faculty":
      return "faculty"
    case "career_member":
      return "guest"
    case "summer_student":
      return "summer_student"
    case "admin":
      return "faculty"
  }
}

/** Kinds handled by Access Governance (excludes password-reset rows). */
export function isAccessGovernanceRequestKind(kind: string): boolean {
  return accountTypeFromRequestKind(kind) != null
}

export function isCampPasswordResetRequestKind(kind: string): boolean {
  return kind === "camp_password_reset"
}

export function isAnyGovernanceManagedRequestKind(kind: string): boolean {
  return isAccessGovernanceRequestKind(kind) || isCampPasswordResetRequestKind(kind)
}

/** Faculty may approve these account types when scope matches. */
export const FACULTY_APPROVABLE_ACCOUNT_TYPES: readonly AccessAccountType[] = [
  "student",
  "career_member",
  "summer_student",
]

/** Only admins may approve faculty signup. */
export const ADMIN_ONLY_ACCOUNT_TYPES: readonly AccessAccountType[] = ["faculty", "admin"]
