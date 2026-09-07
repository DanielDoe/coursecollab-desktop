import {
  ADMIN_ONLY_ACCOUNT_TYPES,
  FACULTY_APPROVABLE_ACCOUNT_TYPES,
  accountTypeFromRequestKind,
  isCampPasswordResetRequestKind,
} from "@/lib/access-governance/kinds"
import type {
  AccessRequestRow,
  GovernanceDecision,
  ReviewerContext,
} from "@/lib/access-governance/types"

export function resolveAccountTypeForRequest(row: AccessRequestRow) {
  return accountTypeFromRequestKind(row.request_kind) ?? row.account_type
}

/** Who may approve this pending request? Calculated from DB state only. */
export function canReviewerApproveRequest(
  reviewer: ReviewerContext,
  request: AccessRequestRow,
): GovernanceDecision {
  if (request.status !== "pending") {
    return { ok: false, code: "not_pending", reason: "Request is not pending." }
  }

  const accountType = resolveAccountTypeForRequest(request)
  if (!accountType) {
    return { ok: false, code: "unsupported_kind", reason: "Unsupported request type." }
  }

  if (reviewer.role === "admin") {
    return { ok: true }
  }

  if (reviewer.role !== "faculty") {
    return { ok: false, code: "forbidden", reason: "Not authorized to approve." }
  }

  if (!reviewer.isActive) {
    return { ok: false, code: "inactive_reviewer", reason: "Reviewer account is not active." }
  }

  if ((ADMIN_ONLY_ACCOUNT_TYPES as readonly string[]).includes(accountType)) {
    return { ok: false, code: "admin_only", reason: "Faculty cannot approve this account type." }
  }

  if (!(FACULTY_APPROVABLE_ACCOUNT_TYPES as readonly string[]).includes(accountType)) {
    return { ok: false, code: "forbidden", reason: "Faculty cannot approve this account type." }
  }

  if (accountType === "student") {
    if (request.course_id != null && request.course_id !== reviewer.courseId) {
      return { ok: false, code: "course_scope", reason: "Request is outside your course." }
    }
    return { ok: true }
  }

  if (accountType === "career_member") {
    if (request.sponsoring_faculty_id == null) {
      return {
        ok: false,
        code: "admin_only_career",
        reason: "Platform Career Member requests require admin approval.",
      }
    }
    if (request.sponsoring_faculty_id !== reviewer.instructorId) {
      return { ok: false, code: "sponsor_scope", reason: "You are not the sponsoring faculty." }
    }
    return { ok: true }
  }

  if (accountType === "summer_student") {
    if (request.camp_id == null) {
      return { ok: false, code: "missing_program", reason: "Summer program scope is required." }
    }
    return { ok: true }
  }

  return { ok: false, code: "forbidden", reason: "Not authorized." }
}

/** Requests with an email address must verify before approval (except camp password reset). */
export function requiresEmailVerificationBeforeApproval(request: AccessRequestRow): boolean {
  if (isCampPasswordResetRequestKind(request.request_kind)) return false
  const email = request.email?.trim()
  return Boolean(email && email.includes("@"))
}

export function canApproveAfterEmailVerification(request: AccessRequestRow): GovernanceDecision {
  if (!requiresEmailVerificationBeforeApproval(request)) {
    return { ok: true }
  }
  if (request.email_verified_at) {
    return { ok: true }
  }
  return {
    ok: false,
    code: "email_unverified",
    reason: "The applicant must verify their email before this request can be approved.",
  }
}

/** Server-side account type resolution — ignores client-submitted role/userType. */
export function resolveServerAccountType(input: {
  registrationPath: "student_roster" | "faculty_signup" | "career_member" | "summer_camp" | "invitation"
  invitationAllowedType?: AccessAccountType | null
}): AccessAccountType {
  switch (input.registrationPath) {
    case "faculty_signup":
      return "faculty"
    case "career_member":
      return "career_member"
    case "summer_camp":
      return "summer_student"
    case "student_roster":
      return "student"
    case "invitation":
      return input.invitationAllowedType ?? "student"
  }
}
