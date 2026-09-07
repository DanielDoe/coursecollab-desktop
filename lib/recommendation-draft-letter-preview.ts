import type { RecommendationLetterheadContent } from "@/lib/recommendation-letterhead-types"
import {
  clampLetterheadBodyFontScale,
  clampLetterheadImageScale,
  parseLetterheadBodyTextAlign,
  parseLetterheadHeaderTextAlign,
  clampLetterheadHeaderFontScale,
  clampLetterheadLogoTextGapPx,
  resolveLetterheadSignatoryName,
} from "@/lib/recommendation-letterhead-signatory"
import { parseLetterheadContentMargin } from "@/lib/recommendation-letterhead-margin"
import {
  buildRecipientInsideAddressLines,
  recommendationRecipientSalutationName,
} from "@/lib/recommendation-letterhead-recipient"
import { letterPurposeLineDisplay, formatRecommendationReLine } from "@/lib/recommendation-letters-shared"

/**
 * Students often paste a full memo (salutation → closing sign-off). Letterhead renders
 * date, greeting, closing, signature, and dept footer — so preview strips mirrored lines.
 */
export function normalizeDraftLetterBodyForLetterheadPreview(raw: string): string {
  let t = raw.trim()
  if (!t) return ""

  let parts = t.split(/\n\s*\n/)
  const first = parts[0]?.trim() ?? ""
  if (/^(dear\s|to whom it may concern)/i.test(first)) {
    parts = parts.slice(1)
  }
  t = parts.join("\n\n").trim()
  if (!t) return ""

  parts = t.split(/\n\s*\n/)
  const last = parts[parts.length - 1]?.trim() ?? ""
  const lastFirstLine = last.split(/\r?\n/)[0]?.trim() ?? ""
  if (
    /^(respectfully|sincerely|cordially|yours sincerely|best regards|warm regards|kind regards)[,!.\s]*$/i.test(
      lastFirstLine,
    )
  ) {
    parts = parts.slice(0, -1)
  }

  return parts.join("\n\n").trim()
}

export function buildLetterheadPreviewContentForStudentDraft(input: {
  manualLetterText: string
  req: Record<string, unknown>
  settings: Record<string, unknown> | undefined
}): RecommendationLetterheadContent {
  const r = input.req
  const s = input.settings ?? {}
  const instructorAccountName = String(r.instructor_name ?? "Faculty")
  const normalizedBody = normalizeDraftLetterBodyForLetterheadPreview(input.manualLetterText)

  const letterSpecific = Boolean(r.letter_is_specific)
  const recipientInsideAddressLines =
    letterSpecific
      ? buildRecipientInsideAddressLines({
          letter_is_specific: true,
          recipient_name: typeof r.recipient_name === "string" ? r.recipient_name : null,
          recipient_organization:
            typeof r.recipient_organization === "string" ? r.recipient_organization : null,
          recipient_address:
            typeof (r as { recipient_address?: unknown }).recipient_address === "string"
              ? (r as { recipient_address: string }).recipient_address
              : null,
        })
      : undefined

  const salutationName = letterSpecific
    ? recommendationRecipientSalutationName({
        recipient_name: typeof r.recipient_name === "string" ? r.recipient_name : null,
        recipient_organization:
          typeof r.recipient_organization === "string" ? r.recipient_organization : null,
      })
    : null

  const letterPurposeRaw = typeof r.purpose === "string" ? r.purpose : null
  const purposeOther =
    typeof (r as { purpose_other_detail?: unknown }).purpose_other_detail === "string"
      ? (r as { purpose_other_detail: string }).purpose_other_detail
      : null

  const dateStr = new Date().toLocaleDateString("en-US", { timeZone: "America/Chicago" })
  const studentName = String(r.student_full_name ?? "Student")

  return {
    studentName,
    recipientInsideAddressLines: recipientInsideAddressLines ?? null,
    recipientName: salutationName,
    letterPurpose: letterPurposeRaw
      ? letterPurposeLineDisplay(letterPurposeRaw, purposeOther)
      : null,
    reLine: letterPurposeRaw
      ? formatRecommendationReLine(studentName, letterPurposeRaw, purposeOther)
      : null,
    letterBody:
      normalizedBody ||
      "Your letter fills this space as you write — paragraphs double-spaced in the editor show as separate blocks here.",
    date: dateStr,
    instructorName: resolveLetterheadSignatoryName(s, instructorAccountName),
    instructorTitle: typeof s.letterhead_instructor_title === "string" ? s.letterhead_instructor_title : null,
    instructorEmail: typeof s.letterhead_instructor_email === "string" ? s.letterhead_instructor_email : null,
    instructorPhone: typeof s.letterhead_instructor_phone === "string" ? s.letterhead_instructor_phone : null,
    instructorOffice: typeof s.letterhead_instructor_office === "string" ? s.letterhead_instructor_office : null,
    signatureBlock: typeof s.signature_block === "string" ? s.signature_block : null,
    logoUrl: typeof s.letterhead_logo_url === "string" ? s.letterhead_logo_url : null,
    signatureUrl:
      typeof s.letterhead_signature_image_url === "string" ? s.letterhead_signature_image_url : null,
    logoScale: clampLetterheadImageScale(typeof s.letterhead_logo_scale === "number" ? s.letterhead_logo_scale : null, 1),
    signatureScale: clampLetterheadImageScale(
      typeof s.letterhead_signature_scale === "number" ? s.letterhead_signature_scale : null,
      1,
    ),
    bodyFontScale: clampLetterheadBodyFontScale(s.letterhead_body_font_scale, 1),
    bodyTextAlign: parseLetterheadBodyTextAlign(s.letterhead_body_text_align),
    headerFontScale: clampLetterheadHeaderFontScale(s.letterhead_header_font_scale),
    headerTextAlign: parseLetterheadHeaderTextAlign(s.letterhead_header_text_align),
    headerLogoTextGapPx: clampLetterheadLogoTextGapPx(s.letterhead_header_logo_text_gap_px),
    contentMargin: parseLetterheadContentMargin(s.letterhead_content_margin),
  }
}
