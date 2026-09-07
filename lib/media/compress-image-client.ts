import {
  isCompressibleImageMime,
  jpegFileName,
  UPLOAD_IMAGE_JPEG_QUALITY,
  UPLOAD_IMAGE_MAX_EDGE,
  UPLOAD_IMAGE_SKIP_BYTES,
} from "@/lib/media/compress-image"

/** Browser-side resize/JPEG. Safe to start before UI upload lock. */
export async function compressUploadImageFile(file: File): Promise<File> {
  if (!isCompressibleImageMime(file.type)) return file
  if (file.size <= UPLOAD_IMAGE_SKIP_BYTES) return file
  if (typeof createImageBitmap !== "function") return file

  try {
    const bitmap = await createImageBitmap(file)
    const srcW = Math.max(1, bitmap.width)
    const srcH = Math.max(1, bitmap.height)
    const scale = Math.min(1, UPLOAD_IMAGE_MAX_EDGE / Math.max(srcW, srcH))
    const w = Math.max(1, Math.round(srcW * scale))
    const h = Math.max(1, Math.round(srcH * scale))

    if (scale === 1 && file.size < 400_000 && file.type.includes("jpeg")) {
      bitmap.close()
      return file
    }

    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      bitmap.close()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((next) => resolve(next), "image/jpeg", UPLOAD_IMAGE_JPEG_QUALITY)
    })
    if (!blob || (blob.size >= file.size && file.type.includes("jpeg") && scale === 1)) {
      return file
    }
    return new File([blob], jpegFileName(file.name), { type: "image/jpeg" })
  } catch {
    return file
  }
}
