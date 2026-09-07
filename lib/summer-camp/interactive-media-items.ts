import {
  getInteractiveImageSlots,
  readInteractiveImage,
  type InteractiveImageSlot,
} from "@/lib/summer-camp/interactive-block-images"

export type InteractiveMediaItem = {
  id: string
  label: string
  group?: string
  imageUrl?: string
  caption?: string
  kind: InteractiveImageSlot["kind"] | "sample"
}

export type InteractiveMediaConfig = {
  itemLabel: string
  allowCaption?: boolean
  /** Minimum rows kept in the editor (0 = allow empty block). */
  minItems?: number
}

export const INTERACTIVE_MEDIA_CONFIG: Record<string, InteractiveMediaConfig> = {
  face_eye_sample_gallery: { itemLabel: "Sample result", allowCaption: true, minItems: 0 },
  hardware_kit_layout: { itemLabel: "Photo", minItems: 0 },
  camera_orientation: { itemLabel: "Orientation photo", minItems: 0 },
  pi_assembly_steps: { itemLabel: "Assembly step", minItems: 0 },
  pi_imager_workflow: { itemLabel: "Guide screenshot", minItems: 0 },
  face_eye_pipeline: { itemLabel: "Diagram", minItems: 0 },
  camera_verify: { itemLabel: "Photo", minItems: 0 },
  desktop_tour: { itemLabel: "Screenshot", minItems: 0 },
  opencv_pixels_poll: { itemLabel: "Illustration", minItems: 0 },
  vertical_pipeline: { itemLabel: "Diagram", minItems: 0 },
  od_result_viz: { itemLabel: "Scene image", minItems: 0 },
  manual_bounding_box: { itemLabel: "Scene image", minItems: 0 },
  detection_scores: { itemLabel: "Example image", minItems: 0 },
  run_detection: { itemLabel: "Screenshot", minItems: 0 },
  od_pipeline_anim: { itemLabel: "Diagram", minItems: 0 },
}

const FACE_EYE_LEGACY_FIELDS: Array<{ key: string; title: string; caption: string }> = [
  { key: "faceImageUrl", title: "Face Detection Result", caption: "A green bounding box indicates a detected face." },
  {
    key: "faceEyeImageUrl",
    title: "Face & Eye Detection Result",
    caption: "Blue rectangles indicate detected eyes.",
  },
  {
    key: "multiFaceImageUrl",
    title: "Multiple Face Detection",
    caption: "The system can detect multiple people at the same time.",
  },
]

export function hasInteractiveMediaEditor(variant: string): boolean {
  return Boolean(getInteractiveImageSlots(variant)?.length) || variant === "face_eye_sample_gallery"
}

export function getInteractiveMediaConfig(variant: string): InteractiveMediaConfig {
  return (
    INTERACTIVE_MEDIA_CONFIG[variant] ?? {
      itemLabel: "Photo",
      minItems: 0,
    }
  )
}

function slotToItem(slot: InteractiveImageSlot, content: Record<string, unknown>): InteractiveMediaItem {
  return {
    id: slot.key,
    label: slot.label,
    group: slot.group,
    imageUrl: readInteractiveImage(content, slot).trim() || undefined,
    kind: slot.kind,
  }
}

function samplesToItems(content: Record<string, unknown>): InteractiveMediaItem[] {
  const samples = content.samples as Array<{ title?: string; caption?: string; imageUrl?: string }> | undefined
  if (!Array.isArray(samples)) return []
  return samples.map((sample, i) => ({
    id: `sample:${i}`,
    label: String(sample.title ?? "Sample result"),
    caption: sample.caption ? String(sample.caption) : undefined,
    imageUrl: String(sample.imageUrl ?? "").trim() || undefined,
    kind: "sample" as const,
  }))
}

function legacyFaceEyeToItems(content: Record<string, unknown>): InteractiveMediaItem[] {
  return FACE_EYE_LEGACY_FIELDS.map(({ key, title, caption }) => ({
    id: key,
    label: title,
    caption,
    imageUrl: String(content[key] ?? "").trim() || undefined,
    kind: "sample" as const,
  })).filter((item) => item.imageUrl)
}

