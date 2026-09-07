import { type NextRequest, NextResponse } from "next/server"
import { requireInstitutionAdmin } from "@/lib/institutions/auth"
import { getInstitutionLicenseModule } from "@/lib/institutions/portal/license"
import { withInstitutionPortalContext, requirePortalPermission } from "@/lib/institutions/portal/api-helpers"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response
  if (!requirePortalPermission(auth.session.role, "view_license")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 })
  }
  const module = await getInstitutionLicenseModule(auth.session.institutionId)
  return NextResponse.json(withInstitutionPortalContext(auth.session.role, module))
}
