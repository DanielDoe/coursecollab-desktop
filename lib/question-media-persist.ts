import { isCircuitQuestionType } from "@/lib/engineering-circuit-types"
import { sql } from "@/lib/db"
import {
  parseQuestionMedia,
  questionMediaToJsonString,
  syncCircuitSpecDiagramFromMedia,
} from "@/lib/question-media"

export function circuitSpecToJsonString(q: { circuit_spec?: unknown }): string | null {
  const raw = q?.circuit_spec
  if (raw == null || raw === "") return null
  if (typeof raw === "string") {
    try {
      JSON.parse(raw)
      return raw
    } catch {
      return null
    }
  }
  try {
    return JSON.stringify(raw)
  } catch {
    return null
  }
}

/** JSON strings for `question_media` and `circuit_spec` columns (syncs diagram into circuit_spec when needed). */
export function serializeQuestionMediaAndCircuitSpec(q: {
  question_media?: unknown
  circuit_spec?: unknown
  question_type?: string | null
}): { questionMediaJson: string | null; circuitSpecJson: string | null } {
  const media = parseQuestionMedia(q.question_media)
  const questionMediaJson = questionMediaToJsonString(media)

  let circuitSpecJson = circuitSpecToJsonString(q)
  if (isCircuitQuestionType(q.question_type)) {
    const synced = syncCircuitSpecDiagramFromMedia(q.circuit_spec, media)
    circuitSpecJson = circuitSpecToJsonString({ circuit_spec: synced })
  }

  return { questionMediaJson, circuitSpecJson }
}

/** Push bank diagram/media onto quiz copies linked by `bank_question_id`. Skips rows with their own active media. */
export async function propagateBankQuestionMediaToQuizQuestions(
  bankQuestionId: number,
  mediaJson: string | null,
): Promise<number> {
  if (!mediaJson) return 0
  const rows = await sql`
    UPDATE quiz_questions qq
    SET question_media = ${mediaJson}::jsonb
    WHERE qq.bank_question_id = ${bankQuestionId}
      AND (
        qq.question_media IS NULL
        OR COALESCE(qq.question_media->>'media_url', '') = ''
        OR COALESCE((qq.question_media->>'media_enabled')::boolean, false) = false
      )
    RETURNING id
  `
  return rows.length
}
