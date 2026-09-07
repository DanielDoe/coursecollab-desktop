import { type NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { registerExpoPushToken, unregisterExpoPushToken } from "@/lib/push-notifications"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    const internalStudentId = auth.studentDbId

    const body = (await request.json()) as {
      expo_push_token?: string
      platform?: string
      device?: string
    }

    const token = body.expo_push_token?.trim()
    if (!token) {
      return NextResponse.json({ error: "expo_push_token is required" }, { status: 400 })
    }

    await registerExpoPushToken({
      ownerKind: "student",
      ownerId: internalStudentId,
      expoPushToken: token,
      platform: body.platform ?? null,
      device: body.device ?? null,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[student/push-token POST]", error)
    return NextResponse.json({ error: "Failed to register push token" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    const internalStudentId = auth.studentDbId

    let expoPushToken: string | undefined
    try {
      const body = (await request.json()) as { expo_push_token?: string }
      expoPushToken = body.expo_push_token?.trim()
    } catch {
      expoPushToken = undefined
    }

    await unregisterExpoPushToken({
      ownerKind: "student",
      ownerId: internalStudentId,
      expoPushToken,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[student/push-token DELETE]", error)
    return NextResponse.json({ error: "Failed to unregister push token" }, { status: 500 })
  }
}
