import bcrypt from "bcryptjs"
import { type SummerProgramRole } from "@/lib/summer-camp/program-roles"
import { sql } from "@/lib/db"
import {
  notifyCamperAccountApproved,
  notifyCamperAccountRequested,
  notifyCamperPasswordResetApproved,
  notifyCamperPasswordResetRequested,
} from "@/lib/summer-camp/notify-camper-emails"

export const SUMMER_CAMP_SIGNUP_KINDS = ["summer_camper", "summer_student"] as const
export const SUMMER_CAMP_PASSWORD_RESET_KIND = "camp_password_reset" as const
export const SUMMER_CAMP_REQUEST_KINDS = [
  ...SUMMER_CAMP_SIGNUP_KINDS,
  SUMMER_CAMP_PASSWORD_RESET_KIND,
] as const

export type SummerCampRequestKind = (typeof SUMMER_CAMP_REQUEST_KINDS)[number]

export function isSummerCampSignupKind(kind: string): boolean {
  return (SUMMER_CAMP_SIGNUP_KINDS as readonly string[]).includes(kind)
}

export function isSummerCampPasswordResetKind(kind: string): boolean {
  return kind === SUMMER_CAMP_PASSWORD_RESET_KIND
}

function resolveApprovedById(approvedBy: string | number): number | null {
  if (typeof approvedBy === "number") {
    return Number.isFinite(approvedBy) ? approvedBy : null
  }
  const trimmed = String(approvedBy).trim()
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) && String(parsed) === trimmed ? parsed : null
}

let cachedSummerCampSessionId: number | undefined

export async function getSummerCampSessionId(): Promise<number> {
  if (cachedSummerCampSessionId != null) return cachedSummerCampSessionId
  const rows = (await sql`
    SELECT id FROM sessions WHERE TRIM(UPPER(code)) = 'SUMMER_CAMP' LIMIT 1
  `) as { id: number }[]
  if (rows.length === 0) {
    const course = (await sql`SELECT id FROM courses WHERE is_active = true ORDER BY id LIMIT 1`) as { id: number }[]
    if (course.length === 0) throw new Error("No active course for SUMMER_CAMP session")
    const inserted = (await sql`
      INSERT INTO sessions (code, course_id, description)
      VALUES ('SUMMER_CAMP', ${course[0].id}, 'Summer Camp campers')
      RETURNING id
    `) as { id: number }[]
    cachedSummerCampSessionId = inserted[0].id
    return cachedSummerCampSessionId
  }
  cachedSummerCampSessionId = rows[0].id
  return cachedSummerCampSessionId
}

