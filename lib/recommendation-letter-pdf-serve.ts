import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { ensureInstructorRecommendationSettings } from "@/lib/recommendation-letters"
import { buildRecommendationLetterheadPdf } from "@/lib/recommendation-letters-pdf"
import { normalizeDraftLetterBodyForLetterheadPreview } from "@/lib/recommendation-draft-letter-preview"
import { formatRecommendationReLine, letterPurposeLineDisplay } from "@/lib/recommendation-letters-shared"
import {
  buildRecipientInsideAddressLines,
  recommendationRecipientSalutationName,
} from "@/lib/recommendation-letterhead-recipient"
import {
  resolveLetterheadSignatoryName,
  clampLetterheadImageScale,
  clampLetterheadBodyFontScale,
  clampLetterheadHeaderFontScale,
  parseLetterheadBodyTextAlign,
  parseLetterheadHeaderTextAlign,
  clampLetterheadLogoTextGapPx,
} from "@/lib/recommendation-letterhead-signatory"
import { parseLetterheadContentMargin } from "@/lib/recommendation-letterhead-margin"

type LetterheadSettings = {
  letterhead_logo_url: string | null
  letterhead_signature_image_url: string | null
  letterhead_instructor_title: string | null
  letterhead_instructor_email: string | null
  letterhead_instructor_phone: string | null
  letterhead_instructor_office: string | null
  letterhead_signatory_name: string | null
  signature_block: string | null
  letterhead_logo_scale: number | null
  letterhead_signature_scale: number | null
  letterhead_body_font_scale: number | null
  letterhead_body_text_align: string | null
  letterhead_header_font_scale: number | null
  letterhead_header_text_align: string | null
  letterhead_header_logo_text_gap_px: number | null
  letterhead_content_margin: string | null
}

async function loadLetterheadSettings(instructorId: number): Promise<LetterheadSettings | undefined> {
  await ensureInstructorRecommendationSettings(instructorId)
  const settingsRows = sqlRows(
    await sql`
      SELECT
        letterhead_logo_url,
        letterhead_signature_image_url,
        letterhead_instructor_title,
        letterhead_instructor_email,
        letterhead_instructor_phone,
        letterhead_instructor_office,
        letterhead_signatory_name,
        signature_block,
        letterhead_logo_scale,
        letterhead_signature_scale,
        letterhead_body_font_scale,
        letterhead_body_text_align,
        letterhead_header_font_scale,
        letterhead_header_text_align,
        letterhead_header_logo_text_gap_px,
        letterhead_content_margin
      FROM recommendation_settings
      WHERE instructor_id = ${instructorId}
      LIMIT 1
    `,
  )
  return settingsRows[0] as LetterheadSettings | undefined
}

/** Build letterhead PDF bytes from a recommendation_requests row (+ joined student/instructor names). */
export async function buildRecommendationLetterPdfBufferFromRow(
  row: Record<string, unknown>,
  instructorId: number,
): Promise<Buffer> {
  const letter = String(row.final_letter_text ?? "").trim()
  if (!letter) {
    throw new Error("Final letter is not ready")
  }

  const settings = await loadLetterheadSettings(instructorId)
  const letterSpecific = Boolean(row.letter_is_specific)
  const recipientInsideAddressLines = letterSpecific
    ? buildRecipientInsideAddressLines({
        letter_is_specific: true,
        recipient_name: typeof row.recipient_name === "string" ? row.recipient_name : null,
        recipient_organization:
          typeof row.recipient_organization === "string" ? row.recipient_organization : null,
        recipient_address: typeof row.recipient_address === "string" ? row.recipient_address : null,
      })
    : undefined

  const salutationName = letterSpecific
    ? recommendationRecipientSalutationName({
        recipient_name: typeof row.recipient_name === "string" ? row.recipient_name : null,
        recipient_organization:
          typeof row.recipient_organization === "string" ? row.recipient_organization : null,
      })
    : null

  const dateStr = new Date().toLocaleDateString("en-US", { timeZone: "America/Chicago" })
  const signatory = resolveLetterheadSignatoryName(settings ?? {}, String(row.instructor_name ?? "Faculty"))
  const purposeOther =
    typeof row.purpose_other_detail === "string" ? row.purpose_other_detail.trim() || null : null
  const studentFullName = String(row.student_full_name ?? "Student")
  const purposeRaw = row.purpose ? String(row.purpose) : null

  return buildRecommendationLetterheadPdf({
    studentName: studentFullName,
    recipientInsideAddressLines: recipientInsideAddressLines ?? null,
    recipientName: salutationName,
    letterPurpose: purposeRaw ? letterPurposeLineDisplay(purposeRaw, purposeOther) : null,
    reLine: purposeRaw ? formatRecommendationReLine(studentFullName, purposeRaw, purposeOther) : null,
    letterBody: normalizeDraftLetterBodyForLetterheadPreview(letter) || letter,
    date: dateStr,
    instructorName: signatory,
    instructorTitle: settings?.letterhead_instructor_title ?? null,
    instructorEmail: settings?.letterhead_instructor_email ?? null,
    instructorPhone: settings?.letterhead_instructor_phone ?? null,
    instructorOffice: settings?.letterhead_instructor_office ?? null,
    signatureBlock: settings?.signature_block ?? null,
    logoUrl: settings?.letterhead_logo_url ?? null,
    signatureUrl: settings?.letterhead_signature_image_url ?? null,
    logoScale: clampLetterheadImageScale(settings?.letterhead_logo_scale, 1),
    signatureScale: clampLetterheadImageScale(settings?.letterhead_signature_scale, 1),
    bodyFontScale: clampLetterheadBodyFontScale(settings?.letterhead_body_font_scale, 1),
    bodyTextAlign: parseLetterheadBodyTextAlign(settings?.letterhead_body_text_align),
    headerFontScale: clampLetterheadHeaderFontScale(settings?.letterhead_header_font_scale),
    headerTextAlign: parseLetterheadHeaderTextAlign(settings?.letterhead_header_text_align),
    headerLogoTextGapPx: clampLetterheadLogoTextGapPx(settings?.letterhead_header_logo_text_gap_px),
    contentMargin: parseLetterheadContentMargin(settings?.letterhead_content_margin),
  })
}
