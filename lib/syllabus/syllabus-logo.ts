import path from "path"
import { unlinkPublicUploadUrl } from "@/lib/blob-or-local-public"

export function syllabusLogoRelativeFolder(courseId: number): string {
  return `uploads/syllabus-logos/${courseId}`
}

/** @deprecated Local dev only */
export async function syllabusLogoUploadFolder(courseId: number): Promise<string> {
  if (process.env.VERCEL) {
    throw new Error("syllabusLogoUploadFolder is not available on Vercel")
  }
  const { resolvePublicUploadDir } = await import("@/lib/local-public-write")
  return resolvePublicUploadDir("uploads", "syllabus-logos", String(courseId))
}

export function syllabusLogoPublicUrl(courseId: number, fileName: string): string {
  return `/uploads/syllabus-logos/${courseId}/${fileName}`
}

export async function unlinkSyllabusLogoUrl(url: string | null | undefined): Promise<void> {
  await unlinkPublicUploadUrl(url)
}
