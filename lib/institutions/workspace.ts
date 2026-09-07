import { sql } from "@/lib/db"
import { hashAdminPassword } from "@/lib/admin-password"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { getInstitutionPlan } from "@/lib/institution-plans"

export function prospectShortName(name: string): string {
  const base =
    String(name)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8) || "INST"
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${base}${suffix}`.slice(0, 32)
}

export function prospectSlug(name: string): string {
  const base =
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "institution"
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${base}-${suffix}`.slice(0, 128)
}

export class InstitutionWorkspaceExistsError extends Error {
  constructor() {
    super("An institution workspace already exists for this email. Sign in instead.")
    this.name = "InstitutionWorkspaceExistsError"
  }
}

export async function provisionInstitutionWorkspace(input: {
  institutionName: string
  contactName: string
  contactEmail: string
  password: string
  domain?: string | null
  institutionType?: string | null
  desiredPlan?: string | null
  requestKind?: "demo" | "quote" | "pilot"
}): Promise<{ institutionId: number; accountId: number; createdRequest: boolean; requestId: number | null }> {
  await ensureInstitutionSchema()
  const email = input.contactEmail.trim().toLowerCase()
  const institutionName = input.institutionName.trim()
  const contactName = input.contactName.trim()
  if (!email.includes("@") || !institutionName || !contactName) {
    throw new Error("Institution name, contact name, and work email are required")
  }
  if (input.password.length < 10) {
    throw new Error("Password must be at least 10 characters")
  }

  const existing = (await sql`
    SELECT id FROM institution_admin_accounts WHERE LOWER(email) = ${email} LIMIT 1
  `) as { id: number }[]
  if (existing[0]) throw new InstitutionWorkspaceExistsError()

  const memberHit = (await sql`
    SELECT id FROM institution_members
    WHERE LOWER(email) = ${email} AND status = 'active' AND removed_at IS NULL
    LIMIT 1
  `) as { id: number }[]
  if (memberHit[0]) throw new InstitutionWorkspaceExistsError()

  const domain = input.domain ? String(input.domain).trim().toLowerCase() : null
  const institutionType = input.institutionType ? String(input.institutionType).trim() : "university"
  let institutionId: number | null = null
  for (let i = 0; i < 6; i++) {
    const shortName = prospectShortName(institutionName)
    const slug = prospectSlug(institutionName)
    try {
      const inserted = (await sql`
        INSERT INTO universities (
          name, legal_name, short_name, slug, logo, primary_color, secondary_color, domain,
          authentication_type, is_active, institution_type, status
        ) VALUES (
          ${institutionName}, ${institutionName}, ${shortName}, ${slug}, NULL, '#582c83', '#EAAA00', ${domain},
          'local', false, ${institutionType}, 'prospect'
        )
        RETURNING id
      `) as { id: number }[]
      if (inserted[0]) {
        institutionId = Number(inserted[0].id)
        break
      }
    } catch {
      /* unique short_name / slug collision */
    }
  }
  if (!institutionId) throw new Error("Could not create institution workspace")

  const passwordHash = await hashAdminPassword(input.password)
  const accounts = (await sql`
    INSERT INTO institution_admin_accounts (email, password_hash, name)
    VALUES (${email}, ${passwordHash}, ${contactName})
    RETURNING id
  `) as { id: number }[]
  const accountId = Number(accounts[0]?.id)
  if (!accountId) throw new Error("Could not create institution admin")

  await sql`
    INSERT INTO institution_members (
      institution_id, user_type, user_id, role, status, email, joined_at
    ) VALUES (
      ${institutionId}, 'institution_admin', ${accountId}, 'owner', 'active', ${email}, NOW()
    )
  `

  const linked = (await sql`
    UPDATE institution_access_requests
    SET institution_id = ${institutionId}, updated_at = NOW()
    WHERE LOWER(contact_email) = ${email} AND institution_id IS NULL
    RETURNING id
  `) as { id: number }[]
  let createdRequest = false
  let requestId = linked[0] ? Number(linked[0].id) : null
  const plan = getInstitutionPlan(input.desiredPlan)
  if (plan && linked.length === 0) {
    const kind = input.requestKind ?? (plan.planKey === "course_pilot" ? "pilot" : "demo")
    const inserted = (await sql`
      INSERT INTO institution_access_requests (
        institution_name, domain, institution_type, contact_name, contact_email,
        desired_plan, request_kind, institution_id
      ) VALUES (
        ${institutionName}, ${domain}, ${institutionType}, ${contactName}, ${email},
        ${plan.planKey}, ${kind}, ${institutionId}
      )
      RETURNING id
    `) as { id: number }[]
    createdRequest = true
    requestId = Number(inserted[0]?.id ?? 0) || requestId
  }

  return { institutionId, accountId, createdRequest, requestId }
}
