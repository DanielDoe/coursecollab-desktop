import path from "path"
import { randomUUID } from "crypto"
import { savePublicUpload } from "@/lib/blob-or-local-public"

const MAX_FILE_MB = 25
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "video/mp4",
  "video/webm",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
  "application/json",
])

async function persistPublicBytes(
  blobKey: string,
  localRelativePath: string,
  bytes: Buffer,
  contentType?: string,
): Promise<string> {
  return savePublicUpload({
    blobKey,
    relativePublicPath: localRelativePath.replace(/\\/g, "/"),
    bytes,
    contentType,
  })
}

export function validateCampUploadMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime)
}

export function validateCampUploadSize(bytes: number, maxMb = MAX_FILE_MB): boolean {
  return bytes <= maxMb * 1024 * 1024
}

/** Public camp assets (images, PDFs shown in modules) */
export async function saveCampPublicFile(
  campId: number,
  file: File,
  subfolder = "assets",
): Promise<{ url: string; fileName: string }> {
  const bytes = await file.arrayBuffer()
  if (!validateCampUploadSize(bytes.byteLength)) {
    throw new Error(`File exceeds ${MAX_FILE_MB}MB limit`)
  }
  if (!validateCampUploadMime(file.type)) {
    throw new Error("File type not allowed")
  }

  const ext = path.extname(file.name) || ""
  const safeName = `${randomUUID()}${ext}`
  const relativePath = path.join("uploads", "summer-camp", String(campId), subfolder, safeName)
  const url = await persistPublicBytes(
    `summer-camp/${campId}/${subfolder}/${safeName}`,
    relativePath,
    Buffer.from(bytes),
    file.type || undefined,
  )

  return { url, fileName: file.name }
}

/** Certificate template logos, seals, and custom signature images */
export async function saveCampCertificateTemplateAsset(
  trainingId: number,
  assetKey: string,
  file: File,
): Promise<{ url: string }> {
  const mime = file.type
  if (mime !== "image/png" && mime !== "image/jpeg") {
    throw new Error("Only PNG or JPEG images are supported")
  }
  const ext = mime === "image/png" ? "png" : "jpg"
  const fname = `${assetKey}-${Date.now()}.${ext}`
  const relativePath = path.join(
    "uploads",
    "summer-camp",
    "certificate-templates",
    String(trainingId),
    fname,
  )
  const url = await persistPublicBytes(
    `summer-camp/certificate-templates/${trainingId}/${fname}`,
    relativePath,
    Buffer.from(await file.arrayBuffer()),
    mime,
  )
  return { url }
}

/** Private camper submissions */
export async function saveCampSubmissionFile(
  studentId: number,
  moduleId: number,
  file: File,
): Promise<{ url: string; fileName: string; storagePath: string }> {
  const bytes = await file.arrayBuffer()
  if (!validateCampUploadSize(bytes.byteLength)) {
    throw new Error(`File exceeds ${MAX_FILE_MB}MB limit`)
  }
  if (!validateCampUploadMime(file.type)) {
    throw new Error("File type not allowed")
  }

  const ext = path.extname(file.name) || ""
  const safeName = `${randomUUID()}${ext}`
  const blobKey = `summer-camp/private/${studentId}/${moduleId}/${safeName}`
  const url = await savePublicUpload({
    blobKey,
    relativePublicPath: `uploads/private/summer-camp/${studentId}/${moduleId}/${safeName}`,
    bytes: Buffer.from(bytes),
    contentType: file.type || undefined,
  })
  return {
    url,
    fileName: file.name,
    storagePath: blobKey,
  }
}
