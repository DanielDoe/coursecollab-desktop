import { sql } from "@/lib/db"
import { fetchStoredAssetBytes } from "@/lib/resolve-stored-asset"

export type LecturePdfRecord = {
  pdfUrl: string
  updatedAt: string | null
  title: string | null
}

export async function getLecturePdfRecord(lectureId: number): Promise<LecturePdfRecord | null> {
  const rows = await sql`
    SELECT pdf_url, updated_at, title
    FROM lectures
    WHERE id = ${lectureId}
      AND deleted_at IS NULL
    LIMIT 1
  `
  if (!rows.length) return null
  const row = rows[0] as { pdf_url: string | null; updated_at: string | null; title: string | null }
  if (!row.pdf_url?.trim()) return null
  return {
    pdfUrl: row.pdf_url.trim(),
    updatedAt: row.updated_at,
    title: row.title,
  }
}

/** Load lecture PDF bytes from Vercel Blob (https URL in DB) or legacy `/uploads/` path. */
export async function fetchLecturePdfBytes(
  pdfUrl: string,
  opts?: { lectureId?: number; requestOrigin?: string | null },
): Promise<Buffer> {
  const url = pdfUrl.trim()
  if (!url) throw new Error("Failed to load lecture PDF")

  const bytes = await fetchStoredAssetBytes(url, opts?.requestOrigin)
  if (bytes?.length && bytes.slice(0, 4).toString() === "%PDF") {
    return bytes
  }

  throw new Error("Failed to load lecture PDF")
}
