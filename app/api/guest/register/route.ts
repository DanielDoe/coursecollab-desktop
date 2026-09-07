import { type NextRequest, NextResponse } from "next/server"
import { submitCareerMemberAccessRequest } from "@/lib/guest/submit-guest-access-request"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function field(form: FormData, ...keys: string[]): string {
  for (const key of keys) {
    const value = form.get(key)
    if (typeof value === "string") return value
  }
  return ""
}

async function payloadFromRequest(request: NextRequest): Promise<
  import("@/lib/guest/create-guest-account").CreateGuestAccountInput & { invitationToken?: string }
> {
  const contentType = request.headers.get("content-type") ?? ""
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData()
    const file = (form.get("resume") ?? form.get("file")) as File | null
    const universityRaw = field(form, "universityId")
    return {
      purpose: field(form, "purpose"),
      purposeNote: field(form, "purposeNote", "purpose_note"),
      email: field(form, "email"),
      password: field(form, "password"),
      firstName: field(form, "firstName"),
      lastName: field(form, "lastName"),
      organization: field(form, "organization"),
      occupation: field(form, "occupation"),
      resumeText: field(form, "resumeText", "parsedText"),
      resumeFileName: file?.name || field(form, "resumeFileName") || undefined,
      resumeFile:
        file && file.size > 0
          ? {
              bytes: Buffer.from(await file.arrayBuffer()),
              fileName: file.name,
              mime: file.type || "application/octet-stream",
            }
          : undefined,
      universityId: universityRaw ? Number(universityRaw) : null,
      invitationToken: field(form, "invitationToken") || undefined,
    }
  }

  const body = await request.json()
  return {
    purpose: String(body.purpose ?? ""),
    purposeNote: String(body.purposeNote ?? body.purpose_note ?? ""),
    email: String(body.email ?? ""),
    password: String(body.password ?? ""),
    firstName: String(body.firstName ?? ""),
    lastName: String(body.lastName ?? ""),
    organization: String(body.organization ?? ""),
    occupation: String(body.occupation ?? ""),
    resumeText: String(body.resumeText ?? body.parsedText ?? ""),
    resumeFileName: String(body.resumeFileName ?? ""),
    universityId: body.universityId != null ? Number(body.universityId) : null,
    invitationToken: body.invitationToken != null ? String(body.invitationToken) : undefined,
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await payloadFromRequest(request)
    const result = await submitCareerMemberAccessRequest({
      ...payload,
      invitationToken: payload.invitationToken ?? null,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    if (result.autoApproved) {
      return NextResponse.json({
        success: true,
        created: true,
        autoApproved: true,
        message: "Career Member account approved. You can sign in now.",
      })
    }

    return NextResponse.json({
      success: true,
      pendingApproval: true,
      requestId: result.requestId,
      message:
        "Access request submitted. Your account will be activated after administrator or sponsoring faculty approval.",
    })
  } catch (e) {
    console.error("[guest/register]", e)
    return NextResponse.json({ error: "Registration failed" }, { status: 500 })
  }
}
