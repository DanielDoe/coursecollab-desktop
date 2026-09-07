import { type NextRequest, NextResponse } from "next/server"
import { requireBoundSummerCamper } from "@/lib/require-summer-camper"
import { isStudentEnrolledInTraining } from "@/lib/summer-camp/permissions"
import { getFacultyForTraining } from "@/lib/summer-camp/camper-hub"
import { getTrainingMeta } from "@/lib/summer-camp/training-catalog"
import { loadPublishedTrainingModules } from "@/lib/summer-camp/training-modules"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trainingId: string }> },
) {
  try {
    const { trainingId: trainingIdRaw } = await params
    const trainingId = Number.parseInt(trainingIdRaw, 10)



    const camper = await requireBoundSummerCamper(request)
    if (!camper.ok) return camper.response
    const studentDbId = camper.studentDbId

    const preview = request.nextUrl.searchParams.get("preview") === "1"
    const enrolled = await isStudentEnrolledInTraining(studentDbId, trainingId)

    if (!enrolled && !preview) {
      return NextResponse.json({ error: "Not enrolled in this training" }, { status: 403 })
    }

    const payload = await loadPublishedTrainingModules(
      trainingId,
      enrolled && !preview ? studentDbId : null,
      { curriculumOnly: true },
    )
    if (!payload) {
      return NextResponse.json({ error: "Training not found" }, { status: 404 })
    }

    const trainingRow = payload.training as { slug?: string }
    const meta = getTrainingMeta(trainingRow.slug ?? "")
    const faculty = await getFacultyForTraining(trainingId)

    return NextResponse.json({
      ...payload,
      meta,
      faculty,
      enrolled,
      preview: preview && !enrolled,
      overview: preview,
    })
  } catch (error) {
    console.error("[summer-camp/training GET]", error)
    return NextResponse.json({ error: "Failed to load training" }, { status: 500 })
  }
}
