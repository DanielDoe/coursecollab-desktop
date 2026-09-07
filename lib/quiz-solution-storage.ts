import { savePublicUpload } from "@/lib/blob-or-local-public"
import { jpegFileName, replacePathImageExt } from "@/lib/media/compress-image"
import { compressUploadImageBuffer } from "@/lib/media/compress-image-server"

const EXT_FROM_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
}

async function persistSolutionFile(opts: {
  blobKey: string
  relativePublicPath: string
  file: File
  mime: string
}): Promise<{ url: string; name: string; mime: string }> {
  let bytes = Buffer.from(await opts.file.arrayBuffer())
  let mime = opts.mime
  let name = opts.file.name
  let blobKey = opts.blobKey
  let relativePublicPath = opts.relativePublicPath

  try {
    const compressed = await compressUploadImageBuffer(bytes, mime)
    if (compressed) {
      bytes = compressed.bytes
      mime = compressed.mime
      name = jpegFileName(name)
      blobKey = replacePathImageExt(blobKey, compressed.ext)
      relativePublicPath = replacePathImageExt(relativePublicPath, compressed.ext)
    }
  } catch (err) {
    console.warn("[solution-upload] compress skipped", err)
  }

  const url = await savePublicUpload({
    blobKey,
    relativePublicPath,
    bytes,
    contentType: mime || undefined,
  })
  return { url, name, mime }
}

/** Persist worked-solution uploads for quiz/homework attempts. */
export async function saveQuizSolutionFile(
  studentDbId: number,
  attemptId: number,
  questionId: number,
  partId: string,
  file: File,
): Promise<{ url: string; name: string; mime: string }> {
  const mime = (file.type || "").toLowerCase()
  const ext = EXT_FROM_MIME[mime] || "bin"
  const safePart = partId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 16)
  const safeBase = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60)
  const fname = `q${questionId}_${safePart}_${Date.now()}_${safeBase || "work"}.${ext}`
  return persistSolutionFile({
    blobKey: `quiz-solutions/${studentDbId}/${attemptId}/${fname}`,
    relativePublicPath: `uploads/quiz-solutions/${studentDbId}/${attemptId}/${fname}`,
    file,
    mime,
  })
}

/** Persist worked-solution uploads for practice attempts (bank question ids). */
export async function savePracticeSolutionFile(
  studentDbId: number,
  attemptId: number,
  bankQuestionId: number,
  partId: string,
  file: File,
): Promise<{ url: string; name: string; mime: string }> {
  const mime = (file.type || "").toLowerCase()
  const ext = EXT_FROM_MIME[mime] || "bin"
  const safePart = partId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 16)
  const safeBase = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60)
  const fname = `q${bankQuestionId}_${safePart}_${Date.now()}_${safeBase || "work"}.${ext}`
  return persistSolutionFile({
    blobKey: `practice-solutions/${studentDbId}/${attemptId}/${fname}`,
    relativePublicPath: `uploads/practice-solutions/${studentDbId}/${attemptId}/${fname}`,
    file,
    mime,
  })
}

/** Persist worked-solution uploads for in-lecture circuit workspace drafts. */
export async function saveLectureWorkspaceSolutionFile(
  studentDbId: number,
  lectureId: number,
  questionId: string,
  partId: string,
  file: File,
): Promise<{ url: string; name: string; mime: string }> {
  const mime = (file.type || "").toLowerCase()
  const ext = EXT_FROM_MIME[mime] || "bin"
  const safeQuestion = questionId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 24)
  const safePart = partId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 16)
  const safeBase = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60)
  const fname = `${safeQuestion}_${safePart}_${Date.now()}_${safeBase || "work"}.${ext}`
  return persistSolutionFile({
    blobKey: `lecture-workspace/${studentDbId}/${lectureId}/${fname}`,
    relativePublicPath: `uploads/lecture-workspace/${studentDbId}/${lectureId}/${fname}`,
    file,
    mime,
  })
}

/** Persist worked-solution uploads for classroom points solution assignments. */
export async function saveClassroomSolutionFile(
  studentDbId: number,
  assignmentId: number,
  partId: string,
  file: File,
): Promise<{ url: string; name: string; mime: string }> {
  const mime = (file.type || "").toLowerCase()
  const ext = EXT_FROM_MIME[mime] || "bin"
  const safePart = partId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 16)
  const safeBase = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60)
  const fname = `a${assignmentId}_${safePart}_${Date.now()}_${safeBase || "work"}.${ext}`
  return persistSolutionFile({
    blobKey: `classroom-solutions/${studentDbId}/${assignmentId}/${fname}`,
    relativePublicPath: `uploads/classroom-solutions/${studentDbId}/${assignmentId}/${fname}`,
    file,
    mime,
  })
}
