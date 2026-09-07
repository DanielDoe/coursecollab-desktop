import { sql } from "@/lib/db"
import { ensureAccessGovernanceSchema } from "@/lib/access-governance/schema"
import { requestKindFromAccountType, accountTypeFromRequestKind, isAccessGovernanceRequestKind, isCampPasswordResetRequestKind } from "@/lib/access-governance/kinds"
import {
  canApproveAfterEmailVerification,
  canReviewerApproveRequest,
  resolveAccountTypeForRequest,
  resolveServerAccountType,
} from "@/lib/access-governance/policies"
import {
  facultyManagesCamp,
  facultyScopeMatchesStudentRequest,
  resolveStudentScopeFromSection,
} from "@/lib/access-governance/scope"
import { activateAccessRequest } from "@/lib/access-governance/activation"
import { auditAccessGovernanceEvent } from "@/lib/access-governance/audit"
import { consumeAccessInvitation, validateAccessInvitation } from "@/lib/access-governance/invitations"
import {
  notifyAccessRequestApproved,
  notifyAccessRequestRejected,
} from "@/lib/access-governance/notifications"
import { sendAccessRequestVerificationEmail } from "@/lib/access-governance/email-verification"
import {
  approveSummerCamperPasswordResetRequest,
} from "@/lib/summer-camp/camper-accounts"
import type {
  AccessAccountType,
  AccessRequestRow,
  ApprovalSource,
  ReviewerContext,
} from "@/lib/access-governance/types"

export { resolveServerAccountType }

export type CreateAccessRequestInput = {
  registrationPath: "student_roster" | "faculty_signup" | "career_member" | "summer_camp" | "invitation"
  fullName: string
  loginId: string
  email: string
  section?: string | null
  universityId?: number | null
  organization?: string | null
  guestPurpose?: string | null
  guestPurposeDetail?: string | null
  facultyJobTitle?: string | null
  facultyPassword?: string | null
  passwordHash?: string | null
  schoolAffiliation?: string | null
  sponsoringFacultyId?: number | null
  invitationToken?: string | null
  campId?: number | null
  /** Faculty/import paths may mark email verified at creation time. */
  markEmailVerified?: boolean
  metadata?: Record<string, unknown>
}

export async function getAccessRequestById(id: number): Promise<AccessRequestRow | null> {
  await ensureAccessGovernanceSchema()
  const [row] = (await sql`SELECT * FROM account_requests WHERE id = ${id} LIMIT 1`) as AccessRequestRow[]
  return row ?? null
}

export async function verifyReviewerScopeAsync(
  reviewer: ReviewerContext,
  request: AccessRequestRow,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const accountType = resolveAccountTypeForRequest(request)
  if (!accountType && !isCampPasswordResetRequestKind(request.request_kind)) {
    return { ok: false, reason: "Unsupported request." }
  }

  if (reviewer.role === "admin") return { ok: true }

  if (isCampPasswordResetRequestKind(request.request_kind)) {
    return { ok: true }
  }

  if (accountType === "student") {
    const inCourse = await facultyScopeMatchesStudentRequest(reviewer.courseId, request)
    if (!inCourse) return { ok: false, reason: "Request is outside your authorized course/section." }
    return { ok: true }
  }

  if (accountType === "career_member") {
    if (request.sponsoring_faculty_id !== reviewer.instructorId) {
      return { ok: false, reason: "You are not the sponsoring faculty for this Career Member." }
    }
    return { ok: true }
  }

  if (accountType === "summer_student") {
    if (request.camp_id != null) {
      const manages = await facultyManagesCamp(reviewer.instructorId, request.camp_id)
      if (!manages) return { ok: false, reason: "Request is outside your authorized summer program." }
    }
    return { ok: true }
  }

  return { ok: false, reason: "Not authorized for this request scope." }
}

