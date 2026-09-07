/**
 * Optional diagram / media attachment for any question type (stored as JSONB `question_media`).
 */

import { parseCircuitSpec, type CircuitQuestionSpec } from "@/lib/engineering-circuit-types"

export type QuestionMediaType = "image" | "svg" | "pdf"
export type QuestionMediaPlacement = "above_question" | "below_question" | "side_by_side"

export interface QuestionMedia {
  media_enabled?: boolean
  media_url?: string | null
  media_type?: QuestionMediaType
  media_caption?: string | null
  media_alt_text?: string | null
  media_placement?: QuestionMediaPlacement
  media_allow_zoom?: boolean
}

export const DEFAULT_QUESTION_MEDIA: QuestionMedia = {
  media_enabled: false,
  media_url: null,
  media_type: "image",
  media_caption: null,
  media_alt_text: null,
  media_placement: "above_question",
  media_allow_zoom: true,
}

export function inferQuestionMediaType(url: string, mime?: string): QuestionMediaType {
  const m = (mime || "").toLowerCase()
  if (m.includes("pdf")) return "pdf"
  if (m.includes("svg")) return "svg"
  const lower = url.toLowerCase().split("?")[0]
  if (lower.endsWith(".pdf")) return "pdf"
  if (lower.endsWith(".svg")) return "svg"
  return "image"
}

export function parseQuestionMedia(raw: unknown): QuestionMedia {
  const base = { ...DEFAULT_QUESTION_MEDIA }
  if (raw == null || raw === "") return base
  try {
    const obj =
      typeof raw === "string"
        ? (JSON.parse(raw) as Record<string, unknown>)
        : (raw as Record<string, unknown>)
    if (!obj || typeof obj !== "object") return base
    const placement = obj.media_placement as string
    const type = obj.media_type as string
    return {
      ...base,
      media_enabled: obj.media_enabled === true,
      media_url:
        typeof obj.media_url === "string" && obj.media_url.trim() ? obj.media_url.trim() : null,
      media_type:
        type === "pdf" || type === "svg" || type === "image"
          ? type
          : base.media_type,
      media_caption:
        typeof obj.media_caption === "string" && obj.media_caption.trim()
          ? obj.media_caption.trim()
          : null,
      media_alt_text:
        typeof obj.media_alt_text === "string" && obj.media_alt_text.trim()
          ? obj.media_alt_text.trim()
          : null,
      media_placement:
        placement === "below_question" || placement === "side_by_side"
          ? placement
          : "above_question",
      media_allow_zoom: obj.media_allow_zoom !== false,
    }
  } catch {
    return base
  }
}

const MEDIA_URL_PLACEHOLDERS = ["UPLOAD_CIRCUIT_IMAGE_URL_HERE", "UPLOAD_FIGURE_URL_HERE"]

export function isUsableQuestionMediaUrl(url: string | null | undefined): boolean {
  const u = (url || "").trim()
  if (!u) return false
  if (MEDIA_URL_PLACEHOLDERS.some((p) => u.includes(p))) return false
  return isPublicMediaUrl(u)
}

export function hasActiveQuestionMedia(media: QuestionMedia | null | undefined): boolean {
  const url = (media?.media_url || "").trim()
  if (!isUsableQuestionMediaUrl(url)) return false
  if (media?.media_enabled === true) return true
  // Allow diagrams saved with a real URL even if media_enabled was not toggled in the editor
  return url.startsWith("/") || /^https?:\/\//i.test(url)
}

/** Read `question_media` with fallback from linked bank row, then legacy `circuit_spec` diagram fields. */
export function resolveQuestionMedia(question: {
  question_media?: unknown
  circuit_spec?: unknown
  bank_question_media?: unknown
}): QuestionMedia {
  const parsed = parseQuestionMedia(question?.question_media)
  if (hasActiveQuestionMedia(parsed)) return parsed

  const bankParsed = parseQuestionMedia(question?.bank_question_media)
  if (hasActiveQuestionMedia(bankParsed)) return bankParsed

  const spec = parseCircuitSpec(question?.circuit_spec)
  const legacyUrl = (spec.circuitDiagramUrl || "").trim()
  if (!legacyUrl) return parsed

  return {
    ...DEFAULT_QUESTION_MEDIA,
    media_enabled: true,
    media_url: legacyUrl,
    media_type: inferQuestionMediaType(legacyUrl),
    media_alt_text: spec.circuitDiagramAltText || null,
    media_caption: spec.circuitDiagramAltText || null,
    media_placement: "above_question",
    media_allow_zoom: true,
  }
}

export function questionMediaToJsonString(media: unknown): string | null {
  if (media == null || media === "") return null
  if (typeof media === "string") {
    try {
      JSON.parse(media)
      return media
    } catch {
      return null
    }
  }
  try {
    return JSON.stringify(media)
  } catch {
    return null
  }
}

/** Keep circuit AI / legacy readers in sync when persisting quiz or bank rows. */
export function syncCircuitSpecDiagramFromMedia(
  circuitSpecRaw: unknown,
  media: QuestionMedia,
): CircuitQuestionSpec {
  const spec = parseCircuitSpec(circuitSpecRaw)
  if (!hasActiveQuestionMedia(media)) {
    return { ...spec, circuitDiagramUrl: null, circuitDiagramAltText: null }
  }
  return {
    ...spec,
    circuitDiagramUrl: media.media_url ?? null,
    circuitDiagramAltText: media.media_alt_text || media.media_caption || null,
  }
}

export function isPublicMediaUrl(url: string): boolean {
  const u = url.trim()
  return /^https?:\/\//i.test(u) || u.startsWith("/")
}
