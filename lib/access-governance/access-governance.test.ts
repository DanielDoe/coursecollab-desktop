/**
 * Access Governance policy tests (no DB).
 * Run: npx tsx --test lib/access-governance/access-governance.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  canApproveAfterEmailVerification,
  canReviewerApproveRequest,
  requiresEmailVerificationBeforeApproval,
  resolveAccountTypeForRequest,
  resolveServerAccountType,
} from "@/lib/access-governance/policies"
import { accountTypeFromRequestKind } from "@/lib/access-governance/kinds"
import { hashInvitationToken } from "@/lib/access-governance/invitations"
import type { AccessRequestRow } from "@/lib/access-governance/types"

function baseRequest(overrides: Partial<AccessRequestRow>): AccessRequestRow {
  return {
    id: 1,
    full_name: "Test User",
    student_id: "P12345678",
    section: "ELEG1304P01",
    email: "test@example.com",
    status: "pending",
    request_kind: "roster",
    account_type: null,
    guest_purpose: null,
    guest_purpose_detail: null,
    organization: null,
    faculty_job_title: null,
    faculty_password: null,
    guest_password_hash: null,
    school_affiliation: null,
    university_id: 1,
    course_id: 10,
    session_id: 100,
    camp_id: null,
    sponsoring_faculty_id: null,
    invitation_id: null,
    approval_source: null,
    reviewer_role: null,
    email_verified_at: null,
    metadata: null,
    created_at: new Date().toISOString(),
    approved_by: null,
    approved_at: null,
    rejected_at: null,
    rejection_reason: null,
    ...overrides,
  }
}

describe("account type resolution", () => {
  it("never trusts client role — server path determines faculty", () => {
    assert.equal(resolveServerAccountType({ registrationPath: "faculty_signup" }), "faculty")
    assert.equal(resolveServerAccountType({ registrationPath: "student_roster" }), "student")
  })

  it("maps legacy request_kind to account type", () => {
    assert.equal(accountTypeFromRequestKind("roster"), "student")
    assert.equal(accountTypeFromRequestKind("guest"), "career_member")
    assert.equal(accountTypeFromRequestKind("faculty"), "faculty")
    assert.equal(accountTypeFromRequestKind("camp_password_reset"), null)
  })
})

describe("approval policy", () => {
  it("denies student self-activation via faculty role", () => {
    const decision = canReviewerApproveRequest(
      { role: "faculty", instructorId: 5, courseId: 10, isActive: true },
      baseRequest({ request_kind: "faculty", account_type: "faculty" }),
    )
    assert.equal(decision.ok, false)
  })

  it("denies faculty approving another faculty", () => {
    const decision = canReviewerApproveRequest(
      { role: "faculty", instructorId: 5, courseId: 10, isActive: true },
      baseRequest({ request_kind: "faculty", account_type: "faculty" }),
    )
    assert.equal(decision.ok, false)
  })

  it("allows faculty approving student in own course", () => {
    const decision = canReviewerApproveRequest(
      { role: "faculty", instructorId: 5, courseId: 10, isActive: true },
      baseRequest({ course_id: 10 }),
    )
    assert.equal(decision.ok, true)
  })

  it("denies faculty approving student outside course", () => {
    const decision = canReviewerApproveRequest(
      { role: "faculty", instructorId: 5, courseId: 10, isActive: true },
      baseRequest({ course_id: 99 }),
    )
    assert.equal(decision.ok, false)
  })

  it("denies platform career member approval by faculty without sponsorship", () => {
    const decision = canReviewerApproveRequest(
      { role: "faculty", instructorId: 5, courseId: 10, isActive: true },
      baseRequest({
        request_kind: "guest",
        account_type: "career_member",
        course_id: null,
        sponsoring_faculty_id: null,
      }),
    )
    assert.equal(decision.ok, false)
  })

  it("allows sponsoring faculty to approve career member", () => {
    const decision = canReviewerApproveRequest(
      { role: "faculty", instructorId: 5, courseId: 10, isActive: true },
      baseRequest({
        request_kind: "guest",
        account_type: "career_member",
        sponsoring_faculty_id: 5,
      }),
    )
    assert.equal(decision.ok, true)
  })

  it("admin may approve faculty", () => {
    const decision = canReviewerApproveRequest(
      { role: "admin", adminId: 1 },
      baseRequest({ request_kind: "faculty", account_type: "faculty", course_id: null }),
    )
    assert.equal(decision.ok, true)
  })

  it("ignores tampered account_type when request_kind defines student", () => {
    const decision = canReviewerApproveRequest(
      { role: "faculty", instructorId: 5, courseId: 10, isActive: true },
      baseRequest({ request_kind: "roster", account_type: "admin" as never }),
    )
    assert.equal(decision.ok, true)
    assert.equal(resolveAccountTypeForRequest(baseRequest({ request_kind: "roster", account_type: "admin" as never })), "student")
  })

  it("denies applicant role student from approving anyone", () => {
    const decision = canReviewerApproveRequest(
      { role: "faculty", instructorId: 999, courseId: 10, isActive: false },
      baseRequest({ course_id: 10 }),
    )
    assert.equal(decision.ok, false)
  })

  it("allows faculty approving summer student when camp scoped", () => {
    const decision = canReviewerApproveRequest(
      { role: "faculty", instructorId: 5, courseId: 10, isActive: true },
      baseRequest({
        request_kind: "summer_student",
        account_type: "summer_student",
        camp_id: 3,
        course_id: null,
      }),
    )
    assert.equal(decision.ok, true)
  })

  it("denies faculty approving summer student without program scope", () => {
    const decision = canReviewerApproveRequest(
      { role: "faculty", instructorId: 5, courseId: 10, isActive: true },
      baseRequest({
        request_kind: "summer_student",
        account_type: "summer_student",
        camp_id: null,
      }),
    )
    assert.equal(decision.ok, false)
  })

  it("denies faculty approving unsponsored career member", () => {
    const decision = canReviewerApproveRequest(
      { role: "faculty", instructorId: 7, courseId: 10, isActive: true },
      baseRequest({
        request_kind: "guest",
        account_type: "career_member",
        sponsoring_faculty_id: null,
      }),
    )
    assert.equal(decision.ok, false)
  })

  it("requires email verification before approval when email present", () => {
    assert.equal(requiresEmailVerificationBeforeApproval(baseRequest({ email: "a@b.com" })), true)
    assert.equal(requiresEmailVerificationBeforeApproval(baseRequest({ email: null })), false)
    assert.equal(
      requiresEmailVerificationBeforeApproval(
        baseRequest({ request_kind: "camp_password_reset", email: "a@b.com" }),
      ),
      false,
    )
    const blocked = canApproveAfterEmailVerification(baseRequest({ email_verified_at: null }))
    assert.equal(blocked.ok, false)
    const allowed = canApproveAfterEmailVerification(
      baseRequest({ email_verified_at: new Date().toISOString() }),
    )
    assert.equal(allowed.ok, true)
  })
})

describe("invitation tokens", () => {
  it("hashes tokens consistently", () => {
    const a = hashInvitationToken("secret-token")
    const b = hashInvitationToken("secret-token")
    assert.equal(a, b)
    assert.notEqual(a, hashInvitationToken("other"))
  })
})