export async function createAccessRequest(
  input: CreateAccessRequestInput,
): Promise<{ requestId: number; autoApproved: boolean; userId?: number }> {
  await ensureAccessGovernanceSchema()

  let invitationId: number | null = null
  let approvalBehavior: string | null = null
  let allowedAccountTypeFromInvite: AccessAccountType | null = null
  let scopeFromInvite: {
    courseId: number | null
    sessionId: number | null
    campId: number | null
    universityId: number | null
    sponsoringFacultyId: number | null
  } | null = null

  if (input.invitationToken) {
    const validated = await validateAccessInvitation(input.invitationToken)
    if (!validated.ok) throw new Error(validated.reason)
    invitationId = validated.invitation.id
    approvalBehavior = validated.invitation.approvalBehavior
    allowedAccountTypeFromInvite = validated.invitation.allowedAccountType
    scopeFromInvite = {
      courseId: validated.invitation.courseId,
      sessionId: validated.invitation.sessionId,
      campId: validated.invitation.campId,
      universityId: validated.invitation.universityId,
      sponsoringFacultyId: validated.invitation.createdBy,
    }
  }

  const resolvedAccountType: AccessAccountType =
    allowedAccountTypeFromInvite ??
    resolveServerAccountType({ registrationPath: input.registrationPath })

  const requestKind = requestKindFromAccountType(resolvedAccountType)

  let courseId = scopeFromInvite?.courseId ?? null
  let sessionId = scopeFromInvite?.sessionId ?? null
  let section = input.section ?? null
  let universityId = input.universityId ?? scopeFromInvite?.universityId ?? null

  if (resolvedAccountType === "student" && input.section) {
    const expectedCourseId =
      typeof input.metadata?.selfEnrollmentCourseId === "number"
        ? input.metadata.selfEnrollmentCourseId
        : null
    const scope = await resolveStudentScopeFromSection(input.section, universityId, expectedCourseId)
    if (!scope) throw new Error("Invalid section — could not resolve course enrollment scope.")
    courseId = scope.courseId
    sessionId = scope.sessionId
    section = scope.sectionCode
    universityId = scope.universityId
  }

  const sponsoringFacultyId =
    input.sponsoringFacultyId ?? scopeFromInvite?.sponsoringFacultyId ?? null

  const defaultSection =
    resolvedAccountType === "faculty"
      ? "FACULTY"
      : resolvedAccountType === "summer_student"
        ? "SUMMER_CAMP"
        : resolvedAccountType === "career_member"
          ? "GUEST"
          : section

  const [row] = (await sql`
    INSERT INTO account_requests (
      full_name, student_id, section, email, status,
      request_kind, account_type, organization,
      guest_purpose, guest_purpose_detail,
      faculty_job_title, faculty_password, guest_password_hash,
      school_affiliation, university_id, course_id, session_id, camp_id,
      sponsoring_faculty_id, invitation_id, metadata, email_verified_at
    )
    VALUES (
      ${input.fullName.trim()},
      ${input.loginId.trim()},
      ${defaultSection},
      ${input.email.trim().toLowerCase()},
      'pending',
      ${requestKind},
      ${resolvedAccountType},
      ${input.organization ?? input.schoolAffiliation ?? null},
      ${input.guestPurpose ?? null},
      ${input.guestPurposeDetail ?? null},
      ${input.facultyJobTitle ?? null},
      ${input.facultyPassword ?? null},
      ${input.passwordHash ?? null},
      ${input.schoolAffiliation ?? null},
      ${universityId},
      ${courseId},
      ${sessionId},
      ${input.campId ?? scopeFromInvite?.campId ?? null},
      ${sponsoringFacultyId},
      ${invitationId},
      ${JSON.stringify({
        ...(input.metadata ?? {}),
        ...(approvalBehavior === "auto_approve_verified_invite" ? { autoApproveOnVerify: true } : {}),
      })}::jsonb,
      ${input.markEmailVerified ? new Date() : null}
    )
    RETURNING id
  `) as { id: number }[]

  await auditAccessGovernanceEvent({
    action: "access_request.create",
    actorRole: "applicant",
    requestId: row.id,
    accountType: resolvedAccountType,
    outcome: "success",
  })

  if (input.email.includes("@") && !input.markEmailVerified) {
    try {
      await sendAccessRequestVerificationEmail({
        requestId: row.id,
        email: input.email.trim().toLowerCase(),
        fullName: input.fullName.trim(),
        portal:
          resolvedAccountType === "faculty"
            ? "faculty"
            : resolvedAccountType === "career_member"
              ? "guest"
              : "student",
      })
    } catch (e) {
      console.warn("[access-governance] verification email failed:", e)
    }
  }

  if (invitationId) await consumeAccessInvitation(invitationId)

  return { requestId: row.id, autoApproved: false }
}