export function generateSummerCamperStudentId(): string {
  const u =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now()}`
  return `CAMP-${u.slice(0, 12).toUpperCase()}`
}

export async function getPlatformAdminNotifyEmail(): Promise<string> {
  const settings = (await sql`
    SELECT platform_admin_notify_email FROM summer_camp_settings ORDER BY id LIMIT 1
  `) as { platform_admin_notify_email: string | null }[]
  if (settings[0]?.platform_admin_notify_email) {
    return settings[0].platform_admin_notify_email
  }
  const admins = (await sql`
    SELECT email FROM admin_users
    WHERE COALESCE(role, 'PLATFORM_ADMIN') = 'PLATFORM_ADMIN'
      AND email IS NOT NULL AND TRIM(email) != ''
    ORDER BY id LIMIT 1
  `) as { email: string }[]
  return admins[0]?.email ?? "dmdoe@pvamu.edu"
}

export async function getSummerCampAutoApprove(): Promise<boolean> {
  const rows = (await sql`
    SELECT auto_approve_accounts FROM summer_camp_settings ORDER BY id LIMIT 1
  `) as { auto_approve_accounts: boolean }[]
  return rows[0]?.auto_approve_accounts === true
}

export async function materializeSummerStudentAccount(
  req: {
    full_name: string
    student_id: string
    email: string | null
    school_affiliation: string | null
    organization: string | null
    guest_password_hash: string | null
    request_kind: string
  },
): Promise<{ studentId: number; email: string; fullName: string }> {
  const hash = req.guest_password_hash
  if (!hash || hash.length < 20) {
    throw new Error("Request has no stored password hash")
  }

  const email = String(req.email ?? "").trim().toLowerCase()
  const dup = (await sql`
    SELECT id FROM students WHERE TRIM(LOWER(COALESCE(email, ''))) = ${email} LIMIT 1
  `) as { id: number }[]
  if (dup.length > 0) {
    throw new Error("A student with this email already exists")
  }

  const sessionId = await getSummerCampSessionId()
  const programRole: SummerProgramRole =
    req.request_kind === "summer_camper" ? "summer_camper" : "summer_student"

  const [newStudent] = (await sql`
    INSERT INTO students (
      student_id, full_name, section, session_id, password_hash,
      has_changed_password, email, student_program_role, account_lifecycle_status
    )
    VALUES (
      ${req.student_id},
      ${req.full_name},
      'SUMMER_CAMP',
      ${sessionId},
      ${hash},
      true,
      ${email},
      ${programRole},
      'active'
    )
    RETURNING id
  `) as { id: number }[]

  return { studentId: newStudent.id, email, fullName: req.full_name }
}

export async function approveSummerCamperRequest(
  requestId: number,
  approvedBy: string | number,
): Promise<{ studentId: number; email: string; fullName: string }> {
  const [req] = (await sql`
    SELECT * FROM account_requests
    WHERE id = ${requestId}
      AND request_kind IN ('summer_camper', 'summer_student')
      AND status IN ('pending', 'approved')
  `) as Array<{
    id: number
    full_name: string
    student_id: string
    email: string
    school_affiliation: string | null
    organization: string | null
    guest_password_hash: string | null
    request_kind: string
    status: string
  }>

  if (!req) throw new Error("Summer camper request not found or already processed")

  const existing = await findSummerCamperStudentByEmail(String(req.email ?? ""))
  if (existing) {
    return { studentId: existing.id, email: String(req.email ?? ""), fullName: req.full_name }
  }

  const result = await materializeSummerStudentAccount(req)

  if (req.status === "pending") {
    await sql`
      UPDATE account_requests
      SET status = 'approved', approved_by = ${resolveApprovedById(approvedBy)}, approved_at = NOW()
      WHERE id = ${requestId} AND status = 'pending'
    `
  }

  try {
    await notifyCamperAccountApproved(result.email, req.full_name)
  } catch (e) {
    console.error("[approveSummerCamperRequest] email:", e)
  }

  return result
}

export async function findSummerCamperStudentByEmail(email: string) {
  const emailNorm = email.trim().toLowerCase()
  const rows = (await sql`
    SELECT id, full_name, student_id, email, section, student_program_role
    FROM students
    WHERE TRIM(LOWER(COALESCE(email, ''))) = ${emailNorm}
      AND deleted_at IS NULL
      AND (
        section = 'SUMMER_CAMP'
        OR COALESCE(student_program_role, '') IN ('summer_camper', 'summer_student')
        OR EXISTS (
          SELECT 1 FROM camp_enrollments e
          WHERE e.student_id = students.id AND e.status = 'active'
        )
      )
    ORDER BY id DESC
    LIMIT 1
  `) as Array<{
    id: number
    full_name: string
    student_id: string
    email: string
  }>
  return rows[0] ?? null
}

export async function createSummerCamperPasswordResetRequest(params: {
  email: string
  password: string
}): Promise<{ requestId: number }> {
  const emailNorm = params.email.trim().toLowerCase()
  const student = await findSummerCamperStudentByEmail(emailNorm)
  if (!student) {
    return { requestId: 0 }
  }

  const pendingSignup = (await sql`
    SELECT id FROM account_requests
    WHERE status = 'pending'
      AND request_kind IN ('summer_camper', 'summer_student')
      AND TRIM(LOWER(email)) = ${emailNorm}
    LIMIT 1
  `) as { id: number }[]
  if (pendingSignup.length > 0) {
    throw new Error("This email has a pending account signup request. Wait for admin approval first.")
  }

  const pendingReset = (await sql`
    SELECT id FROM account_requests
    WHERE status = 'pending'
      AND request_kind = ${SUMMER_CAMP_PASSWORD_RESET_KIND}
      AND TRIM(LOWER(email)) = ${emailNorm}
    LIMIT 1
  `) as { id: number }[]
  if (pendingReset.length > 0) {
    throw new Error("You already have a pending password reset request. Wait for admin approval.")
  }

  const hash = await bcrypt.hash(params.password, 10)
  const [row] = (await sql`
    INSERT INTO account_requests (
      full_name, student_id, section, email, status,
      request_kind, guest_password_hash
    )
    VALUES (
      ${student.full_name},
      ${student.student_id},
      'SUMMER_CAMP',
      ${emailNorm},
      'pending',
      ${SUMMER_CAMP_PASSWORD_RESET_KIND},
      ${hash}
    )
    RETURNING id
  `) as { id: number }[]

  await notifyCamperPasswordResetRequested({
    adminEmail: await getPlatformAdminNotifyEmail(),
    camperName: student.full_name,
    camperEmail: emailNorm,
  })

  return { requestId: row.id }
}

export async function approveSummerCamperPasswordResetRequest(
  requestId: number,
  approvedBy: string | number,
): Promise<{ studentId: number; email: string; fullName: string }> {
  const [req] = (await sql`
    SELECT * FROM account_requests
    WHERE id = ${requestId} AND status = 'pending'
      AND request_kind = ${SUMMER_CAMP_PASSWORD_RESET_KIND}
  `) as Array<{
    id: number
    full_name: string
    email: string
    guest_password_hash: string | null
  }>

  if (!req) throw new Error("Password reset request not found or already processed")

  const hash = req.guest_password_hash
  if (!hash || hash.length < 20) {
    throw new Error("Request has no stored password hash")
  }

  const email = String(req.email ?? "").trim().toLowerCase()
  const student = await findSummerCamperStudentByEmail(email)
  if (!student) {
    throw new Error("Summer camp student not found for this email")
  }

  await sql`
    UPDATE students
    SET password_hash = ${hash}, has_changed_password = true
    WHERE id = ${student.id}
  `

  await sql`
    UPDATE account_requests
    SET status = 'approved', approved_by = ${resolveApprovedById(approvedBy)}, approved_at = NOW()
    WHERE id = ${requestId}
  `

  try {
    await notifyCamperPasswordResetApproved(email, req.full_name)
  } catch (e) {
    console.error("[approveSummerCamperPasswordResetRequest] email:", e)
  }

  return { studentId: student.id, email, fullName: req.full_name }
}

/** Approve a summer camp signup or password-reset request. */
export async function approveSummerCampRequest(
  requestId: number,
  approvedBy: string | number,
): Promise<{ studentId: number; email: string; fullName: string; kind: SummerCampRequestKind }> {
  const [req] = (await sql`
    SELECT request_kind FROM account_requests
    WHERE id = ${requestId} AND status = 'pending'
      AND request_kind IN ('summer_camper', 'summer_student', 'camp_password_reset')
    LIMIT 1
  `) as { request_kind: string }[]

  if (!req) throw new Error("Summer camp request not found or already processed")

  if (isSummerCampPasswordResetKind(req.request_kind)) {
    const result = await approveSummerCamperPasswordResetRequest(requestId, approvedBy)
    return { ...result, kind: SUMMER_CAMP_PASSWORD_RESET_KIND }
  }

  const result = await approveSummerCamperRequest(requestId, approvedBy)
  return {
    ...result,
    kind: req.request_kind as SummerCampRequestKind,
  }
}

export type ApproveAllSummerCampersResult = {
  approved: Array<{ requestId: number; studentId: number; email: string; fullName: string }>
  failed: Array<{ requestId: number; email: string; error: string }>
}

export async function listPendingSummerCamperRequestIds(): Promise<number[]> {
  const rows = (await sql`
    SELECT id FROM account_requests
    WHERE status = 'pending'
      AND request_kind IN ('summer_camper', 'summer_student')
    ORDER BY created_at ASC, id ASC
  `) as { id: number }[]
  return rows.map((row) => row.id)
}

/** Approve every pending summer camper / summer student account request. */
export async function approveAllPendingSummerCamperRequests(
  approvedBy: string | number,
): Promise<ApproveAllSummerCampersResult> {
  const { approveAccessRequest } = await import("@/lib/access-governance/service")
  const requestIds = await listPendingSummerCamperRequestIds()
  const approved: ApproveAllSummerCampersResult["approved"] = []
  const failed: ApproveAllSummerCampersResult["failed"] = []

  for (const requestId of requestIds) {
    try {
      const result = await approveAccessRequest({
        requestId,
        reviewer: { role: "admin", adminId: approvedBy },
        approvalSource: "admin",
      })
      const [row] = (await sql`
        SELECT email, full_name FROM account_requests WHERE id = ${requestId} LIMIT 1
      `) as { email: string; full_name: string }[]
      approved.push({
        requestId,
        studentId: result.userId,
        email: String(row?.email ?? ""),
        fullName: String(row?.full_name ?? ""),
      })
    } catch (error) {
      const [row] = (await sql`
        SELECT email FROM account_requests WHERE id = ${requestId} LIMIT 1
      `) as { email: string | null }[]
      failed.push({
        requestId,
        email: String(row?.email ?? ""),
        error: error instanceof Error ? error.message : "Approval failed",
      })
    }
  }

  return { approved, failed }
}

export async function createSummerCamperFromSignup(params: {
  fullName: string
  email: string
  school: string
  password: string
  programRole?: SummerProgramRole
  campId?: number | null
  invitationToken?: string | null
  /** Faculty-provisioned signups may skip email verification before approval. */
  markEmailVerified?: boolean
  /** When true, apply platform summer auto-approve policy after request creation. */
  allowSystemAutoApprove?: boolean
}): Promise<{ requestId: number; autoApproved: boolean; studentId?: number }> {
  const { createAccessRequest, approveAccessRequest } = await import("@/lib/access-governance/service")
  const hash = await bcrypt.hash(params.password, 10)
  const studentId = generateSummerCamperStudentId()

  const result = await createAccessRequest({
    registrationPath: "summer_camp",
    fullName: params.fullName,
    loginId: studentId,
    email: params.email,
    schoolAffiliation: params.school,
    organization: params.school,
    passwordHash: hash,
    campId: params.campId ?? null,
    invitationToken: params.invitationToken ?? null,
    markEmailVerified: params.markEmailVerified,
    metadata: { programRole: params.programRole ?? "summer_camper" },
  })

  await notifyCamperAccountRequested({
    adminEmail: await getPlatformAdminNotifyEmail(),
    camperName: params.fullName,
    camperEmail: params.email,
    school: params.school,
  })

  if (result.autoApproved) {
    return result
  }

  const autoApprove =
    params.allowSystemAutoApprove !== false && (await getSummerCampAutoApprove())
  if (autoApprove) {
    const approved = await approveAccessRequest({
      requestId: result.requestId,
      reviewer: { role: "admin", adminId: "system" },
      approvalSource: "system_policy",
    })
    return { requestId: result.requestId, autoApproved: true, studentId: approved.userId }
  }

  return { requestId: result.requestId, autoApproved: false }
}
