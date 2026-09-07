import { sql } from "@/lib/db"
export type { ClassroomPointAiFeedbackPayload } from "@/lib/classroom-points-ai-feedback.shared"
export {
  parseAiFeedbackFromReason,
  stripAiSuffixFromReason,
  upsertReasonWithAiFeedback,
  classroomPointHasAiFeedback,
  resolveClassroomPointFeedbackText,
} from "@/lib/classroom-points-ai-feedback.shared"

import type { ClassroomPointAiFeedbackPayload } from "@/lib/classroom-points-ai-feedback.shared"

export async function ensureClassroomPointsAiFeedbackColumn(): Promise<void> {
  try {
    await sql`ALTER TABLE classroom_points ADD COLUMN IF NOT EXISTS ai_feedback JSONB`
  } catch {
    /* non-fatal */
  }
}

export async function saveClassroomPointAiFeedback(opts: {
  classroomPointId: number
  reason: string
  aiFeedback: ClassroomPointAiFeedbackPayload
}): Promise<void> {
  await ensureClassroomPointsAiFeedbackColumn()
  await sql`
    UPDATE classroom_points
    SET
      reason = ${opts.reason},
      ai_feedback = ${JSON.stringify(opts.aiFeedback)}::jsonb
    WHERE id = ${opts.classroomPointId}
  `
}
