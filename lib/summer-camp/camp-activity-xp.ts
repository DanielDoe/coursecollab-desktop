import { sql } from "@/lib/db"
import type { CampModuleBlock } from "@/lib/summer-camp/types"
import { scoreQuizAnswers, xpForQuizScore, type QuizQuestionScoring } from "@/lib/summer-camp/quiz-xp-scoring"

/** XP for non-module activities — keeps leaderboard spread beyond module completion alone. */
export const CAMP_ACTIVITY_XP = {
  checkpointUpload: 20,
  stepComplete: 5,
  reflection: 8,
  feedback: 5,
  confidence: 5,
  activityEngagement: 10,
  interactiveJourney: 12,
  profileForm: 10,
} as const

type ProgressActivityRow = {
  block_id: number | null
  progress_type: string
  metadata: Record<string, unknown> | null
  block_type: string | null
  content: Record<string, unknown> | null
  training_id: number | null
}

function xpForProgressRow(row: ProgressActivityRow): number {
  const meta = row.metadata ?? {}
  const content = row.content ?? {}

  switch (row.progress_type) {
    case "quiz_response": {
      const storedCorrect = Number(meta.correctCount)
      const storedTotal = Number(meta.totalQuestions)
      if (Number.isFinite(storedCorrect) && Number.isFinite(storedTotal) && storedTotal > 0) {
        return xpForQuizScore(storedCorrect, storedTotal)
      }
      const questions = (content.questions as QuizQuestionScoring[] | undefined) ?? []
      const answers = meta.answers as Record<string, unknown> | undefined
      const { correct, total } = scoreQuizAnswers(questions, answers)
      return xpForQuizScore(correct, total)
    }
    case "step_complete":
      return CAMP_ACTIVITY_XP.stepComplete
    case "reflection":
      return CAMP_ACTIVITY_XP.reflection
    case "feedback":
      return CAMP_ACTIVITY_XP.feedback
    case "confidence":
      return CAMP_ACTIVITY_XP.confidence
    case "engagement": {
      if (row.block_type === "interactive" && String(content.variant ?? "") === "start_journey") {
        return CAMP_ACTIVITY_XP.interactiveJourney
      }
      if (row.block_type === "activity") {
        return CAMP_ACTIVITY_XP.activityEngagement
      }
      return 0
    }
    default:
      return 0
  }
}

function xpForProfileFormBlock(block: CampModuleBlock, profile: Record<string, unknown>): number {
  const fields = (block.content.fields as Array<{ key: string }> | undefined) ?? []
  if (fields.length === 0) return 0
  const complete = fields.every((f) => {
    const v = profile[f.key]
    return v != null && String(v).trim() !== ""
  })
  return complete ? CAMP_ACTIVITY_XP.profileForm : 0
}

/** Activity XP from progress rows + checkpoint uploads (optionally scoped to one training). */
export async function computeActivityEngagementXp(
  studentDbId: number,
  trainingId?: number,
): Promise<number> {
  const progressRows = (await sql`
    SELECT
      cp.block_id,
      cp.progress_type,
      cp.metadata,
      b.block_type,
      b.content,
      pr.training_id
    FROM camp_progress cp
    LEFT JOIN camp_module_blocks b ON b.id = cp.block_id
    LEFT JOIN camp_modules m ON m.id = cp.module_id
    LEFT JOIN camp_projects pr ON pr.id = m.project_id
    WHERE cp.student_id = ${studentDbId}
      AND cp.progress_type != 'module_complete'
      AND cp.progress_type != 'section_complete'
  `) as ProgressActivityRow[]

  let total = 0
  for (const row of progressRows) {
    if (trainingId != null && row.training_id != null && Number(row.training_id) !== trainingId) {
      continue
    }
    total += xpForProgressRow(row)
  }

  const submissionRows = (await sql`
    SELECT DISTINCT cs.block_id, pr.training_id
    FROM camp_submissions cs
    JOIN camp_modules m ON m.id = cs.module_id
    JOIN camp_projects pr ON pr.id = m.project_id
    WHERE cs.student_id = ${studentDbId}
  `) as Array<{ block_id: number; training_id: number }>

  for (const row of submissionRows) {
    if (trainingId != null && Number(row.training_id) !== trainingId) continue
    total += CAMP_ACTIVITY_XP.checkpointUpload
  }

  const camperRows = await sql`
    SELECT profile FROM camp_camper_profiles WHERE student_id = ${studentDbId} LIMIT 1
  `
  const profile = ((camperRows[0]?.profile ?? {}) as Record<string, unknown>) ?? {}

  if (trainingId == null) {
    const profileBlocks = (await sql`
      SELECT b.*
      FROM camp_module_blocks b
      JOIN camp_modules m ON m.id = b.module_id
      JOIN camp_projects pr ON pr.id = m.project_id
      WHERE b.block_type = 'profile_form'
    `) as CampModuleBlock[]
    for (const block of profileBlocks) {
      total += xpForProfileFormBlock(block, profile)
    }
  } else {
    const profileBlocks = (await sql`
      SELECT b.*
      FROM camp_module_blocks b
      JOIN camp_modules m ON m.id = b.module_id
      JOIN camp_projects pr ON pr.id = m.project_id
      WHERE b.block_type = 'profile_form' AND pr.training_id = ${trainingId}
    `) as CampModuleBlock[]
    for (const block of profileBlocks) {
      total += xpForProfileFormBlock(block, profile)
    }
  }

  return total
}