export async function approveAccessRequest(input: {
  requestId: number
  reviewer: ReviewerContext
  approvalSource?: ApprovalSource
}): Promise<{ userId: number; accountType: AccessAccountType; message: string }> {
  await ensureAccessGovernanceSchema()

  const request = await getAccessRequestById(input.requestId)
  if (!request || request.status !== "pending") {
    throw new Error("Account request not found or already processed")
  }

  if (isCampPasswordResetRequestKind(request.request_kind)) {
    return approveCampPasswordResetRequest(input)
  }

  if (!isAccessGovernanceRequestKind(request.request_kind)) {
    throw new Error("This request type is not handled by Access Governance")
  }

  const policy = canReviewerApproveRequest(input.reviewer, request)
  if (!policy.ok) {
    await auditAccessGovernanceEvent({
      action: "access_request.approve",
      actorRole: input.reviewer.role,
      actorId: input.reviewer.role === "admin" ? input.reviewer.adminId : input.reviewer.instructorId,
      requestId: input.requestId,
      accountType: resolveAccountTypeForRequest(request),
      outcome: "denied",
      metadata: { reason: policy.reason },
    })
    throw new Error(policy.reason)
  }

  const scope = await verifyReviewerScopeAsync(input.reviewer, request)
  if (!scope.ok) {
    await auditAccessGovernanceEvent({
      action: "access_request.approve",
      actorRole: input.reviewer.role,
      actorId: input.reviewer.role === "admin" ? input.reviewer.adminId : input.reviewer.instructorId,
      requestId: input.requestId,
      accountType: resolveAccountTypeForRequest(request),
      outcome: "denied",
      metadata: { reason: scope.reason },
    })
    throw new Error(scope.reason)
  }

  const emailGate = canApproveAfterEmailVerification(request)
  if (!emailGate.ok) {
    await auditAccessGovernanceEvent({
      action: "access_request.approve",
      actorRole: input.reviewer.role,
      actorId: input.reviewer.role === "admin" ? input.reviewer.adminId : input.reviewer.instructorId,
      requestId: input.requestId,
      accountType: resolveAccountTypeForRequest(request),
      outcome: "denied",
      metadata: { reason: emailGate.reason, code: emailGate.code },
    })
    throw new Error(emailGate.reason)
  }

  const approvalSource: ApprovalSource =
    input.approvalSource ??
    (input.reviewer.role === "admin" ? "admin" : "faculty")

  const approvedBy =
    input.reviewer.role === "admin" ? String(input.reviewer.adminId) : String(input.reviewer.instructorId)

  const reviewerRole = input.reviewer.role === "admin" ? "admin" : "faculty"

  const [claimed] = (await sql`
    UPDATE account_requests
    SET
      status = 'approved',
      approved_by = ${approvedBy},
      approved_at = NOW(),
      approval_source = ${approvalSource},
      reviewer_role = ${reviewerRole}
    WHERE id = ${input.requestId} AND status = 'pending'
    RETURNING *
  `) as AccessRequestRow[]

  if (!claimed) {
    throw new Error("Account request not found or already processed")
  }

  let activation: Awaited<ReturnType<typeof activateAccessRequest>>
  try {
    activation = await activateAccessRequest({
      request: claimed,
      requestId: input.requestId,
      approvedBy,
      approvalSource,
    })
  } catch (activationError) {
    await sql`
      UPDATE account_requests
      SET
        status = 'pending',
        approved_by = NULL,
        approved_at = NULL,
        approval_source = NULL,
        reviewer_role = NULL
      WHERE id = ${input.requestId} AND status = 'approved'
    `
    throw activationError
  }

  await sql`
    UPDATE account_requests
    SET faculty_password = NULL, guest_password_hash = NULL
    WHERE id = ${input.requestId}
  `

  await auditAccessGovernanceEvent({
    action: "access_request.approve",
    actorRole: reviewerRole,
    actorId: approvedBy,
    requestId: input.requestId,
    accountType: activation.accountType,
    approvalSource,
    outcome: "success",
  })

  if (claimed.email) {
    await notifyAccessRequestApproved({
      toEmail: claimed.email,
      fullName: claimed.full_name,
      accountType: activation.accountType,
      message: activation.message,
    })
  }

  return {
    userId: activation.userId,
    accountType: activation.accountType,
    message: activation.message,
  }
}

async function approveCampPasswordResetRequest(input: {
  requestId: number
  reviewer: ReviewerContext
  approvalSource?: ApprovalSource
}): Promise<{ userId: number; accountType: AccessAccountType; message: string }> {
  if (input.reviewer.role !== "admin") {
    const request = await getAccessRequestById(input.requestId)
    if (!request) throw new Error("Request not found")
    const scope = await verifyReviewerScopeAsync(input.reviewer, request)
    if (!scope.ok) throw new Error(scope.reason)
  }

  const approvedBy =
    input.reviewer.role === "admin" ? input.reviewer.adminId : input.reviewer.instructorId

  const [claimed] = (await sql`
    UPDATE account_requests
    SET status = 'approved', approved_by = ${String(approvedBy)}, approved_at = NOW(),
        approval_source = ${input.approvalSource ?? (input.reviewer.role === "admin" ? "admin" : "faculty")},
        reviewer_role = ${input.reviewer.role}
    WHERE id = ${input.requestId} AND status = 'pending' AND request_kind = 'camp_password_reset'
    RETURNING id
  `) as { id: number }[]

  if (!claimed) throw new Error("Password reset request not found or already processed")

  try {
    const result = await approveSummerCamperPasswordResetRequest(input.requestId, approvedBy)
    await auditAccessGovernanceEvent({
      action: "access_request.approve",
      actorRole: input.reviewer.role,
      actorId: approvedBy,
      requestId: input.requestId,
      accountType: "summer_student",
      approvalSource: input.approvalSource ?? "faculty",
      outcome: "success",
      metadata: { kind: "camp_password_reset" },
    })
    return {
      userId: result.studentId,
      accountType: "summer_student",
      message: "Summer camp password reset approved.",
    }
  } catch (e) {
    await sql`
      UPDATE account_requests SET status = 'pending', approved_by = NULL, approved_at = NULL
      WHERE id = ${input.requestId} AND status = 'approved'
    `
    throw e
  }
}

