import { NextResponse, type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { readRefreshTokenFromRequest, validateRefreshToken } from "@/lib/auth-refresh-tokens"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"

export const INSTITUTION_ADMIN_ROLES = [
  "owner",
  "institution_admin",
  "billing_admin",
  "academic_admin",
  "department_admin",
  "research_admin",
  "analytics_viewer",
] as const

export type InstitutionAdminRole = (typeof INSTITUTION_ADMIN_ROLES)[number]

export type InstitutionSession = {
  institutionId: number
  memberId: number
  role: InstitutionAdminRole
  userType: "instructor" | "admin" | "student" | "institution_admin"
  userId: number
  institutionName: string
}

function isInstitutionAdminRole(role: string): role is InstitutionAdminRole {
  return (INSTITUTION_ADMIN_ROLES as readonly string[]).includes(role)
}

export function canManageFaculty(role: InstitutionAdminRole): boolean {
  return role === "owner" || role === "institution_admin" || role === "academic_admin" || role === "department_admin"
}

export function canAccessBilling(role: InstitutionAdminRole): boolean {
  return role === "owner" || role === "institution_admin" || role === "billing_admin"
}

export function canExportResearch(role: InstitutionAdminRole): boolean {
  return (
    role === "owner" ||
    role === "institution_admin" ||
    role === "academic_admin" ||
    role === "research_admin"
  )
}

export function canManageResearchStudies(role: InstitutionAdminRole): boolean {
  return canExportResearch(role)
}

export async function resolveInstitutionSession(
  request: NextRequest,
): Promise<InstitutionSession | null> {
  await ensureInstitutionSchema()
  const raw = readRefreshTokenFromRequest(request)
  if (!raw) return null
  const token = await validateRefreshToken(raw)
  if (!token) return null
  if (
    token.userType !== "instructor" &&
    token.userType !== "admin" &&
    token.userType !== "student" &&
    token.userType !== "institution_admin"
  ) {
    return null
  }

  const rows = (await sql`
    SELECT m.id, m.institution_id, m.role, m.status, u.name
    FROM institution_members m
    JOIN universities u ON u.id = m.institution_id
    WHERE m.user_type = ${token.userType}
      AND m.user_id = ${token.userId}
      AND m.status = 'active'
      AND m.removed_at IS NULL
    ORDER BY m.id ASC
    LIMIT 1
  `) as Array<{ id: number; institution_id: number; role: string; status: string; name: string }>

  const row = rows[0]
  if (!row || !isInstitutionAdminRole(row.role)) return null

  return {
    institutionId: Number(row.institution_id),
    memberId: Number(row.id),
    role: row.role,
    userType: token.userType,
    userId: token.userId,
    institutionName: String(row.name),
  }
}

export async function requireInstitutionAdmin(
  request: NextRequest,
  opts?: { billing?: boolean },
): Promise<{ ok: true; session: InstitutionSession } | { ok: false; response: NextResponse }> {
  const session = await resolveInstitutionSession(request)
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "Institution admin authentication required" }, { status: 401 }) }
  }
  if (opts?.billing && !canAccessBilling(session.role)) {
    return { ok: false, response: NextResponse.json({ error: "Billing access denied" }, { status: 403 }) }
  }
  return { ok: true, session }
}
