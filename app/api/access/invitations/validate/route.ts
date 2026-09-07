import { type NextRequest, NextResponse } from "next/server"
import { validateAccessInvitation } from "@/lib/access-governance/invitations"

export const dynamic = "force-dynamic"

/** Public invitation validation — returns scope metadata, never the token hash. */
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()
    if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 })

    const result = await validateAccessInvitation(String(token))
    if (!result.ok) {
      return NextResponse.json({ valid: false, error: result.reason }, { status: 400 })
    }

    return NextResponse.json({
      valid: true,
      allowedAccountType: result.invitation.allowedAccountType,
      approvalBehavior: result.invitation.approvalBehavior,
      scopeType: result.invitation.scopeType,
      courseId: result.invitation.courseId,
      sessionId: result.invitation.sessionId,
      campId: result.invitation.campId,
    })
  } catch {
    return NextResponse.json({ error: "Validation failed" }, { status: 500 })
  }
}
