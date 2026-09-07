import bcrypt from "bcryptjs"
import { sql } from "@/lib/db"
import { ensureGuestFreeEntitlement } from "@/lib/guest/entitlements"
import { notifyGuestAccountApproved } from "@/lib/notify-guest-account-approved-email"
import { getPlatformGuestSessionId } from "@/lib/platform-guest-session"
import { resolveSessionRowByCode } from "@/lib/resolve-session-by-code"
import { getStudentRosterDefaultPassword } from "@/lib/student-roster-default-password"
import { ensureFacultyPasswordColumn, hashFacultyPassword } from "@/lib/faculty-password"
import { approveSummerCamperRequest } from "@/lib/summer-camp/camper-accounts"
import type { AccessAccountType, AccessRequestRow, ApprovalSource } from "@/lib/access-governance/types"
import { accountTypeFromRequestKind } from "@/lib/access-governance/kinds"

export type ActivationResult = {
  accountType: AccessAccountType
  userId: number
  message: string
}

async function activateFaculty(row: AccessRequestRow): Promise<ActivationResult> {
  const username = String(row.student_id ?? "").trim().toLowerCase()
  const email = String(row.email ?? "").trim().toLowerCase()
  const password = row.faculty_password

  if (!username || !email.includes("@") || !password) {
    throw new Error("Faculty request is missing required fields.")
  }

  const dup = await sql`
    SELECT id FROM instructors
    WHERE LOWER(username) = ${username} OR LOWER(TRIM(email)) = ${email}
    LIMIT 1
  `
  if (dup.length > 0) throw new Error("An instructor with this username or email already exists.")

  const { ensureInstructorProfileColumns } = await import("@/lib/ensure-instructor-profile-columns")
  await ensureInstructorProfileColumns()
  await sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS role VARCHAR(32) NOT NULL DEFAULT 'instructor'`
  await sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`
  await sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS has_changed_password BOOLEAN NOT NULL DEFAULT true`
  await sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS account_lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'active'`

  await ensureFacultyPasswordColumn()
  const passwordHash = await hashFacultyPassword(String(password))

  const { ensurePortalRbacSeed } = await import("@/lib/ensure-portal-rbac-seed")
  await ensurePortalRbacSeed()

  const [newInstructor] = await sql`
    INSERT INTO instructors (
      username, email, name, password, role, is_active, has_changed_password,
      institution, job_title, created_at, account_lifecycle_status, university_id
    )
    VALUES (
      ${username},
      ${email},
      ${row.full_name},
      ${passwordHash},
      'instructor',
      true,
      true,
      ${row.organization ?? null},
      ${row.faculty_job_title ?? null},
      NOW(),
      'active',
      ${row.university_id ?? null}
    )
    RETURNING id
  `

  const { provisionFacultyTeachingAccess } = await import("@/lib/provision-faculty-course-access")

  const newId = Number((newInstructor as { id: number }).id)
  await provisionFacultyTeachingAccess(newId)

  return {
    accountType: "faculty",
    userId: newId,
    message: `${row.full_name} can now sign in at the faculty portal.`,
  }
}

