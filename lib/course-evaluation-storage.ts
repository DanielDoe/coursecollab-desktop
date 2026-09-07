import { savePublicUpload } from "@/lib/blob-or-local-public"

const EXT_FROM_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
}

export async function saveCourseEvaluationProofFile(
  studentDbId: number,
  evaluationId: number,
  file: File,
  storedMime?: string,
): Promise<{ url: string; name: string; mime: string }> {
  const mime = (storedMime || file.type || "").toLowerCase()
  const ext = EXT_FROM_MIME[mime] || "bin"
  const safeBase = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60)
  const fname = `eval${evaluationId}_${Date.now()}_${safeBase || "proof"}.${ext}`
  const bytes = Buffer.from(await file.arrayBuffer())
  const url = await savePublicUpload({
    blobKey: `course-evaluations/${studentDbId}/${evaluationId}/${fname}`,
    relativePublicPath: `uploads/course-evaluations/${studentDbId}/${evaluationId}/${fname}`,
    bytes,
    contentType: mime || undefined,
  })
  return { url, name: file.name, mime: mime || file.type }
}
