/**
 * Released-only lecture RAG. Chunks must match a published lecture
 * (metadata lecture id, or week_number → published lecture). Unlinked rows are denied.
 */

import { sql } from "@/lib/db"

export type ReleasedLectureEmbeddingHit = {
  content: string
  source: string | null
  week_number: number | null
  page_number: number | null
  similarity: number
}

export async function searchReleasedLectureEmbeddings(args: {
  courseId: number
  vectorString: string
  limit?: number
}): Promise<ReleasedLectureEmbeddingHit[]> {
  const limit = Math.max(1, Math.min(12, args.limit ?? 5))
  const rows = (await sql`
    SELECT
      de.content,
      de.source,
      de.week_number,
      de.page_number,
      1 - (de.embedding <=> ${args.vectorString}::vector) AS similarity
    FROM document_embeddings de
    WHERE de.embedding IS NOT NULL
      AND (
        (de.metadata->>'courseId')::int = ${args.courseId}
        OR (de.metadata->>'course_id')::int = ${args.courseId}
      )
      AND COALESCE(de.source, '') NOT ILIKE '%unpublished%'
      AND COALESCE(de.source, '') NOT ILIKE '%draft%'
      AND COALESCE(de.source_type, '') NOT ILIKE '%draft%'
      AND EXISTS (
        SELECT 1
        FROM lectures l
        WHERE l.course_id = ${args.courseId}
          AND COALESCE(l.is_published, TRUE) IS NOT FALSE
          AND (
            NULLIF(de.metadata->>'lectureId', '')::int = l.id
            OR NULLIF(de.metadata->>'lecture_id', '')::int = l.id
          )
      )
    ORDER BY de.embedding <=> ${args.vectorString}::vector
    LIMIT ${limit}
  `) as Array<{
    content: unknown
    source: unknown
    week_number: unknown
    page_number: unknown
    similarity: unknown
  }>

  return rows.map((row) => ({
    content: String(row.content ?? ""),
    source: row.source != null ? String(row.source) : null,
    week_number: row.week_number != null ? Number(row.week_number) : null,
    page_number: row.page_number != null ? Number(row.page_number) : null,
    similarity: Number(row.similarity ?? 0),
  }))
}