async function activateCareerMember(row: AccessRequestRow): Promise<ActivationResult> {
  const hash = row.guest_password_hash
  if (!hash || String(hash).length < 20) {
    throw new Error("Career Member request has no stored password hash.")
  }

  const email = String(row.email ?? "").trim().toLowerCase()
  if (!email.includes("@")) throw new Error("Invalid email on request.")

  const dup = await sql`
    SELECT id FROM students
    WHERE TRIM(LOWER(COALESCE(email, ''))) = ${email}
    LIMIT 1
  `
  if (dup.length > 0) throw new Error("An account with this email already exists.")

  const sessionId = await getPlatformGuestSessionId()
  const purposeRaw = String(row.guest_purpose ?? "")
  const purpose = purposeRaw === "recommendation_letter" || purposeRaw === "other" ? purposeRaw : "other"
  const note =
    purpose === "other" ? (row.guest_purpose_detail != null ? String(row.guest_purpose_detail) : null) : null

  const [newStudent] = await sql`
    INSERT INTO students (
      student_id, full_name, section, session_id, password_hash,
      has_changed_password, email, is_platform_guest,
      guest_access_purpose, guest_purpose_note, guest_organization,
      account_lifecycle_status, university_id
    )
    VALUES (
      ${row.student_id},
      ${row.full_name},
      'GUEST',
      ${sessionId},
      ${hash},
      true,
      ${email},
      true,
      ${purpose},
      ${note},
      ${row.organization ?? ""},
      'active',
      ${row.university_id ?? null}
    )
    RETURNING id
  `

  const studentId = Number((newStudent as { id: number }).id)
  await ensureGuestFreeEntitlement(studentId)

  if (row.sponsoring_faculty_id != null) {
    await sql`
      INSERT INTO career_member_sponsorships (student_id, sponsoring_faculty_id, status)
      VALUES (${studentId}, ${row.sponsoring_faculty_id}, 'active')
      ON CONFLICT (student_id, sponsoring_faculty_id) DO NOTHING
    `
  }

  try {
    await notifyGuestAccountApproved(email, row.full_name, purpose)
  } catch {
    /* non-fatal */
  }

  return {
    accountType: "career_member",
    userId: studentId,
    message: "Career Member account approved. Course enrollment was not granted.",
  }
}

async function activateStudent(row: AccessRequestRow): Promise<ActivationResult> {
  let sessionCode = row.section
  let sessionId = row.session_id

  if (sessionId == null && sessionCode) {
    const resolved = await resolveSessionRowByCode(String(sessionCode))
    if (!resolved) throw new Error(`Session ${sessionCode} not found`)
    sessionId = resolved.id
    sessionCode = resolved.code
  }

  if (sessionId == null) throw new Error("Student request is missing section scope.")

  const sessCourseRows = await sql`
    SELECT c.course_code, s.code
    FROM sessions s
    LEFT JOIN courses c ON c.id = s.course_id
    WHERE s.id = ${sessionId}
    LIMIT 1
  `
  const rosterDefaultPassword = getStudentRosterDefaultPassword(
    sessCourseRows[0]?.course_code as string | undefined,
  )
  const resolvedCode = String(sessCourseRows[0]?.code ?? sessionCode ?? "")

  const [newStudent] = await sql`
    INSERT INTO students (
      student_id, full_name, section, email, password,
      has_changed_password, session_id, account_lifecycle_status, university_id
    )
    VALUES (
      ${row.student_id},
      ${row.full_name},
      ${resolvedCode},
      ${row.email},
      ${rosterDefaultPassword},
      false,
      ${sessionId},
      'active',
      ${row.university_id ?? null}
    )
    RETURNING id
  `

  return {
    accountType: "student",
    userId: Number((newStudent as { id: number }).id),
    message: `Student account approved. Default password: ${rosterDefaultPassword}.`,
  }
}

async function activateSummerStudent(
  requestId: number,
  approvedBy: string | number,
): Promise<ActivationResult> {
  const result = await approveSummerCamperRequest(requestId, approvedBy)
  return {
    accountType: "summer_student",
    userId: result.studentId,
    message: "Summer Student account approved. No semester course enrollment was created.",
  }
}

/** Atomic activation — caller must wrap in transaction context where supported. */
export async function activateAccessRequest(input: {
  request: AccessRequestRow
  requestId: number
  approvedBy: string | number
  approvalSource: ApprovalSource
}): Promise<ActivationResult> {
  const accountType =
    input.request.account_type ?? accountTypeFromRequestKind(input.request.request_kind)

  if (!accountType) throw new Error("Unsupported access request type.")

  switch (accountType) {
    case "faculty":
      return activateFaculty(input.request)
    case "career_member":
      return activateCareerMember(input.request)
    case "student":
      return activateStudent(input.request)
    case "summer_student":
      return activateSummerStudent(input.requestId, input.approvedBy)
    default:
      throw new Error("Activation not supported for this account type.")
  }
}
