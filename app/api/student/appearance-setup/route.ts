import { type NextRequest, NextResponse } from "next/server"
import {
  APPEARANCE_SETUP_MODULE,
  isAppearanceSetupCompleted,
  markAppearanceSetupCompleted,
} from "@/lib/appearance/appearance-setup-server"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("studentId")
    const auth = await requireStudentIdParamMatchesCaller(request, studentId)
    if (!auth.ok) return auth.response

    const completed = await isAppearanceSetupCompleted(auth.studentDbId)
    return NextResponse.json({ completed, module: APPEARANCE_SETUP_MODULE })
  } catch (error) {
    console.error("[student/appearance-setup GET]", error)
    return NextResponse.json({ error: "Failed to load appearance setup status" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await requireStudentIdParamMatchesCaller(request, body.studentId ?? null)
    if (!auth.ok) return auth.response

    await markAppearanceSetupCompleted(auth.studentDbId)
    return NextResponse.json({ success: true, completed: true })
  } catch (error) {
    console.error("[student/appearance-setup POST]", error)
    return NextResponse.json({ error: "Failed to save appearance setup" }, { status: 500 })
  }
}
