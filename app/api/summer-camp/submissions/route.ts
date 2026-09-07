import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireBoundSummerCamper } from "@/lib/require-summer-camper"
import { isStudentEnrolledInTraining, getModuleTrainingId } from "@/lib/summer-camp/permissions"
import { saveCampSubmissionFile } from "@/lib/summer-camp-storage"
import { syncCampCamperXp } from "@/lib/summer-camp/camp-xp"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const moduleId = Number(formData.get("moduleId"))
    const blockId = Number(formData.get("blockId"))
    const file = formData.get("file") as File | null
    const contentRaw = formData.get("content")


    const camper = await requireBoundSummerCamper(request)
    if (!camper.ok) return camper.response
    const studentDbId = camper.studentDbId

    if (!Number.isFinite(moduleId) || !Number.isFinite(blockId)) {
      return NextResponse.json({ error: "moduleId and blockId are required" }, { status: 400 })
    }

    const trainingId = await getModuleTrainingId(moduleId)
    if (trainingId == null) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 })
    }

    const enrolled = await isStudentEnrolledInTraining(studentDbId, trainingId)
    if (!enrolled) {
      return NextResponse.json({ error: "Not enrolled" }, { status: 403 })
    }

    const blockRows = await sql`
      SELECT id, block_type FROM camp_module_blocks
      WHERE id = ${blockId} AND module_id = ${moduleId} AND block_type = 'checkpoint'
      LIMIT 1
    `
    if (blockRows.length === 0) {
      return NextResponse.json({ error: "Checkpoint block not found" }, { status: 404 })
    }

    const enrollmentRows = await sql`
      SELECT id FROM camp_enrollments
      WHERE student_id = ${studentDbId} AND training_id = ${trainingId} AND status = 'active'
      LIMIT 1
    `
    const enrollmentId = enrollmentRows[0]?.id as number
    if (!enrollmentId) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 })
    }

    let fileUrl: string | null = null
    let fileName: string | null = null
    let content: Record<string, unknown> | null = null

    if (file && file.size > 0) {
      const saved = await saveCampSubmissionFile(studentDbId, moduleId, file)
      fileUrl = saved.url
      fileName = saved.fileName
    } else if (contentRaw) {
      try {
        content = JSON.parse(String(contentRaw)) as Record<string, unknown>
      } catch {
        content = { text: String(contentRaw) }
      }
    } else {
      return NextResponse.json({ error: "File or content is required" }, { status: 400 })
    }

    const inserted = await sql`
      INSERT INTO camp_submissions (
        enrollment_id, student_id, block_id, module_id,
        file_url, file_name, content, status
      )
      VALUES (
        ${enrollmentId}, ${studentDbId}, ${blockId}, ${moduleId},
        ${fileUrl}, ${fileName}, ${content ? JSON.stringify(content) : null}::jsonb, 'submitted'
      )
      RETURNING *
    `

    const xpState = await syncCampCamperXp(studentDbId)

    return NextResponse.json({ submission: inserted[0], totalXp: xpState.total_xp })
  } catch (error) {
    console.error("[summer-camp/submissions]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Submission failed" },
      { status: 500 },
    )
  }
}