function buildDefaultItems(variant: string, content: Record<string, unknown>): InteractiveMediaItem[] {
  if (variant === "face_eye_sample_gallery") {
    const legacy = legacyFaceEyeToItems(content)
    if (legacy.length > 0) return legacy
    const fromSamples = samplesToItems(content)
    if (fromSamples.length > 0) return fromSamples
    return [
      {
        id: "sample:0",
        label: "Face & Eye Detection Result",
        caption: "Green boxes indicate faces; blue rectangles indicate detected eyes.",
        kind: "sample",
      },
    ]
  }

  const slots = getInteractiveImageSlots(variant) ?? []
  const withImages = slots
    .map((slot) => slotToItem(slot, content))
    .filter((item) => item.imageUrl)
  if (withImages.length > 0) return withImages
  return slots.map((slot) => slotToItem(slot, content))
}

export function readInteractiveMediaItems(
  variant: string,
  content: Record<string, unknown>,
): InteractiveMediaItem[] {
  if (Array.isArray(content.mediaItems)) {
    return content.mediaItems as InteractiveMediaItem[]
  }
  return buildDefaultItems(variant, content)
}

/** Normalize block content to persisted mediaItems[] (and sync legacy fields for renderers). */
export function normalizeInteractiveMediaContent(
  variant: string,
  content: Record<string, unknown>,
): Record<string, unknown> {
  if (!hasInteractiveMediaEditor(variant)) return content
  const items = readInteractiveMediaItems(variant, content)
  return applyMediaItemsToContent(variant, content, items)
}

export function applyMediaItemsToContent(
  variant: string,
  content: Record<string, unknown>,
  items: InteractiveMediaItem[],
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...content, variant, mediaItems: items }

  if (variant === "face_eye_sample_gallery") {
    next.samples = items.map((item) => ({
      title: item.label,
      caption: item.caption ?? "",
      imageUrl: item.imageUrl ?? "",
    }))
    for (const { key } of FACE_EYE_LEGACY_FIELDS) {
      delete next[key]
    }
  } else {
    delete next.samples
  }

  const slots = getInteractiveImageSlots(variant) ?? []
  for (const slot of slots) {
    if (slot.kind === "field") delete next[slot.key]
  }
  delete next.stepImages

  const stepImages: Record<string, string> = {}
  for (const item of items) {
    if (!item.imageUrl?.trim()) continue
    if (item.kind === "stepImages") {
      stepImages[item.id] = item.imageUrl
    } else if (item.kind === "field") {
      next[item.id] = item.imageUrl
    }
  }
  if (Object.keys(stepImages).length > 0) {
    next.stepImages = stepImages
  }

  return next
}

export function readMediaItemImage(
  content: Record<string, unknown> | undefined,
  id: string,
): string | undefined {
  if (!content) return undefined

  if (Array.isArray(content.mediaItems)) {
    const item = (content.mediaItems as InteractiveMediaItem[]).find((row) => row.id === id)
    return item?.imageUrl?.trim() || undefined
  }

  const map = (content.stepImages as Record<string, string> | undefined) ?? {}
  const fromStep = map[id]?.trim()
  if (fromStep) return fromStep

  const fromField = String(content[id] ?? "").trim()
  return fromField || undefined
}

/** Gallery-style samples for face_eye_sample_gallery (and similar). */
export function readGallerySamples(
  variant: string,
  content: Record<string, unknown>,
): Array<{ title: string; caption?: string; imageUrl?: string }> {
  if (variant === "face_eye_sample_gallery") {
    return readInteractiveMediaItems(variant, content)
      .filter((item) => item.imageUrl?.trim())
      .map((item) => ({
        title: item.label,
        caption: item.caption,
        imageUrl: item.imageUrl,
      }))
  }

  const samples = content.samples
  if (Array.isArray(samples) && samples.length > 0) {
    return samples as Array<{ title: string; caption?: string; imageUrl?: string }>
  }
  return []
}
