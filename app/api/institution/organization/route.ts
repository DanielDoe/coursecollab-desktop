import { type NextRequest, NextResponse } from "next/server"
import { requireInstitutionAdmin } from "@/lib/institutions/auth"
import {
  getInstitutionOrganizationModule,
  getOrganizationUnitDetail,
} from "@/lib/institutions/portal/organization"
import { withInstitutionPortalContext, requirePortalPermission } from "@/lib/institutions/portal/api-helpers"
import { sql } from "@/lib/db"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response
  const unitId = Number(new URL(request.url).searchParams.get("unitId"))
  if (Number.isFinite(unitId) && unitId > 0) {
    const detail = await getOrganizationUnitDetail(auth.session.institutionId, unitId)
    if (!detail) return NextResponse.json({ error: "Unit not found" }, { status: 404 })
    return NextResponse.json(withInstitutionPortalContext(auth.session.role, { unit: detail }))
  }
  const module = await getInstitutionOrganizationModule(auth.session.institutionId)
  return NextResponse.json(withInstitutionPortalContext(auth.session.role, module))
}

export async function POST(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response
  if (!requirePortalPermission(auth.session.role, "manage_organization")) {
    return NextResponse.json({ error: "Not authorized to edit organization" }, { status: 403 })
  }
  await ensureInstitutionSchema()
  const body = await request.json().catch(() => ({}))
  const name = String(body.name ?? "").trim()
  const unitType = String(body.unitType ?? "department").trim()
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 })
  const rows = await sql`
    INSERT INTO organization_units (institution_id, parent_unit_id, unit_type, name, code)
    VALUES (
      ${auth.session.institutionId},
      ${body.parentUnitId ? Number(body.parentUnitId) : null},
      ${unitType},
      ${name},
      ${body.code ? String(body.code) : null}
    )
    RETURNING id
  `
  return NextResponse.json({ success: true, id: rows[0]?.id })
}
