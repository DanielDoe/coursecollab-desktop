import { type NextRequest, NextResponse } from "next/server"
import { requireInstitutionAdmin } from "@/lib/institutions/auth"
import { getInstitutionSettingsModule, updateInstitutionGeneral } from "@/lib/institutions/portal/billing"
import { withInstitutionPortalContext, requirePortalPermission } from "@/lib/institutions/portal/api-helpers"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response
  if (!requirePortalPermission(auth.session.role, "manage_settings")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 })
  }
  const module = await getInstitutionSettingsModule(auth.session.institutionId)
  return NextResponse.json(
    withInstitutionPortalContext(auth.session.role, {
      ...module,
      canManageAdmins: requirePortalPermission(auth.session.role, "manage_admins"),
    }),
  )
}

export async function PATCH(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response
  if (!requirePortalPermission(auth.session.role, "manage_settings")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  if (body.section === "general") {
    await updateInstitutionGeneral(
      auth.session.institutionId,
      { website: body.website ? String(body.website) : undefined },
      auth.session.userId,
    )
    const module = await getInstitutionSettingsModule(auth.session.institutionId)
    return NextResponse.json(withInstitutionPortalContext(auth.session.role, module))
  }
  return NextResponse.json({ error: "Unsupported section" }, { status: 400 })
}
