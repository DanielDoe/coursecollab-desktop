import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireBoundSummerCamper } from "@/lib/require-summer-camper"
import { isStudentEnrolledInTraining, getModuleTrainingId } from "@/lib/summer-camp/permissions"
import { awardModuleCompletion } from "@/lib/summer-camp/camper-profile"
import { syncCampCamperXp } from "@/lib/summer-camp/camp-xp"
import { getNextCurriculumModule } from "@/lib/summer-camp/training-modules"
import { getKnowledgeCheckCompletionGapsForStudent } from "@/lib/summer-camp/module-completion-server"
export const dynamic = "force-dynamic"

const BLOCK_PROGRESS_TYPES = new Set([
  "step_complete",
  "section_complete",
  "reflection",
  "feedback",
  "engagement",
  "quiz_response",
  "confidence",
])

type ProgressType =
  | "module_complete"
  | "step_complete"
  | "section_complete"
  | "reflection"
  | "feedback"
  | "engagement"
  | "quiz_response"
  | "confidence"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { moduleId, blockId, progressType, metadata } = body


    const camper = await requireBoundSummerCamper(request)
    if (!camper.ok) return camper.response
    const studentDbId = camper.studentDbId

    const modId = Number(moduleId)
    if (!Number.isFinite(modId)) {
      return NextResponse.json({ error: "moduleId is required" }, { status: 400 })
    }

    const type = String(progressType ?? "step_complete") as ProgressType
    const trainingId = await getModuleTrainingId(modId)
    if (trainingId == null) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 })
    }

    const enrolled = await isStudentEnrolledInTraining(studentDbId, trainingId)
    if (!enrolled) {
      return NextResponse.json({ error: "Not enrolled" }, { status: 403 })
    }

    const enrollmentRows = await sql`
      SELECT id FROM camp_enrollments
      WHERE student_id = ${studentDbId} AND training_id = ${trainingId} AND status = 'active'
      LIMIT 1
    `
    const enrollmentId = enrollmentRows[0]?.id as number | undefined
    if (!enrollmentId) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 })
    }

    const blkId = blockId != null ? Number(blockId) : null
    const meta = metadata && typeof metadata === "object" ? metadata : {}

    if (type === "module_complete") {
      const existing = await sql`
        SELECT id FROM camp_progress
        WHERE student_id = ${studentDbId} AND module_id = ${modId} AND progress_type = 'module_complete'
        LIMIT 1
      `
      if (existing.length > 0) {
        return NextResponse.json({ progress: existing[0], alreadyComplete: true })
      }

      const knowledgeCheckGaps = await getKnowledgeCheckCompletionGapsForStudent(studentDbId, modId)
      if (knowledgeCheckGaps.length > 0) {
        return NextResponse.json(
          {
            error: "Complete all knowledge check questions before marking this module done.",
            gaps: knowledgeCheckGaps,
          },
          { status: 400 },
        )
      }

      const inserted = await sql`
        INSERT INTO camp_progress (enrollment_id, student_id, module_id, block_id, progress_type, metadata)
        VALUES (${enrollmentId}, ${studentDbId}, ${modId}, NULL, 'module_complete', ${JSON.stringify(meta)}::jsonb)
        RETURNING *
      `

      const modRows = await sql`
        SELECT sort_order, title FROM camp_modules WHERE id = ${modId} LIMIT 1
      `
      const sortOrder = Number(modRows[0]?.sort_order ?? -1)
      const badgeIds: string[] = []
      let nextModule: string | undefined
      if (sortOrder === 0) {
        badgeIds.push("welcome-badge", "camp-explorer", "first-module")
        nextModule = "Module 1 — What is Artificial Intelligence?"
      } else if (sortOrder === 1) {
        badgeIds.push("ai-explorer")
        nextModule = "Module 2 — Machine Learning and Deep Learning"
      } else if (sortOrder === 2) {
        badgeIds.push("ml-explorer")
        nextModule = "Module 3 — Computer Vision & Image Understanding"
      } else if (sortOrder === 3) {
        badgeIds.push("cv-explorer")
        nextModule = "Module 4 — Internet of Things (IoT)"
      } else if (sortOrder === 4) {
        badgeIds.push("iot-explorer")
        nextModule = "Module 5 — Edge Computing"
      } else if (sortOrder === 5) {
        badgeIds.push("edge-explorer")
        nextModule = "Module 6 — AI at the Edge"
      } else if (sortOrder === 6) {
        badgeIds.push("edge-ai-explorer")
        nextModule = "Module 7 — Meet the Raspberry Pi"
      } else if (sortOrder === 7) {
        badgeIds.push("pi-explorer")
        nextModule = "Module 8 — Setting Up Your Raspberry Pi"
      } else if (sortOrder === 8) {
        badgeIds.push("edge-device-builder", "hardware-setup-cert")
        nextModule = "Module 9 — OpenCV Setup & Computer Vision Environment"
      } else if (sortOrder === 9) {
        badgeIds.push("opencv-explorer")
        nextModule = "Module 10 — Running Your First Face & Eye Detection System"
      } else if (sortOrder === 10) {
        badgeIds.push("edge-vision-explorer", "first-cv-deployment-cert")
        nextModule = "Module 11 — Final Project Showcase"
      } else if (sortOrder === 11) {
        badgeIds.push("edge-ai-engineer", "camp-certificate-2026")
      }

      const rewards = await awardModuleCompletion(studentDbId, sortOrder, badgeIds)
      const nextLesson = await getNextCurriculumModule(trainingId, modId)

      return NextResponse.json({
        progress: inserted[0],
        rewards: {
          xp: rewards.xpAwarded,
          totalXp: rewards.totalXp,
          badges: rewards.badges,
          nextModule: nextLesson?.title ?? nextModule,
          nextLesson,
        },
      })
    }

    if (type === "engagement" && blkId == null) {
      const existing = await sql`
        SELECT id FROM camp_progress
        WHERE student_id = ${studentDbId}
          AND module_id = ${modId}
          AND progress_type = 'engagement'
          AND block_id IS NULL
        LIMIT 1
      `
      if (existing.length > 0) {
        const updated = await sql`
          UPDATE camp_progress
          SET metadata = ${JSON.stringify(meta)}::jsonb, completed_at = NOW()
          WHERE id = ${existing[0].id}
          RETURNING *
        `
        return NextResponse.json({ progress: updated[0], updated: true })
      }
      const inserted = await sql`
        INSERT INTO camp_progress (enrollment_id, student_id, module_id, block_id, progress_type, metadata)
        VALUES (${enrollmentId}, ${studentDbId}, ${modId}, NULL, 'engagement', ${JSON.stringify(meta)}::jsonb)
        RETURNING *
      `
      return NextResponse.json({ progress: inserted[0] })
    }

    if (blkId == null || !BLOCK_PROGRESS_TYPES.has(type)) {
      return NextResponse.json({ error: "Invalid progress request" }, { status: 400 })
    }

    const existing = await sql`
      SELECT id FROM camp_progress
      WHERE student_id = ${studentDbId} AND block_id = ${blkId} AND progress_type = ${type}
      LIMIT 1
    `

    if (existing.length > 0) {
      const updated = await sql`
        UPDATE camp_progress
        SET metadata = ${JSON.stringify(meta)}::jsonb, completed_at = NOW()
        WHERE id = ${existing[0].id}
        RETURNING *
      `
      const xpState = await syncCampCamperXp(studentDbId)
      return NextResponse.json({ progress: updated[0], updated: true, totalXp: xpState.total_xp })
    }

    const inserted = await sql`
      INSERT INTO camp_progress (enrollment_id, student_id, module_id, block_id, progress_type, metadata)
      VALUES (${enrollmentId}, ${studentDbId}, ${modId}, ${blkId}, ${type}, ${JSON.stringify(meta)}::jsonb)
      RETURNING *
    `
    const xpState = await syncCampCamperXp(studentDbId)
    return NextResponse.json({ progress: inserted[0], totalXp: xpState.total_xp })
  } catch (error) {
    console.error("[summer-camp/progress]", error)
    return NextResponse.json({ error: "Failed to save progress" }, { status: 500 })
  }
}
