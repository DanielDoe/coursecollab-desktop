import { sql } from "@/lib/db"
import { getCamperProfile } from "@/lib/summer-camp/camper-profile"
import type { CampModuleBlock } from "@/lib/summer-camp/types"
import {
  getKnowledgeCheckCompletionGaps,
  getModuleCompletionGaps,
  type BlockProgressMap,
  type CompletionGap,
} from "@/lib/summer-camp/module-completion"

async function loadModuleCompletionContext(studentDbId: number, moduleId: number) {
  const blocks = await sql`
    SELECT * FROM camp_module_blocks
    WHERE module_id = ${moduleId}
    ORDER BY sort_order ASC, id ASC
  `

  const progress = await sql`
    SELECT block_id, progress_type, metadata
    FROM camp_progress
    WHERE student_id = ${studentDbId} AND module_id = ${moduleId}
  `

  const submissions = await sql`
    SELECT block_id FROM camp_submissions
    WHERE student_id = ${studentDbId} AND module_id = ${moduleId}
  `

  const progressByBlock = new Map<number, BlockProgressMap>()
  for (const row of progress) {
    if (row.block_id == null) continue
    const blockId = Number(row.block_id)
    const entry = progressByBlock.get(blockId) ?? {}
    entry[String(row.progress_type)] = (row.metadata ?? {}) as Record<string, unknown>
    progressByBlock.set(blockId, entry)
  }

  const completedSteps = new Set(
    progress
      .filter((p) => p.progress_type === "step_complete" && p.block_id != null)
      .map((p) => Number(p.block_id)),
  )

  const submissionByBlock = new Set(submissions.map((s) => Number(s.block_id)))

  const camper = await getCamperProfile(studentDbId)
  const camperProfile = (camper.profile ?? {}) as Record<string, unknown>

  return {
    blocks: blocks as CampModuleBlock[],
    progressByBlock,
    completedSteps,
    submissionByBlock,
    camperProfile,
  }
}

export async function getKnowledgeCheckCompletionGapsForStudent(
  studentDbId: number,
  moduleId: number,
): Promise<CompletionGap[]> {
  const ctx = await loadModuleCompletionContext(studentDbId, moduleId)
  return getKnowledgeCheckCompletionGaps(
    ctx.blocks,
    ctx.progressByBlock,
    ctx.completedSteps,
    ctx.submissionByBlock,
    ctx.camperProfile,
  )
}

export async function getModuleCompletionGapsForStudent(
  studentDbId: number,
  moduleId: number,
): Promise<CompletionGap[]> {
  const ctx = await loadModuleCompletionContext(studentDbId, moduleId)
  return getModuleCompletionGaps(
    ctx.blocks,
    ctx.progressByBlock,
    ctx.completedSteps,
    ctx.submissionByBlock,
    ctx.camperProfile,
  )
}
