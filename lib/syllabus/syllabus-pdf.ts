import path from "path"
import { sql } from "@/lib/db"
import { fetchPublicAssetBytes } from "@/lib/public-asset-bytes"
import { unlinkPublicUploadUrl } from "@/lib/blob-or-local-public"
import { ensureSyllabusSchema } from "@/lib/ensure-syllabus-schema"
import type { SyllabusContentMode } from "@/lib/syllabus/types"
export { buildSyllabusPdfProxyUrl, syllabusPdfDownloadName } from "@/lib/syllabus/syllabus-pdf-url"

export type SyllabusPdfRecord = {
  courseId: number
  pdfUrl: string
  pdfFileName: string | null
  title: string
  status: string
  contentMode: SyllabusContentMode
  updatedAt: string | null
}

export async function getSyllabusPdfRecord(courseId: number): Promise<SyllabusPdfRecord | null> {
  await ensureSyllabusSchema()
  const rows = await sql`
    SELECT course_id, pdf_url, pdf_file_name, title, status, content_mode, updated_at
    FROM course_syllabi
    WHERE course_id = ${courseId}
    LIMIT 1
  `
  if (!rows.length) return null
  const row = rows[0] as {
    course_id: number
    pdf_url: string | null
    pdf_file_name: string | null
    title: string
    status: string
    content_mode: string
    updated_at: Date | string | null
  }
  if (!row.pdf_url) return null
  return {
    courseId: row.course_id,
    pdfUrl: row.pdf_url,
    pdfFileName: row.pdf_file_name,
    title: row.title,
    status: row.status,
    contentMode: row.content_mode === "pdf" ? "pdf" : "structured",
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

export async function fetchSyllabusPdfBytes(pdfUrl: string): Promise<Buffer> {
  if (pdfUrl.startsWith("http://") || pdfUrl.startsWith("https://")) {
    const res = await fetch(pdfUrl)
    if (!res.ok) throw new Error("Failed to fetch external PDF")
    return Buffer.from(await res.arrayBuffer())
  }
  if (!pdfUrl.startsWith("/uploads/")) {
    throw new Error("Invalid syllabus PDF path")
  }
  const bytes = await fetchPublicAssetBytes(pdfUrl)
  if (!bytes?.length) throw new Error("Failed to load syllabus PDF")
  return bytes
}

export async function unlinkSyllabusPublicUrl(url: string | null | undefined): Promise<void> {
  await unlinkPublicUploadUrl(url)
}

function sanitizeBaseName(name: string): string {
  const base = path.basename(name, path.extname(name))
  return base.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "syllabus"
}

export function syllabusUploadRelativeFolder(courseId: number): string {
  return `uploads/syllabus-documents/${courseId}`
}

/** @deprecated Local dev only — use syllabusUploadRelativeFolder + savePublicUpload on Vercel. */
export async function syllabusUploadFolder(courseId: number): Promise<string> {
  if (process.env.VERCEL) {
    throw new Error("syllabusUploadFolder is not available on Vercel")
  }
  const { resolvePublicUploadDir } = await import("@/lib/local-public-write")
  return resolvePublicUploadDir("uploads", "syllabus-documents", String(courseId))
}

export function sanitizeSyllabusPdfFileName(origName: string): string {
  const stamp = Date.now()
  const base = `${sanitizeBaseName(origName)}-${stamp}`
  return `${base}.pdf`
}
