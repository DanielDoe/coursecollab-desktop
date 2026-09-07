import { getSQL } from "@/lib/db"
import { hasLectureSessionAccessTable } from "@/lib/instructor-default-courses"

type Sql = ReturnType<typeof getSQL>

/**
 * Review ELEG 1304 often cloned quizzes from live ELEG (no decks) and skipped
 * later lecture clones. Copy published ECE review decks onto the ELEG course
 * when that course has none.
 */
export async function ensureElegReviewLecturesFromEce(params: {
  sql: Sql
  elegCourseId: number
  eceCourseId: number
  elegSessionId?: number | null
}): Promise<{ copied: number; skipped: boolean }> {
  const { sql, elegCourseId, eceCourseId, elegSessionId } = params
  if (!Number.isFinite(elegCourseId) || !Number.isFinite(eceCourseId)) {
    return { copied: 0, skipped: true }
  }

  const existing = (await sql`
    SELECT COUNT(*)::int AS count
    FROM lectures
    WHERE course_id = ${elegCourseId}
      AND deleted_at IS NULL
      AND COALESCE(is_published, true) IS NOT DISTINCT FROM TRUE
  `) as { count: number }[]
  if (Number(existing[0]?.count ?? 0) > 0) {
    return { copied: 0, skipped: true }
  }

  const srcLectures = (await sql`
    SELECT id
    FROM lectures
    WHERE course_id = ${eceCourseId}
      AND deleted_at IS NULL
      AND COALESCE(is_published, true) IS NOT DISTINCT FROM TRUE
    ORDER BY week ASC, id ASC
  `) as { id: number }[]

  let copied = 0
  const hasLsa = await hasLectureSessionAccessTable()

  for (const { id: oldLecId } of srcLectures) {
    const inserted = (await sql`
      INSERT INTO lectures (
        week, title, session, description, materials_url, professor_notes, lecture_summary,
        learning_objectives, is_published, created_by, session_access, course_id, section_id,
        original_file_url, original_file_type, pdf_url, thumbnail_url, content_mode,
        allow_download, sample_practice, lecture_workspace
      )
      SELECT
        week, title, session, description, materials_url, professor_notes, lecture_summary,
        learning_objectives, is_published, created_by, NULL, ${elegCourseId}, NULL,
        original_file_url, original_file_type, pdf_url, thumbnail_url, content_mode,
        allow_download, sample_practice, lecture_workspace
      FROM lectures
      WHERE id = ${oldLecId}
      RETURNING id
    `) as { id: number }[]
    const newLecId = inserted[0]?.id
    if (!newLecId) continue

    await sql`
      INSERT INTO lecture_slides (
        lecture_id, content_type, title, content, file_url, slide_order, is_active,
        created_by, subtitle, background_gradient, ai_summary, ai_keywords
      )
      SELECT
        ${newLecId}, content_type, title, content, file_url, slide_order, is_active,
        created_by, subtitle, background_gradient, ai_summary, ai_keywords
      FROM lecture_slides
      WHERE lecture_id = ${oldLecId} AND deleted_at IS NULL
    `

    if (hasLsa && elegSessionId != null && Number.isFinite(elegSessionId)) {
      try {
        await sql`
          INSERT INTO lecture_session_access (lecture_id, session_id, is_active, updated_at)
          VALUES (${newLecId}, ${elegSessionId}, true, NOW())
        `
      } catch (error) {
        console.warn(
          `[ELEG lecture copy] session access skipped for lecture ${newLecId}:`,
          error instanceof Error ? error.message : error,
        )
      }
    }
    copied += 1
  }

  return { copied, skipped: false }
}
