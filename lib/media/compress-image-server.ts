import {
  isCompressibleImageMime,
  UPLOAD_IMAGE_JPEG_QUALITY,
  UPLOAD_IMAGE_MAX_EDGE,
  UPLOAD_IMAGE_SKIP_BYTES,
} from "@/lib/media/compress-image"

export type CompressedUploadImage = {
  bytes: Buffer
  mime: "image/jpeg"
  ext: "jpg"
}

/** Downscale + JPEG-encode upload bytes. Returns null when the original should be kept. */
export async function compressUploadImageBuffer(
  bytes: Buffer,
  mime?: string | null,
): Promise<CompressedUploadImage | null> {
  if (!isCompressibleImageMime(mime)) return null
  if (bytes.byteLength <= UPLOAD_IMAGE_SKIP_BYTES) return null

  const { createCanvas, loadImage } = await import("@napi-rs/canvas")
  const image = await loadImage(bytes)
  const srcW = Math.max(1, image.width)
  const srcH = Math.max(1, image.height)
  const scale = Math.min(1, UPLOAD_IMAGE_MAX_EDGE / Math.max(srcW, srcH))
  const w = Math.max(1, Math.round(srcW * scale))
  const h = Math.max(1, Math.round(srcH * scale))

  if (scale === 1 && bytes.byteLength < 400_000 && (mime || "").includes("jpeg")) {
    return null
  }

  const canvas = createCanvas(w, h)
  const ctx = canvas.getContext("2d")
  ctx.drawImage(image, 0, 0, w, h)
  const quality = Math.round(UPLOAD_IMAGE_JPEG_QUALITY * 100)
  const out = canvas.toBuffer("image/jpeg", quality)
  if (out.byteLength >= bytes.byteLength && (mime || "").includes("jpeg") && scale === 1) {
    return null
  }
  return { bytes: out, mime: "image/jpeg", ext: "jpg" }
}
