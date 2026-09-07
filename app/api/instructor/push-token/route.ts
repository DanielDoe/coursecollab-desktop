import { type NextRequest, NextResponse } from "next/server"
import { registerExpoPushToken, unregisterExpoPushToken } from "@/lib/push-notifications"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function parseInstructorId(request: NextRequest): number | null {
  const raw = request.headers.get("x-instructor-id")
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export async function POST(request: NextRequest) {
  try {
    const instructorId = parseInstructorId(request)
    if (instructorId == null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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
      ownerKind: "instructor",
      ownerId: instructorId,
      expoPushToken: token,
      platform: body.platform ?? null,
      device: body.device ?? null,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[instructor/push-token POST]", error)
    return NextResponse.json({ error: "Failed to register push token" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const instructorId = parseInstructorId(request)
    if (instructorId == null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let expoPushToken: string | undefined
    try {
      const body = (await request.json()) as { expo_push_token?: string }
      expoPushToken = body.expo_push_token?.trim()
    } catch {
      expoPushToken = undefined
    }

    await unregisterExpoPushToken({
      ownerKind: "instructor",
      ownerId: instructorId,
      expoPushToken,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[instructor/push-token DELETE]", error)
    return NextResponse.json({ error: "Failed to unregister push token" }, { status: 500 })
  }
}
