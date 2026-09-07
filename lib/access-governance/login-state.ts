import { sql } from "@/lib/db"
import { accountTypeFromRequestKind } from "@/lib/access-governance/kinds"
import {
  findPendingAccessRequestForLogin,
  findRejectedAccessRequestForLogin,
} from "@/lib/access-governance/service"
import type { AccessAccountType, AccountLifecycleStatus } from "@/lib/access-governance/types"

export type AccountAccessSnapshot = {
  lifecycle: AccountLifecycleStatus | "not_found"
  accountType?: AccessAccountType
  request?: {
    id: number
    fullName: string
    email?: string | null
    section?: string | null
    organization?: string | null
    program?: string | null
    submittedAt?: string
    emailVerified?: boolean
  }
  rejectionReason?: string | null
}

function requestKindsForPortal(portal: string): string[] {
  switch (portal) {
    case "student":
      return ["roster"]
    case "guest":
    case "career_member":
      return ["guest"]
    case "faculty":
      return ["faculty"]
    case "summer":
    case "summer_student":
      return ["summer_camper", "summer_student"]
    default:
      return ["roster", "guest", "faculty", "summer_camper", "summer_student"]
  }
}

/** Shared pre-login resolver — never trusts client-supplied role or account type. */
export async function resolveAccountAccessState(input: {
  portal: "student" | "guest" | "faculty" | "summer"
  loginId: string
  email?: string | null
}): Promise<AccountAccessSnapshot> {
  const login = input.loginId.trim()
  const email = input.email?.trim().toLowerCase() ?? ""

  if (input.portal === "faculty") {
    const emailNorm = email.includes("@") ? email : ""
    const instructorRows = emailNorm
      ? ((await sql`
          SELECT account_lifecycle_status, deleted_at, COALESCE(is_active, true) AS is_active
          FROM instructors
          WHERE LOWER(TRIM(username)) = LOWER(${login})
             OR LOWER(TRIM(email)) = ${emailNorm}
          LIMIT 1
        `) as Array<{ account_lifecycle_status?: string; deleted_at?: string | null; is_active?: boolean }>)
      : ((await sql`
          SELECT account_lifecycle_status, deleted_at, COALESCE(is_active, true) AS is_active
          FROM instructors
          WHERE LOWER(TRIM(username)) = LOWER(${login})
          LIMIT 1
        `) as Array<{ account_lifecycle_status?: string; deleted_at?: string | null; is_active?: boolean }>)

    const instructor = instructorRows[0]

    if (instructor) {
      if (instructor.deleted_at) return { lifecycle: "deactivated" }
      if (instructor.is_active === false || instructor.account_lifecycle_status === "suspended") {
        return { lifecycle: "suspended" }
      }
      if (instructor.account_lifecycle_status === "rejected") {
        return { lifecycle: "rejected" }
      }
      return { lifecycle: "active", accountType: "faculty" }
    }

    const pending = await findPendingAccessRequestForLogin({
      loginId: login,
      email: email || null,
      requestKinds: ["faculty"],
    })
    if (pending) {
      const needsEmailVerification = Boolean(pending.email?.includes("@")) && !pending.email_verified_at
      return {
        lifecycle: needsEmailVerification ? "pending_email_verification" : "pending_approval",
        accountType: "faculty",
        request: {
          id: pending.id,
          fullName: pending.full_name,
          email: pending.email,
          organization: pending.organization,
          submittedAt: pending.created_at,
          emailVerified: Boolean(pending.email_verified_at),
        },
      }
    }

    const rejected = await findRejectedAccessRequestForLogin({ loginId: login, email: email || null })
    if (rejected && rejected.request_kind === "faculty") {
      return { lifecycle: "rejected", accountType: "faculty", rejectionReason: rejected.rejection_reason }
    }

    return { lifecycle: "not_found" }
  }

  if (input.portal === "guest") {
    const [guest] = (await sql`
      SELECT account_lifecycle_status, deleted_at
      FROM students
      WHERE is_platform_guest = true
        AND TRIM(LOWER(COALESCE(email, ''))) = ${email.includes("@") ? email : login.toLowerCase()}
      LIMIT 1
    `) as Array<{ account_lifecycle_status?: string; deleted_at?: string | null }>

    if (guest) {
      if (guest.deleted_at) return { lifecycle: "deactivated" }
      if (guest.account_lifecycle_status === "suspended") return { lifecycle: "suspended" }
      return { lifecycle: "active", accountType: "career_member" }
    }
  }

  if (input.portal === "student") {
    const emailNorm = email.includes("@") ? email : ""
    const studentRows = emailNorm
      ? ((await sql`
          SELECT account_lifecycle_status, deleted_at, is_platform_guest
          FROM students
          WHERE LOWER(TRIM(student_id::text)) = LOWER(${login})
             OR TRIM(LOWER(COALESCE(email, ''))) = ${emailNorm}
          LIMIT 1
        `) as Array<{ account_lifecycle_status?: string; deleted_at?: string | null; is_platform_guest?: boolean }>)
      : ((await sql`
          SELECT account_lifecycle_status, deleted_at, is_platform_guest
          FROM students
          WHERE LOWER(TRIM(student_id::text)) = LOWER(${login})
          LIMIT 1
        `) as Array<{ account_lifecycle_status?: string; deleted_at?: string | null; is_platform_guest?: boolean }>)

    const student = studentRows[0]

    if (student && !student.is_platform_guest) {
      if (student.deleted_at) return { lifecycle: "deactivated" }
      if (student.account_lifecycle_status === "suspended") return { lifecycle: "suspended" }
      return { lifecycle: "active", accountType: "student" }
    }
  }

  const kinds = requestKindsForPortal(input.portal)
  const pending = await findPendingAccessRequestForLogin({
    loginId: login,
    email: email || null,
    requestKinds: kinds,
  })
  if (pending) {
    const accountType = accountTypeFromRequestKind(pending.request_kind) ?? pending.account_type ?? undefined
    const needsEmailVerification =
      Boolean(pending.email?.includes("@")) && !pending.email_verified_at && pending.request_kind !== "camp_password_reset"
    return {
      lifecycle: needsEmailVerification ? "pending_email_verification" : "pending_approval",
      accountType: accountType ?? undefined,
      request: {
        id: pending.id,
        fullName: pending.full_name,
        email: pending.email,
        section: pending.section,
        organization: pending.organization ?? pending.school_affiliation,
        program: pending.camp_id != null ? `Summer program #${pending.camp_id}` : null,
        submittedAt: pending.created_at,
        emailVerified: Boolean(pending.email_verified_at),
      },
    }
  }

  const rejected = await findRejectedAccessRequestForLogin({ loginId: login, email: email || null })
  if (rejected && kinds.includes(rejected.request_kind)) {
    return {
      lifecycle: "rejected",
      accountType: accountTypeFromRequestKind(rejected.request_kind) ?? rejected.account_type ?? undefined,
      rejectionReason: rejected.rejection_reason,
    }
  }

  return { lifecycle: "not_found" }
}
