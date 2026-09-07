import bcrypt from "bcryptjs"
import { generateGuestExternalStudentId } from "@/lib/platform-guest-session"
import {
  isValidGuestOccupation,
  isValidGuestOnboardingPurpose,
  normalizeGuestOnboardingPurpose,
} from "@/lib/guest/onboarding"
import { createAccessRequest } from "@/lib/access-governance/service"
import type { CreateGuestAccountInput } from "@/lib/guest/create-guest-account"
import { resolveUniversityIdForAccount } from "@/lib/universities"
import { sql } from "@/lib/db"

export type SubmitGuestAccessResult =
  | { ok: true; requestId: number; autoApproved: boolean; studentId?: number }
  | { ok: false; status: number; error: string }

/** Career Member registration → pending access request (Admin or sponsoring Faculty approves). */
export async function submitCareerMemberAccessRequest(
  input: CreateGuestAccountInput & { sponsoringFacultyId?: number | null; invitationToken?: string | null },
): Promise<SubmitGuestAccessResult> {
  const purpose = String(input.purpose ?? "").trim()
  const purposeNote = String(input.purposeNote ?? "").trim()
  const email = String(input.email ?? "").trim().toLowerCase()
  const password = String(input.password ?? "")
  const firstName = String(input.firstName ?? "").trim()
  const lastName = String(input.lastName ?? "").trim()
  const organization = String(input.organization ?? "").trim()
  const occupationRaw = String(input.occupation ?? "").trim()

  if (!isValidGuestOnboardingPurpose(purpose)) {
    return { ok: false, status: 400, error: "Invalid purpose" }
  }
  const normalizedPurpose = normalizeGuestOnboardingPurpose(purpose)
  if (normalizedPurpose === "other_academic" && purposeNote.length < 2) {
    return { ok: false, status: 400, error: "Please describe what you'll use CourseCollab for." }
  }
  if (!email.includes("@")) return { ok: false, status: 400, error: "Enter a valid email" }
  if (password.length < 8) return { ok: false, status: 400, error: "Password must be at least 8 characters" }
  if (!firstName || !lastName) return { ok: false, status: 400, error: "First and last name are required" }
  if (!organization) return { ok: false, status: 400, error: "School, company, or organization is required" }
  if (!isValidGuestOccupation(occupationRaw)) {
    return { ok: false, status: 400, error: "Tell us your current status" }
  }

  const dup = await sql`
    SELECT id FROM students
    WHERE COALESCE(is_platform_guest, false) = true
      AND TRIM(LOWER(COALESCE(email, ''))) = ${email}
    LIMIT 1
  `
  if (dup.length > 0) {
    return {
      ok: false,
      status: 409,
      error: "A Career Member account already exists for this email. Sign in instead.",
    }
  }

  const pending = await sql`
    SELECT id FROM account_requests
    WHERE status = 'pending' AND request_kind = 'guest'
      AND LOWER(TRIM(email)) = ${email}
    LIMIT 1
  `
  if (pending.length > 0) {
    return {
      ok: false,
      status: 400,
      error: "You already have a pending access request. We'll notify you when it's reviewed.",
    }
  }

  const universityId = await resolveUniversityIdForAccount({
    universityId: input.universityId,
    email,
    organization,
  })

  const hash = await bcrypt.hash(password, 10)
  const externalId = generateGuestExternalStudentId()
  const fullName = `${firstName} ${lastName}`.trim()

  try {
    const result = await createAccessRequest({
      registrationPath: input.invitationToken ? "invitation" : "career_member",
      fullName,
      loginId: externalId,
      email,
      organization,
      universityId,
      guestPurpose: normalizedPurpose,
      guestPurposeDetail: purposeNote || null,
      passwordHash: hash,
      sponsoringFacultyId: input.sponsoringFacultyId ?? null,
      invitationToken: input.invitationToken ?? null,
      metadata: { occupation: occupationRaw },
    })

    if (result.autoApproved) {
      return { ok: true, requestId: result.requestId, autoApproved: true, studentId: result.userId }
    }

    return { ok: true, requestId: result.requestId, autoApproved: false }
  } catch (e) {
    return {
      ok: false,
      status: 400,
      error: e instanceof Error ? e.message : "Failed to submit access request",
    }
  }
}
