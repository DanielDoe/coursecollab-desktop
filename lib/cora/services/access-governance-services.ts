import { sql } from "@/lib/db"
import { formatAccessRequestLineForExternalAi } from "@/lib/cora/privacy/ai-data-minimization"
import { resolveAccountTypeForRequest } from "@/lib/access-governance/policies"
import { accountTypeFromRequestKind } from "@/lib/access-governance/kinds"
import type { AccessRequestRow, ReviewerContext } from "@/lib/access-governance/types"

export type AccessRequestListItem = {
  id: number
  fullName: string
  loginId: string
  email: string | null
  accountType: string | null
  requestKind: string
  section: string | null
  organization: string | null
  status: string
  createdAt: string
  emailVerified: boolean
}

function toListItem(row: AccessRequestRow): AccessRequestListItem {
  return {
    id: row.id,
    fullName: row.full_name,
    loginId: row.student_id,
    email: row.email,
    accountType: resolveAccountTypeForRequest(row),
    requestKind: row.request_kind,
    section: row.section,
    organization: row.organization ?? row.school_affiliation,
    status: row.status,
    createdAt: row.created_at,
    emailVerified: Boolean(row.email_verified_at),
  }
}

export async function listFacultyApprovableAccessRequests(input: {
  instructorId: number
  courseId: number
  status?: string
  limit?: number
}): Promise<AccessRequestListItem[]> {
  const status = input.status ?? "pending"
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100)

  const rows = (await sql`
    SELECT ar.*
    FROM account_requests ar
    WHERE ar.status = ${status}
      AND ar.request_kind != 'camp_password_reset'
      AND (
        (
          COALESCE(ar.request_kind, 'roster') = 'roster'
          AND EXISTS (
            SELECT 1 FROM sessions sess
            WHERE sess.course_id = ${input.courseId}
              AND TRIM(sess.code) = TRIM(COALESCE(ar.section, ''))
          )
        )
        OR (
          COALESCE(ar.request_kind, 'roster') = 'guest'
          AND ar.sponsoring_faculty_id = ${input.instructorId}
        )
      )
    ORDER BY ar.created_at ASC
    LIMIT ${limit}
  `) as AccessRequestRow[]

  return rows.map(toListItem)
}

export async function listAdminAccessRequests(input: {
  status?: string
  accountType?: string | null
  limit?: number
}): Promise<AccessRequestListItem[]> {
  const status = input.status ?? "pending"
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200)

  const rows = input.accountType
    ? ((await sql`
        SELECT * FROM account_requests
        WHERE status = ${status}
          AND account_type = ${input.accountType}
        ORDER BY created_at ASC
        LIMIT ${limit}
      `) as AccessRequestRow[])
    : ((await sql`
        SELECT * FROM account_requests
        WHERE status = ${status}
          AND request_kind != 'camp_password_reset'
        ORDER BY created_at ASC
        LIMIT ${limit}
      `) as AccessRequestRow[])

  return rows.map(toListItem)
}

export function formatAccessRequestListMarkdown(
  items: AccessRequestListItem[],
  heading: string,
): string {
  if (items.length === 0) return `${heading}\n\nNo matching requests.`
  const lines = items.map((r) =>
    formatAccessRequestLineForExternalAi({
      requestId: r.id,
      accountType: r.accountType ?? accountTypeFromRequestKind(r.requestKind) ?? r.requestKind,
      section: r.section,
      emailVerified: r.emailVerified,
    }),
  )
  return [heading, "", ...lines].join("\n")
}

export type DecideAccessRequestInput = {
  requestId: number
  reviewer: ReviewerContext
  decision: "approve" | "reject"
  reason?: string
  approvalSource?: "admin" | "faculty" | "invitation" | "import" | "system_policy"
}

export async function decideAccessRequest(input: DecideAccessRequestInput) {
  if (input.decision === "approve") {
    const { approveAccessRequest } = await import("@/lib/access-governance/service")
    return approveAccessRequest({
      requestId: input.requestId,
      reviewer: input.reviewer,
      approvalSource: input.approvalSource,
    })
  }
  const { rejectAccessRequest } = await import("@/lib/access-governance/service")
  await rejectAccessRequest({
    requestId: input.requestId,
    reviewer: input.reviewer,
    reason: input.reason,
  })
  return { ok: true as const }
}
