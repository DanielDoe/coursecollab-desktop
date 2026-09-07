import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import {
  instructorNeedsFacultySetup,
  runFacultyAccountSetup,
} from "@/lib/faculty-account-setup"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireInstructorSession(request)
    if (!auth.ok) return auth.response
    const needsSetup = await instructorNeedsFacultySetup(auth.instructorId)
    return NextResponse.json({ needsSetup })
  } catch (e) {
    console.error("[faculty/account-setup GET]", e)
    return NextResponse.json({ error: "Failed to read setup status" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireInstructorSession(request)
    if (!auth.ok) return auth.response
    const result = await runFacultyAccountSetup(auth.instructorId)
    if (!result.complete) {
      return NextResponse.json(
        { success: false, ...result },
        { status: result.error ? 400 : 200 },
      )
    }
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    console.error("[faculty/account-setup POST]", e)
    return NextResponse.json({ error: "Setup failed" }, { status: 500 })
  }
}
