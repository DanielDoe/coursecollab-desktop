import path from "path"
import { unlinkPublicUploadUrl } from "@/lib/blob-or-local-public"

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"])

export function isAllowedSyllabusImage(name: string, mime?: string): boolean {
  const ext = path.extname(name).toLowerCase().replace(/^\./, "")
  if (IMAGE_EXTENSIONS.has(ext)) return true
  if (mime?.startsWith("image/")) return true
  return false
}

export function syllabusImageRelativeFolder(courseId: number, sectionId: string): string {
  return `uploads/syllabus-images/${courseId}/${sectionId}`
}

/** @deprecated Local dev only */
export async function syllabusImageUploadFolder(courseId: number, sectionId: string): Promise<string> {
  if (process.env.VERCEL) {
    throw new Error("syllabusImageUploadFolder is not available on Vercel")
  }
  const { resolvePublicUploadDir } = await import("@/lib/local-public-write")
  return resolvePublicUploadDir("uploads", "syllabus-images", String(courseId), sectionId)
}

export function sanitizeSyllabusImageFileName(origName: string): string {
  const ext = path.extname(origName).toLowerCase() || ".jpg"
  const base = path.basename(origName, path.extname(origName))
  const safe = base.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 60) || "image"
  return `${safe}-${Date.now()}${ext}`
}

export function syllabusImagePublicUrl(courseId: number, sectionId: string, fileName: string): string {
  return `/uploads/syllabus-images/${courseId}/${sectionId}/${fileName}`
}

export async function unlinkSyllabusImageUrl(url: string | null | undefined): Promise<void> {
  await unlinkPublicUploadUrl(url)
}
