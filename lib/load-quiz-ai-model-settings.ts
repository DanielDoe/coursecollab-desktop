/**
 * Load assessment-level AI model settings from a quiz row.
 */
import { sql } from "@/lib/db"
import {
  aiModelSettingsFromQuizRow,
  type AiModelSettings,
} from "@/lib/resolve-ai-model"

export async function loadQuizAiModelSettings(quizId: number | string | null | undefined): Promise<AiModelSettings> {
  if (quizId == null || quizId === "") {
    return { aiModel: "auto" }
  }

  try {
    const rows = await sql`
      SELECT ai_model, ai_model_by_task, ai_enable_opus_fallback, ai_opus_confidence_threshold
      FROM quizzes
      WHERE id = ${quizId}
      LIMIT 1
    `
    const row = (Array.isArray(rows) ? rows[0] : undefined) as
      | {
          ai_model?: string | null
          ai_model_by_task?: unknown
          ai_enable_opus_fallback?: boolean | null
          ai_opus_confidence_threshold?: number | null
        }
      | undefined

    if (!row) return { aiModel: "auto" }
    return aiModelSettingsFromQuizRow(row)
  } catch (err) {
    // Columns may not exist yet if migration hasn't run — fall back to auto routing.
    console.warn("[loadQuizAiModelSettings] Falling back to auto:", (err as Error)?.message)
    return { aiModel: "auto" }
  }
}
