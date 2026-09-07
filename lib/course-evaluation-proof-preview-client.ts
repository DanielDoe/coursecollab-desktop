import { isHeicMimeOrName } from "@/lib/heic-image"

export type PendingProofPreviewKind = "image" | "heic" | "pdf" | "other"

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp)$/i

export function isPendingProofImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true
  return IMAGE_EXT.test(file.name || "")
}

export function getPendingProofPreviewKind(file: File): PendingProofPreviewKind {
  const name = file.name || ""
  const mime = file.type || ""
  if (mime === "application/pdf" || name.toLowerCase().endsWith(".pdf")) return "pdf"
  if (isHeicMimeOrName(mime, name)) return "heic"
  if (isPendingProofImageFile(file)) return "image"
  return "other"
}

const PREVIEW_MAX_EDGE = 960
/** Downscale when file exceeds this — phone photos of screens are often 3–8 MB. */
const PREVIEW_DOWNSCALE_BYTES = 400 * 1024

async function canvasPreviewFromBitmap(
  source: CanvasImageSource & { close?: () => void },
  width: number,
  height: number,
  maxEdge: number,
): Promise<string | null> {
  const scale = Math.min(1, maxEdge / Math.max(width, height, 1))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  if ("close" in source && typeof source.close === "function") source.close()
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82),
  )
  return blob ? URL.createObjectURL(blob) : null
}

/** Browser preview URL — always downscales large screenshots to avoid tab OOM / blank screen. */
export async function createProofImagePreviewUrl(
  file: File,
  maxEdge = PREVIEW_MAX_EDGE,
): Promise<string | null> {
  if (typeof window === "undefined") return null
  if (getPendingProofPreviewKind(file) !== "image") return null

  try {
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file, {
          resizeWidth: maxEdge,
          resizeHeight: maxEdge,
          resizeQuality: "medium",
        })
        const url = await canvasPreviewFromBitmap(bitmap, bitmap.width, bitmap.height, maxEdge)
        if (url) return url
      } catch {
        // Fall through to Image() path
      }
    }

    if (file.size <= PREVIEW_DOWNSCALE_BYTES) {
      return URL.createObjectURL(file)
    }

    return await new Promise((resolve) => {
      const objectUrl = URL.createObjectURL(file)
      const img = new Image()

      img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        void canvasPreviewFromBitmap(img, img.naturalWidth, img.naturalHeight, maxEdge).then(
          (url) => resolve(url ?? null),
        )
      }

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(null)
      }

      img.src = objectUrl
    })
  } catch {
    return null
  }
}

export function pendingProofFileKey(file: File, index: number): string {
  return `${file.name}:${file.size}:${file.lastModified}:${index}`
}
