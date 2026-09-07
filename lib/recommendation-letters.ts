import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { getEffectiveMembershipTier, type MembershipTier } from "@/lib/membership"

export type { LetterTone, RecommendationPurpose, RecommendationStatus } from "./recommendation-letters-shared"
export {
  purposeLabel,
  RECOMMENDATION_PURPOSES,
  RECOMMENDATION_STATUSES,
  TONE_OPTIONS,
} from "./recommendation-letters-shared"

export async function getActiveSemesterKey(): Promise<string | null> {
  try {
    const rows = sqlRows<{ year: number; term: string }>(
      await sql`
      SELECT year, term FROM academic_terms
      WHERE is_active = true
      ORDER BY year DESC,
        CASE term
          WHEN 'Spring' THEN 1
          WHEN 'Summer' THEN 2
          WHEN 'Fall' THEN 3
          WHEN 'Winter' THEN 4
        END DESC
      LIMIT 1
    `,
    )
    if (rows.length === 0) return null
    const y = rows[0].year
    const t = String(rows[0].term ?? "")
      .toLowerCase()
      .replace(/\s+/g, "_")
    return `${y}-${t}`
  } catch {
    return null
  }
}

export async function logRecommendationAudit(input: {
  requestId: number | null
  actorType: "student" | "instructor" | "system"
  actorId: number | null
  action: string
  details?: Record<string, unknown>
}) {
  try {
    await sql`
      INSERT INTO recommendation_audit_log (request_id, actor_type, actor_id, action, details)
      VALUES (
        ${input.requestId},
        ${input.actorType},
        ${input.actorId},
        ${input.action},
        ${JSON.stringify(input.details ?? {})}::jsonb
      )
    `
  } catch (e) {
    console.warn("[recommendation-letters] audit log failed", e)
  }
}

export async function ensureInstructorRecommendationSettings(instructorId: number) {
  const existing = sqlRows(
    await sql`
    SELECT instructor_id FROM recommendation_settings WHERE instructor_id = ${instructorId}
  `,
  )
  if (existing.length > 0) return
  await sql`
    INSERT INTO recommendation_settings (instructor_id)
    VALUES (${instructorId})
    ON CONFLICT (instructor_id) DO NOTHING
  `
}

export type RecommendationSettingsRow = {
  instructor_id: number
  enabled: boolean
  max_requests_per_semester: number
  minimum_notice_days: number
  require_resume: boolean
  require_transcript: boolean
  require_purpose_deadline: boolean
  require_final_review: boolean
  allow_ai_generation: boolean
  allow_ai_polish: boolean
  max_ai_batches_per_request: number
  default_tone: string
  signature_block: string | null
  template_style: string
  extra_instructions: string | null
  letterhead_logo_url?: string | null
  letterhead_signature_image_url?: string | null
  letterhead_instructor_title?: string | null
  letterhead_instructor_email?: string | null
  letterhead_instructor_phone?: string | null
  letterhead_instructor_office?: string | null
  letterhead_signatory_name?: string | null
  letterhead_logo_scale?: number | null
  letterhead_signature_scale?: number | null
  letterhead_body_font_scale?: number | null
  letterhead_body_text_align?: string | null
  letterhead_header_font_scale?: number | null
  letterhead_header_text_align?: string | null
  letterhead_header_logo_text_gap_px?: number | null
  letterhead_content_margin?: string | null
}

export async function getStudentTierForRec(studentId: number): Promise<MembershipTier> {
  return getEffectiveMembershipTier(studentId)
}

/**
 * Whether the student may run AI draft generation for this request batch.
 * Scholar: only if instructor allows AI generation (allow_ai_generation).
 * Explorer: one batch (three variants) per approved request unless instructor raises max_ai_batches_per_request.
 * Trailblazer: up to max_ai_batches_per_request (default 3).
 */
export async function canGenerateAiDrafts(input: {
  studentId: number
  tier: MembershipTier
  settings: RecommendationSettingsRow
  currentBatchCount: number
}): Promise<{ ok: boolean; reason?: string }> {
  if (!input.settings.allow_ai_generation) {
    return { ok: false, reason: "Your instructor has disabled AI-generated drafts for this course." }
  }

  const maxBatches = Math.max(1, Number(input.settings.max_ai_batches_per_request) || 1)

  if (input.tier === "Trailblazer") {
    if (input.currentBatchCount >= maxBatches) {
      return { ok: false, reason: "You have reached the maximum number of AI generation runs for this request." }
    }
    return { ok: true }
  }

  if (input.tier === "Explorer") {
    if (input.currentBatchCount >= 1) {
      return { ok: false, reason: "Explorer includes one AI draft generation per request. Upgrade to Trailblazer for additional runs." }
    }
    if (maxBatches < 1) {
      return { ok: false, reason: "AI drafts are not available for this instructor’s settings." }
    }
    return { ok: true }
  }

  // Scholar (free)
  if (input.settings.allow_ai_generation) {
    if (input.currentBatchCount >= 1) {
      return { ok: false, reason: "Free accounts may generate one AI draft set when your instructor allows AI. Upgrade for more." }
    }
    return { ok: true }
  }

  return { ok: false, reason: "Upgrade or ask your instructor to enable AI drafts." }
}

export function canUseAiPolish(tier: MembershipTier, settings: RecommendationSettingsRow): boolean {
  if (!settings.allow_ai_polish) return false
  return tier === "Trailblazer"
}
