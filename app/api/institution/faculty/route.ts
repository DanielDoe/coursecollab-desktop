import { type NextRequest, NextResponse } from "next/server"
import { canManageFaculty, requireInstitutionAdmin } from "@/lib/institutions/auth"
import { inviteInstitutionInstructor, removeInstitutionSponsorship } from "@/lib/institutions/members"
import { getInstitutionFacultyModule } from "@/lib/institutions/portal/roster"
import { withInstitutionPortalContext, requirePortalPermission } from "@/lib/institutions/portal/api-helpers"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response
  const module = await getInstitutionFacultyModule(auth.session.institutionId)
  return NextResponse.json(
    withInstitutionPortalContext(auth.session.role, {
      ...module,
      canManage: requirePortalPermission(auth.session.role, "manage_faculty"),
    }),
  )
}

export async function POST(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response
  if (!canManageFaculty(auth.session.role)) {
    return NextResponse.json({ error: "Not authorized to manage faculty" }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const email = String(body.email ?? "")
  try {
    const result = await inviteInstitutionInstructor({
      institutionId: auth.session.institutionId,
      email,
      role: String(body.role ?? "faculty"),
      invitedBy: auth.session.userId,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invite failed"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response
  if (!canManageFaculty(auth.session.role)) {
    return NextResponse.json({ error: "Not authorized to manage faculty" }, { status: 403 })
  }
  const memberId = Number(new URL(request.url).searchParams.get("memberId"))
  if (!Number.isFinite(memberId)) {
    return NextResponse.json({ error: "memberId required" }, { status: 400 })
  }
  await removeInstitutionSponsorship({
    institutionId: auth.session.institutionId,
    memberId,
    actorUserId: auth.session.userId,
  })
  return NextResponse.json({ success: true })
}
