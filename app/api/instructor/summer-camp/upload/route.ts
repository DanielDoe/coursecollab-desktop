import { type NextRequest, NextResponse } from "next/server"
import { isFacultyAssignedToTraining, requireSummerCampStaff } from "@/lib/summer-camp/permissions"
import { saveCampPublicFile } from "@/lib/summer-camp-storage"
import { getTrainingCampId } from "@/lib/summer-camp/permissions"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const scope = await requireSummerCampStaff(request)
    if (!scope.ok) return scope.response

    const formData = await request.formData()
    const trainingId = Number(formData.get("trainingId"))
    const file = formData.get("file") as File | null

    if (!Number.isFinite(trainingId) || !file) {
      return NextResponse.json({ error: "trainingId and file required" }, { status: 400 })
    }

    const assigned = await isFacultyAssignedToTraining(scope.instructorId, trainingId)
    if (!assigned) {
      return NextResponse.json({ error: "Not assigned" }, { status: 403 })
    }

    const campId = await getTrainingCampId(trainingId)
    if (campId == null) {
      return NextResponse.json({ error: "Camp not found" }, { status: 404 })
    }

    const saved = await saveCampPublicFile(campId, file)
    return NextResponse.json(saved)
  } catch (error) {
    console.error("[instructor/summer-camp/upload]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    )
  }
}
