import { type NextRequest, NextResponse } from "next/server"
import { requireInstitutionAdmin } from "@/lib/institutions/auth"
import { getInstitutionCoursesModule } from "@/lib/institutions/portal/roster"
import { withInstitutionPortalContext, requirePortalPermission } from "@/lib/institutions/portal/api-helpers"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response
  const module = await getInstitutionCoursesModule(auth.session.institutionId)
  return NextResponse.json(
    withInstitutionPortalContext(auth.session.role, {
      ...module,
      canManage: requirePortalPermission(auth.session.role, "manage_courses"),
    }),
  )
}
