import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { createAccessInvitation, revokeAccessInvitation } from "@/lib/access-governance/invitations"
import { auditAccessGovernanceEvent } from "@/lib/access-governance/audit"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const body = await request.json()
    const allowedAccountType = body.allowedAccountType === "career_member" ? "career_member" : "student"
    const scopeType = body.scopeType === "section" ? "section" : body.scopeType === "program" ? "program" : "course"

    const { invitationId, token } = await createAccessInvitation({
      createdBy: scope.instructorId,
      universityId: body.universityId != null ? Number(body.universityId) : null,
      scopeType,
      courseId: scope.course.id,
      sessionId: body.sessionId != null ? Number(body.sessionId) : null,
      campId: body.campId != null ? Number(body.campId) : null,
      allowedAccountType,
      approvalBehavior:
        body.approvalBehavior === "auto_approve_verified_invite"
          ? "auto_approve_verified_invite"
          : "require_faculty_approval",
      expiresAt: body.expiresInHours != null ? new Date(Date.now() + Number(body.expiresInHours) * 3600_000) : null,
      maxUses: body.maxUses != null ? Number(body.maxUses) : 1,
    })

    await auditAccessGovernanceEvent({
      action: "invitation.create",
      actorRole: "faculty",
      actorId: scope.instructorId,
      invitationId,
      accountType: allowedAccountType,
      outcome: "success",
    })

    return NextResponse.json({ success: true, invitationId, token })
  } catch (e) {
    console.error("[instructor/access-invitations]", e)
    return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response
    const id = Number(request.nextUrl.searchParams.get("id"))
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invitation id required" }, { status: 400 })
    }
    await revokeAccessInvitation(id, scope.instructorId)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: "Failed to revoke invitation" }, { status: 500 })
  }
}
