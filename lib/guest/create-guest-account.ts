import bcrypt from "bcryptjs"
import { sql } from "@/lib/db"
import {
  isValidGuestOccupation,
  isValidGuestOnboardingPurpose,
  normalizeGuestOnboardingPurpose,
} from "@/lib/guest/onboarding"
import { ensureGuestFreeEntitlement, ensureGuestProfile } from "@/lib/guest/entitlements"
import { generateGuestExternalStudentId, getPlatformGuestSessionId } from "@/lib/platform-guest-session"
import { upsertGuestMasterResume } from "@/lib/guest/career/store"
import { isAllowedGuestResumeFile } from "@/lib/guest/career/resume-file"
import { savePublicUpload } from "@/lib/blob-or-local-public"
import { resolveUniversityIdForAccount } from "@/lib/universities"

export type CreateGuestAccountInput = {
  purpose: string
  purposeNote?: string
  email: string
  password: string
  firstName: string
  lastName: string
  organization: string
  occupation?: string
  resumeText?: string
  resumeFileName?: string
  resumeFile?: { bytes: Buffer; fileName: string; mime: string }
  universityId?: number | null
}

export type CreateGuestAccountResult =
  | { ok: true; student: Record<string, unknown>; guestAccessPurpose: string }
  | { ok: false; status: number; error: string }

async function ensureGuestOccupationColumn() {
  await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS guest_occupation VARCHAR(40)`
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS students_platform_guest_email_uidx
    ON students (LOWER(TRIM(email)))
    WHERE COALESCE(is_platform_guest, false) = true
      AND email IS NOT NULL
      AND TRIM(email) <> ''
  `
}

export async function createGuestAccount(input: CreateGuestAccountInput): Promise<CreateGuestAccountResult> {
  await ensureGuestOccupationColumn()

  const purpose = String(input.purpose ?? "").trim()
  const purposeNote = String(input.purposeNote ?? "").trim()
  const email = String(input.email ?? "").trim().toLowerCase()
  const password = String(input.password ?? "")
  const firstName = String(input.firstName ?? "").trim()
  const lastName = String(input.lastName ?? "").trim()
  const organization = String(input.organization ?? "").trim()
  const occupationRaw = String(input.occupation ?? "").trim()
  const resumeText = String(input.resumeText ?? "").trim()
  const resumeFileName = String(input.resumeFileName ?? "").trim() || null

  if (!isValidGuestOnboardingPurpose(purpose)) {
    return { ok: false, status: 400, error: "Invalid purpose" }
  }
  const normalizedPurpose = normalizeGuestOnboardingPurpose(purpose)
  if (normalizedPurpose === "other_academic" && purposeNote.length < 2) {
    return { ok: false, status: 400, error: "Please describe what you’ll use CourseCollab for." }
  }
  if (!email.includes("@")) {
    return { ok: false, status: 400, error: "Enter a valid email" }
  }
  if (password.length < 8) {
    return { ok: false, status: 400, error: "Password must be at least 8 characters" }
  }
  if (!firstName || !lastName) {
    return { ok: false, status: 400, error: "First and last name are required" }
  }
  if (!organization) {
    return { ok: false, status: 400, error: "School, company, or organization is required" }
  }
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

  const sessionId = await getPlatformGuestSessionId()
  const externalId = generateGuestExternalStudentId()
  const fullName = `${firstName} ${lastName}`.trim()
  const hash = await bcrypt.hash(password, 10)
  const universityId = await resolveUniversityIdForAccount({
    universityId: input.universityId,
    email,
    organization,
  })

  const inserted = await sql`
    INSERT INTO students (
      student_id,
      full_name,
      section,
      session_id,
      password_hash,
      has_changed_password,
      email,
      is_platform_guest,
      guest_access_purpose,
      guest_purpose_note,
      guest_organization,
      guest_occupation,
      university_id
    )
    VALUES (
      ${externalId},
      ${fullName},
      'GUEST',
      ${sessionId},
      ${hash},
      true,
      ${email},
      true,
      ${normalizedPurpose},
      ${normalizedPurpose === "other_academic" ? purposeNote : null},
      ${organization},
      ${occupationRaw},
      ${universityId}
    )
    RETURNING *
  `

  const row = inserted[0] as Record<string, unknown>
  const guestId = Number(row.id)
  await ensureGuestFreeEntitlement(guestId)
  await ensureGuestProfile(guestId, {
    onboardingPurpose: normalizedPurpose,
    organization,
  })

  const resumeFile = input.resumeFile
  const hasResumeFile = Boolean(resumeFile && resumeFile.bytes.length > 0)
  if (hasResumeFile && resumeFile) {
    const allowed = isAllowedGuestResumeFile({
      name: resumeFile.fileName,
      type: resumeFile.mime,
      size: resumeFile.bytes.length,
    })
    if (!allowed.ok) return { ok: false, status: 400, error: allowed.error }
  }

  if (hasResumeFile || resumeText.length > 0) {
    let originalFileUrl: string | null = null
    const fileName = resumeFile?.fileName || resumeFileName
    const mime = resumeFile?.mime || null
    if (resumeFile && resumeFile.bytes.length > 0) {
      try {
        const ext = (resumeFile.fileName.split(".").pop() || "bin").toLowerCase()
        originalFileUrl = await savePublicUpload({
          blobKey: `uploads/guest-career/${guestId}/resume-${Date.now()}.${ext}`,
          relativePublicPath: `uploads/guest-career/${guestId}/resume-${Date.now()}.${ext}`,
          bytes: resumeFile.bytes,
          contentType: resumeFile.mime || "application/octet-stream",
        })
      } catch (err) {
        console.error("[create-guest-account] résumé upload", err)
      }
    }
    await upsertGuestMasterResume({
      guestId,
      parsedText: resumeText,
      originalFileName: fileName,
      originalFileUrl,
      originalMime: mime,
    })
  }

  return { ok: true, student: row, guestAccessPurpose: normalizedPurpose }
}
