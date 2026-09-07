import { type NextRequest, NextResponse } from "next/server"
import { requireInstitutionAdmin } from "@/lib/institutions/auth"
import { getInstitutionStudentsModule } from "@/lib/institutions/portal/roster"
import { withInstitutionPortalContext, requirePortalPermission } from "@/lib/institutions/portal/api-helpers"
import { INSTITUTION_ACTIVE_LEARNER_DEFINITION } from "@/lib/institutions/active-learner-definition"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response
  const courseId = Number(new URL(request.url).searchParams.get("courseId"))
  const module = await getInstitutionStudentsModule(
    auth.session.institutionId,
    Number.isFinite(courseId) && courseId > 0 ? courseId : null,
  )
  return NextResponse.json(
    withInstitutionPortalContext(auth.session.role, {
      ...module,
      activeLearnerDefinition: INSTITUTION_ACTIVE_LEARNER_DEFINITION,
      canManage: requirePortalPermission(auth.session.role, "manage_students"),
      canViewAcademic: requirePortalPermission(auth.session.role, "view_student_academic"),
    }),
  )
}
