/** Shared caps for student/faculty solution and circuit image uploads. */
export const UPLOAD_IMAGE_MAX_EDGE = 1600
export const UPLOAD_IMAGE_JPEG_QUALITY = 0.78
/** Skip decode when already small enough to store as-is. */
export const UPLOAD_IMAGE_SKIP_BYTES = 180_000

const COMPRESSIBLE = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"])

export function isCompressibleImageMime(mime?: string | null): boolean {
  const m = (mime || "").toLowerCase().split(";")[0]?.trim()
  return COMPRESSIBLE.has(m)
}

export function jpegFileName(originalName: string): string {
  const base = (originalName || "image")
    .replace(/\.(png|jpe?g|webp|gif|heic|heif)$/i, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 60)
  return `${base || "image"}.jpg`
}

export function replacePathImageExt(path: string, ext: string): string {
  return path.replace(/\.(png|jpe?g|webp|gif|heic|heif|bin)$/i, `.${ext}`)
}
