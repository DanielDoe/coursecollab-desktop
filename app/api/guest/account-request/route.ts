import { type NextRequest, NextResponse } from "next/server"
import { submitCareerMemberAccessRequest } from "@/lib/guest/submit-guest-access-request"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = await submitCareerMemberAccessRequest({
      purpose: String(body.purpose ?? ""),
      purposeNote: String(body.purposeNote ?? body.purpose_note ?? ""),
      email: String(body.email ?? ""),
      password: String(body.password ?? ""),
      firstName: String(body.firstName ?? ""),
      lastName: String(body.lastName ?? ""),
      organization: String(body.organization ?? ""),
      occupation: String(body.occupation ?? "other"),
      universityId: body.universityId != null ? Number(body.universityId) : null,
      sponsoringFacultyId: body.sponsoringFacultyId != null ? Number(body.sponsoringFacultyId) : null,
      invitationToken: body.invitationToken != null ? String(body.invitationToken) : null,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({
      success: true,
      pendingApproval: !result.autoApproved,
      autoApproved: result.autoApproved,
      message: result.autoApproved
        ? "Career Member account approved. Sign in with the email and password you chose."
        : "Access request submitted. You will be notified when your account is approved.",
    })
  } catch (e) {
    console.error("[guest/account-request]", e)
    return NextResponse.json({ error: "Failed to submit access request" }, { status: 500 })
  }
}
