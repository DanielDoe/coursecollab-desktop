import { type NextRequest, NextResponse } from "next/server"
import { requireInstitutionAdmin } from "@/lib/institutions/auth"
import { getInstitutionInvoicesModule } from "@/lib/institutions/portal/billing"
import { withInstitutionPortalContext, requirePortalPermission } from "@/lib/institutions/portal/api-helpers"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request, { billing: true })
  if (!auth.ok) return auth.response
  if (!requirePortalPermission(auth.session.role, "view_invoices")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 })
  }
  const module = await getInstitutionInvoicesModule(auth.session.institutionId)
  return NextResponse.json(withInstitutionPortalContext(auth.session.role, module))
}