export async function rejectAccessRequest(input: {
  requestId: number
  reviewer: ReviewerContext
  reason?: string
}): Promise<void> {
  await ensureAccessGovernanceSchema()

  const request = await getAccessRequestById(input.requestId)
  if (!request || request.status !== "pending") {
    throw new Error("Account request not found or already processed")
  }

  if (input.reviewer.role === "faculty") {
    const scope = await verifyReviewerScopeAsync(input.reviewer, request)
    if (!scope.ok) throw new Error(scope.reason)
  }

  const rejectedBy =
    input.reviewer.role === "admin" ? String(input.reviewer.adminId) : String(input.reviewer.instructorId)

  const [updated] = (await sql`
    UPDATE account_requests
    SET
      status = 'rejected',
      rejected_at = NOW(),
      rejection_reason = ${input.reason || "No reason provided"},
      approved_by = ${rejectedBy},
      reviewer_role = ${input.reviewer.role === "admin" ? "admin" : "faculty"}
    WHERE id = ${input.requestId} AND status = 'pending'
    RETURNING *
  `) as AccessRequestRow[]

  if (!updated) {
    throw new Error("Account request not found or already processed")
  }

  await auditAccessGovernanceEvent({
    action: "access_request.reject",
    actorRole: input.reviewer.role,
    actorId: rejectedBy,
    requestId: input.requestId,
    accountType: resolveAccountTypeForRequest(request),
    outcome: "success",
    metadata: { reason: input.reason },
  })

  if (updated.email && !isCampPasswordResetRequestKind(updated.request_kind)) {
    const accountType = resolveAccountTypeForRequest(updated)
    if (accountType) {
      await notifyAccessRequestRejected({
        toEmail: updated.email,
        fullName: updated.full_name,
        accountType,
        reason: input.reason,
      })
    }
  }
}

export async function findPendingAccessRequestForLogin(input: {
  loginId: string
  email?: string | null
  requestKinds?: string[]
}): Promise<AccessRequestRow | null> {
  await ensureAccessGovernanceSchema()
  const login = input.loginId.trim().toLowerCase()
  const emailNorm = input.email?.trim().toLowerCase() ?? ""

  const rows = emailNorm.includes("@")
    ? ((await sql`
        SELECT * FROM account_requests
        WHERE status = 'pending'
          AND request_kind = ANY(${
            input.requestKinds ?? ["roster", "guest", "faculty", "summer_camper", "summer_student"]
          }::text[])
          AND (
            LOWER(TRIM(student_id::text)) = ${login}
            OR LOWER(TRIM(email)) = ${emailNorm}
          )
        ORDER BY created_at DESC
        LIMIT 1
      `) as AccessRequestRow[])
    : ((await sql`
        SELECT * FROM account_requests
        WHERE status = 'pending'
          AND request_kind = ANY(${
            input.requestKinds ?? ["roster", "guest", "faculty", "summer_camper", "summer_student"]
          }::text[])
          AND LOWER(TRIM(student_id::text)) = ${login}
        ORDER BY created_at DESC
        LIMIT 1
      `) as AccessRequestRow[])

  return rows[0] ?? null
}

export async function findRejectedAccessRequestForLogin(input: {
  loginId: string
  email?: string | null
}): Promise<AccessRequestRow | null> {
  const login = input.loginId.trim().toLowerCase()
  const emailNorm = input.email?.trim().toLowerCase() ?? ""

  const rows = emailNorm.includes("@")
    ? ((await sql`
        SELECT * FROM account_requests
        WHERE status = 'rejected'
          AND (
            LOWER(TRIM(student_id::text)) = ${login}
            OR LOWER(TRIM(email)) = ${emailNorm}
          )
        ORDER BY rejected_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      `) as AccessRequestRow[])
    : ((await sql`
        SELECT * FROM account_requests
        WHERE status = 'rejected'
          AND LOWER(TRIM(student_id::text)) = ${login}
        ORDER BY rejected_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      `) as AccessRequestRow[])

  return rows[0] ?? null
}
