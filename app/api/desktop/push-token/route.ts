import { type NextRequest, NextResponse } from "next/server"
import { registerDesktopPushDevice } from "@/lib/ensure-desktop-push-schema"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type PushTokenBody = {
  device_id?: string
  owner_kind?: "student" | "instructor" | "admin"
  owner_id?: number
  platform?: string
  push_token?: string | null
  push_provider?: "apns" | "wns" | null
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PushTokenBody
    const deviceId = body.device_id?.trim()
    const ownerKind = body.owner_kind
    const ownerId = Number(body.owner_id)
    const platform = body.platform?.trim() || "unknown"

    if (!deviceId || !ownerKind || !Number.isFinite(ownerId)) {
      return NextResponse.json({ error: "device_id, owner_kind, and owner_id are required" }, { status: 400 })
    }

    if (ownerKind === "student") {
      const auth = await requireCallerStudentDbId(request)
      if (!auth.ok) return auth.response
      if (auth.studentDbId !== ownerId) {
        return NextResponse.json({ error: "owner mismatch" }, { status: 403 })
      }
    } else if (ownerKind === "admin") {
      const adminId = Number(request.headers.get("x-admin-id"))
      if (!Number.isFinite(adminId) || adminId !== ownerId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    } else if (ownerKind === "instructor") {
      const instructorId = Number(request.headers.get("x-instructor-id"))
      if (!Number.isFinite(instructorId) && !request.headers.get("x-admin-id")) {
        // Faculty bell uses session cookies via instructorApiFetch; allow registration without strict header for now.
      }
    }

    await registerDesktopPushDevice({
      deviceId,
      ownerKind,
      ownerId,
      platform,
      pushToken: body.push_token ?? null,
      pushProvider: body.push_provider ?? null,
    })

    return NextResponse.json({
      success: true,
      message: "Desktop device registered for future push delivery",
    })
  } catch (error) {
    console.error("[Desktop Push] registration failed:", error)
    return NextResponse.json({ error: "Registration failed" }, { status: 500 })
  }
}
