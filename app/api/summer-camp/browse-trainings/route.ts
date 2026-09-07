import { type NextRequest, NextResponse } from "next/server"
import { hubBrowse } from "@/lib/summer-camp/camper-hub"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const caller = await requireCallerStudentDbId(request)
    const studentDbId = caller.ok ? caller.studentDbId : null
    return NextResponse.json(await hubBrowse(studentDbId))
  } catch (error) {
    console.error("[summer-camp/browse-trainings]", error)
    return NextResponse.json({ error: "Failed to load trainings" }, { status: 500 })
  }
}
