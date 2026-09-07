import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireBoundSummerCamper } from "@/lib/require-summer-camper"
import { isStudentEnrolledInTraining, getModuleTrainingId } from "@/lib/summer-camp/permissions"
import { assertCapstoneAccess } from "@/lib/summer-camp/curriculum-progress"
import { getNextCurriculumModule } from "@/lib/summer-camp/training-modules"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> },
) {
  try {
    const { moduleId: moduleIdRaw } = await params
    const moduleId = Number.parseInt(moduleIdRaw, 10)
    if (!Number.isFinite(moduleId)) {
      return NextResponse.json({ error: "Invalid module ID" }, { status: 400 })
    }



    const camper = await requireBoundSummerCamper(request)
    if (!camper.ok) return camper.response
    const studentDbId = camper.studentDbId

    const trainingId = await getModuleTrainingId(moduleId)
    if (trainingId == null) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 })
    }

    const enrolled = await isStudentEnrolledInTraining(studentDbId, trainingId)
    if (!enrolled) {
      return NextResponse.json({ error: "Not enrolled in this training" }, { status: 403 })
    }

    const capstoneGate = await assertCapstoneAccess(moduleId, studentDbId)
    if (!capstoneGate.ok) {
      return NextResponse.json(
        {
          error: capstoneGate.message,
          curriculum_locked: true,
          curriculum: capstoneGate.curriculum,
        },
        { status: 403 },
      )
    }

    const moduleRows = await sql`
      SELECT m.*, p.title AS project_title, p.metadata AS project_metadata,
             t.title AS training_title, t.id AS training_id, t.slug AS training_slug
      FROM camp_modules m
      JOIN camp_projects p ON p.id = m.project_id
      JOIN camp_trainings t ON t.id = p.training_id
      WHERE m.id = ${moduleId}
        AND m.status = 'published'
        AND COALESCE(m.is_visible, true) = true
      LIMIT 1
    `
    if (moduleRows.length === 0) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 })
    }

    const blocks = await sql`
      SELECT * FROM camp_module_blocks
      WHERE module_id = ${moduleId}
      ORDER BY sort_order ASC, id ASC
    `

    const progress = await sql`
      SELECT block_id, progress_type, completed_at, metadata
      FROM camp_progress
      WHERE student_id = ${studentDbId} AND module_id = ${moduleId}
    `

    const submissions = await sql`
      SELECT id, block_id, status, grade, feedback, file_url, file_name, submitted_at, reviewed_at
      FROM camp_submissions
      WHERE student_id = ${studentDbId} AND module_id = ${moduleId}
      ORDER BY submitted_at DESC
    `

    const nextLesson = await getNextCurriculumModule(trainingId, moduleId)

    return NextResponse.json({
      module: moduleRows[0],
      blocks,
      progress,
      submissions,
      nextLesson,
    })
  } catch (error) {
    console.error("[summer-camp/modules GET]", error)
    return NextResponse.json({ error: "Failed to load module" }, { status: 500 })
  }
}
