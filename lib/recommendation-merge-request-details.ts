/**
 * Shared merge/validation for PATCHing recommendation request details (student or instructor).
 */
import type { RecommendationPurpose } from "@/lib/recommendation-letters-shared"
import { RECOMMENDATION_PURPOSES } from "@/lib/recommendation-letters-shared"

export type RecommendationRequestDetailsPrevRow = {
  purpose: string
  letter_is_specific: boolean
  purpose_other_detail: string | null
  recipient_name: string | null
  recipient_organization: string | null
  recipient_address: string | null
  student_request_description: string | null
  deadline: string | null
}

export type RecommendationRequestDetailsMerged = {
  mergedPurpose: RecommendationPurpose
  mergedOther: string | null
  mergedRecipientName: string | null
  mergedRecipientOrg: string | null
  mergedLetterSpecific: boolean
  mergedRecipientAddress: string | null
  mergedStudentDesc: string | null
  mergedDeadline: string | null
}

export function optTrim(v: unknown, max: number): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s ? s.slice(0, max) : null
}

export function parsePurpose(raw: unknown): RecommendationPurpose | null {
  const s =
    typeof raw === "string" ? raw.trim().toLowerCase().replace(/[\s-]+/g, "_") : ""
  return (RECOMMENDATION_PURPOSES as readonly string[]).includes(s) ? (s as RecommendationPurpose) : null
}

function mergeOptField<T>(body: Record<string, unknown>, keys: string[], prev: T, transform: (v: unknown) => T): T {
  let found: unknown
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      found = body[k]
      break
    }
  }
  if (found === undefined) return prev
  return transform(found)
}

type SettingsSlice = {
  require_purpose_deadline?: boolean
  minimum_notice_days?: number | null
}

export function mergeRecommendationRequestDetailsFromBody(
  body: Record<string, unknown>,
  prev: RecommendationRequestDetailsPrevRow,
  settings: SettingsSlice,
): { ok: true; merged: RecommendationRequestDetailsMerged } | { ok: false; error: string } {
  const purposeFromBody =
    Object.prototype.hasOwnProperty.call(body, "purpose") ||
    Object.prototype.hasOwnProperty.call(body, "purpose_key")
  const rawPurposeIn = body.purpose ?? body.purpose_key

  let mergedPurpose: RecommendationPurpose
  if (
    purposeFromBody &&
    rawPurposeIn != null &&
    String(rawPurposeIn).trim() !== ""
  ) {
    const p = parsePurpose(rawPurposeIn)
    if (!p) {
      return { ok: false, error: "Invalid letter purpose" }
    }
    mergedPurpose = p
  } else {
    mergedPurpose = parsePurpose(prev.purpose) ?? "other"
  }

  let mergedOther = mergeOptField(
    body,
    ["purposeOtherDetail", "purpose_other_detail"],
    prev.purpose_other_detail ?? null,
    (v) => optTrim(v, 500),
  )
  if (mergedPurpose !== "other") {
    mergedOther = null
  } else if (!mergedOther || mergedOther.length < 2) {
    return {
      ok: false,
      error:
        'When letter purpose is "Other", add a short phrase (2+ characters) that should appear after your name on the formal letter.',
    }
  }

  const mergedRecipientName = mergeOptField(
    body,
    ["recipientName", "recipient_name"],
    prev.recipient_name,
    (v) => optTrim(v, 500),
  )
  const mergedRecipientOrg = mergeOptField(
    body,
    ["recipientOrganization", "recipient_organization"],
    prev.recipient_organization,
    (v) => optTrim(v, 500),
  )

  let mergedLetterSpecific = prev.letter_is_specific
  if (typeof body.letterIsSpecific === "boolean") mergedLetterSpecific = body.letterIsSpecific
  else if (typeof body.letter_is_specific === "boolean") mergedLetterSpecific = body.letter_is_specific
  else {
    mergedLetterSpecific =
      Boolean(mergedRecipientName || mergedRecipientOrg) ||
      Boolean(prev.recipient_address?.trim()) ||
      prev.letter_is_specific
  }

  let mergedRecipientAddress: string | null = null
  if (mergedLetterSpecific) {
    mergedRecipientAddress = mergeOptField(
      body,
      ["recipientAddress", "recipient_address"],
      prev.recipient_address ?? null,
      (v) => optTrim(v, 2000),
    )
  }

  let mergedStudentDesc: string | null = prev.student_request_description ?? null
  if (
    Object.prototype.hasOwnProperty.call(body, "studentRequestDescription") ||
    Object.prototype.hasOwnProperty.call(body, "student_request_description")
  ) {
    mergedStudentDesc = optTrim(
      body.studentRequestDescription ?? body.student_request_description,
      4000,
    )
  }

  let mergedDeadline: string | null = prev.deadline
  if (Object.prototype.hasOwnProperty.call(body, "deadline")) {
    const rawDl = body.deadline === null ? "" : String(body.deadline).trim()
    if (!rawDl) {
      mergedDeadline = null
      if (settings.require_purpose_deadline) {
        return { ok: false, error: "A deadline date is required for this instructor." }
      }
    } else {
      const d = new Date(rawDl)
      if (Number.isNaN(d.getTime())) {
        return { ok: false, error: "Invalid deadline" }
      }
      const iso = d.toISOString().slice(0, 10)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const noticeMs = Math.max(0, Number(settings.minimum_notice_days) || 0) * 86400000
      if (d.getTime() < today.getTime() + noticeMs) {
        return {
          ok: false,
          error: `Deadline must be at least ${settings.minimum_notice_days ?? 0} day(s) from today.`,
        }
      }
      mergedDeadline = iso
    }
  }

  return {
    ok: true,
    merged: {
      mergedPurpose,
      mergedOther,
      mergedRecipientName,
      mergedRecipientOrg,
      mergedLetterSpecific,
      mergedRecipientAddress,
      mergedStudentDesc,
      mergedDeadline,
    },
  }
}
