import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { ensureInstructorRecommendationSettings, logRecommendationAudit } from "@/lib/recommendation-letters"
import {
  clampLetterheadImageScale,
  clampLetterheadBodyFontScale,
  clampLetterheadHeaderFontScale,
  parseLetterheadBodyTextAlign,
  parseLetterheadHeaderTextAlign,
  clampLetterheadLogoTextGapPx,
} from "@/lib/recommendation-letterhead-signatory"
import { parseLetterheadContentMargin } from "@/lib/recommendation-letterhead-margin"
import { requireInstructorSession } from "@/lib/instructor-session-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response
    const id = session.instructorId
    await ensureInstructorRecommendationSettings(id)
    const rows = sqlRows(await sql`SELECT * FROM recommendation_settings WHERE instructor_id = ${id} LIMIT 1`)
    return NextResponse.json({ settings: rows[0] ?? null })
  } catch (e) {
    console.error("[instructor rec settings get]", e)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response
    const id = session.instructorId
    const body = await request.json()
    await ensureInstructorRecommendationSettings(id)

    const curRows = sqlRows(await sql`SELECT * FROM recommendation_settings WHERE instructor_id = ${id} LIMIT 1`)
    const cur = (curRows[0] ?? {}) as Record<string, unknown>
    const merged = { ...cur, ...body, instructor_id: id }

    const optStr = (v: unknown): string | null => {
      if (v == null) return null
      const s = String(v).trim()
      return s || null
    }

    await sql`
      UPDATE recommendation_settings SET
        enabled = ${Boolean(merged.enabled)},
        max_requests_per_semester = ${Number(merged.max_requests_per_semester) || 3},
        minimum_notice_days = ${Number(merged.minimum_notice_days) || 7},
        require_resume = ${Boolean(merged.require_resume)},
        require_transcript = ${Boolean(merged.require_transcript)},
        require_purpose_deadline = ${merged.require_purpose_deadline !== false},
        require_final_review = ${Boolean(merged.require_final_review)},
        allow_ai_generation = ${merged.allow_ai_generation !== false},
        allow_ai_polish = ${merged.allow_ai_polish !== false},
        max_ai_batches_per_request = ${Math.max(1, Number(merged.max_ai_batches_per_request) || 3)},
        default_tone = ${String(merged.default_tone || "professional")},
        signature_block = ${merged.signature_block != null ? String(merged.signature_block) : null},
        template_style = ${String(merged.template_style || "pvamu")},
        extra_instructions = ${merged.extra_instructions != null ? String(merged.extra_instructions) : null},
        letterhead_logo_url = ${optStr(merged.letterhead_logo_url)},
        letterhead_signature_image_url = ${optStr(merged.letterhead_signature_image_url)},
        letterhead_instructor_title = ${optStr(merged.letterhead_instructor_title)},
        letterhead_instructor_email = ${optStr(merged.letterhead_instructor_email)},
        letterhead_instructor_phone = ${optStr(merged.letterhead_instructor_phone)},
        letterhead_instructor_office = ${optStr(merged.letterhead_instructor_office)},
        letterhead_signatory_name = ${optStr(merged.letterhead_signatory_name)},
        letterhead_logo_scale = ${clampLetterheadImageScale(merged.letterhead_logo_scale, 1)},
        letterhead_signature_scale = ${clampLetterheadImageScale(merged.letterhead_signature_scale, 1)},
        letterhead_body_font_scale = ${clampLetterheadBodyFontScale(merged.letterhead_body_font_scale, 1)},
        letterhead_body_text_align = ${parseLetterheadBodyTextAlign(merged.letterhead_body_text_align)},
        letterhead_header_font_scale = ${clampLetterheadHeaderFontScale(merged.letterhead_header_font_scale)},
        letterhead_header_text_align = ${parseLetterheadHeaderTextAlign(merged.letterhead_header_text_align)},
        letterhead_header_logo_text_gap_px = ${clampLetterheadLogoTextGapPx(merged.letterhead_header_logo_text_gap_px)},
        letterhead_content_margin = ${parseLetterheadContentMargin(merged.letterhead_content_margin)},
        updated_at = NOW()
      WHERE instructor_id = ${id}
    `

    await logRecommendationAudit({
      requestId: null,
      actorType: "instructor",
      actorId: id,
      action: "settings_updated",
      details: body,
    })

    const rows = sqlRows(await sql`SELECT * FROM recommendation_settings WHERE instructor_id = ${id} LIMIT 1`)
    return NextResponse.json({ settings: rows[0] })
  } catch (e) {
    console.error("[instructor rec settings patch]", e)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
