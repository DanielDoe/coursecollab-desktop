import { sql } from "@/lib/db"

export type LectureSlideViewScore = {
  lectureId: number
  openedSlides: number
  totalSlides: number
  ratio: number
  points: number
}

export type LectureSlideViewScoreOptions = {
  /** ISO week start (Monday); when set, only lectures touched that week are counted. */
  weekStartDate?: string
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Per-lecture slide view score: openedSlides / totalSlides (e.g. 30/40 → 0.75, 30 points of 40).
 * Uses slide_views, lecture_student_progress (slide order or legacy slide id), and PDF page progress.
 */
export async function getLectureSlideViewScores(
  studentId: number,
  options?: LectureSlideViewScoreOptions,
): Promise<LectureSlideViewScore[]> {
  const weekStart = options?.weekStartDate?.trim()

  const rows = weekStart
    ? await sql`
        WITH lecture_totals AS (
          SELECT
            l.id AS lecture_id,
            GREATEST(
              (
                SELECT COUNT(*)::int
                FROM lecture_slides ls
                WHERE ls.lecture_id = l.id
                  AND COALESCE(ls.is_active, TRUE) IS NOT FALSE
              ),
              0
            ) AS db_slide_total
          FROM lectures l
          WHERE l.deleted_at IS NULL
            AND COALESCE(l.is_published, TRUE) IS NOT FALSE
        ),
        progress_rows AS (
          SELECT
            lsp.lecture_id,
            COALESCE(jsonb_array_length(lsp.completed_slides::jsonb), 0)::int AS raw_opened,
            COALESCE(lsp.progress_percentage, 0)::float AS progress_percentage,
            COALESCE(lsp.last_viewed_slide_order, 0)::int AS last_viewed_slide_order,
            lsp.last_accessed
          FROM lecture_student_progress lsp
          WHERE lsp.student_id = ${studentId}
            AND DATE_TRUNC('week', lsp.last_accessed)::date = ${weekStart}::date
        ),
        progress_mapped AS (
          SELECT
            lsp.lecture_id,
            COUNT(DISTINCT ls.id)::int AS opened
          FROM lecture_student_progress lsp
          CROSS JOIN LATERAL jsonb_array_elements_text(lsp.completed_slides::jsonb) AS elem(value)
          JOIN lecture_slides ls
            ON ls.lecture_id = lsp.lecture_id
           AND (ls.slide_order = elem.value::int OR ls.id = elem.value::int)
          WHERE lsp.student_id = ${studentId}
            AND DATE_TRUNC('week', lsp.last_accessed)::date = ${weekStart}::date
          GROUP BY lsp.lecture_id
        ),
        slide_view_counts AS (
          SELECT
            ls.lecture_id,
            COUNT(DISTINCT sv.slide_id)::int AS opened
          FROM slide_views sv
          JOIN lecture_slides ls ON ls.id = sv.slide_id
          WHERE sv.student_id = ${studentId}
            AND DATE_TRUNC('week', sv.viewed_at)::date = ${weekStart}::date
          GROUP BY ls.lecture_id
        ),
        combined AS (
          SELECT
            lt.lecture_id,
            lt.db_slide_total,
            pr.progress_percentage,
            GREATEST(
              COALESCE(pm.opened, 0),
              COALESCE(svc.opened, 0),
              CASE WHEN lt.db_slide_total = 0 THEN COALESCE(pr.raw_opened, 0) ELSE 0 END,
              CASE
                WHEN lt.db_slide_total > 0 AND COALESCE(pr.progress_percentage, 0) > 0 THEN
                  GREATEST(1, ROUND(lt.db_slide_total * pr.progress_percentage / 100.0)::int)
                ELSE 0
              END,
              CASE
                WHEN lt.db_slide_total > 0 AND COALESCE(pr.last_viewed_slide_order, 0) > 0 THEN
                  LEAST(COALESCE(pr.last_viewed_slide_order, 0), lt.db_slide_total)
                ELSE 0
              END
            ) AS opened_slides
          FROM lecture_totals lt
          LEFT JOIN progress_rows pr ON pr.lecture_id = lt.lecture_id
          LEFT JOIN progress_mapped pm ON pm.lecture_id = lt.lecture_id
          LEFT JOIN slide_view_counts svc ON svc.lecture_id = lt.lecture_id
          WHERE COALESCE(pr.raw_opened, 0) > 0
             OR COALESCE(pm.opened, 0) > 0
             OR COALESCE(svc.opened, 0) > 0
             OR COALESCE(pr.progress_percentage, 0) > 0
             OR COALESCE(pr.last_viewed_slide_order, 0) > 0
        )
        SELECT
          lecture_id,
          opened_slides,
          CASE
            WHEN db_slide_total > 0 THEN db_slide_total
            WHEN progress_percentage > 0 AND opened_slides > 0 THEN
              GREATEST(
                opened_slides,
                ROUND(opened_slides * 100.0 / progress_percentage)::int
              )
            ELSE GREATEST(opened_slides, 1)
          END AS total_slides
        FROM combined
        WHERE opened_slides > 0
      `
    : await sql`
        WITH lecture_totals AS (
          SELECT
            l.id AS lecture_id,
            GREATEST(
              (
                SELECT COUNT(*)::int
                FROM lecture_slides ls
                WHERE ls.lecture_id = l.id
                  AND COALESCE(ls.is_active, TRUE) IS NOT FALSE
              ),
              0
            ) AS db_slide_total
          FROM lectures l
          WHERE l.deleted_at IS NULL
            AND COALESCE(l.is_published, TRUE) IS NOT FALSE
        ),
        progress_rows AS (
          SELECT
            lsp.lecture_id,
            COALESCE(jsonb_array_length(lsp.completed_slides::jsonb), 0)::int AS raw_opened,
            COALESCE(lsp.progress_percentage, 0)::float AS progress_percentage,
            COALESCE(lsp.last_viewed_slide_order, 0)::int AS last_viewed_slide_order
          FROM lecture_student_progress lsp
          WHERE lsp.student_id = ${studentId}
        ),
        progress_mapped AS (
          SELECT
            lsp.lecture_id,
            COUNT(DISTINCT ls.id)::int AS opened
          FROM lecture_student_progress lsp
          CROSS JOIN LATERAL jsonb_array_elements_text(lsp.completed_slides::jsonb) AS elem(value)
          JOIN lecture_slides ls
            ON ls.lecture_id = lsp.lecture_id
           AND (ls.slide_order = elem.value::int OR ls.id = elem.value::int)
          WHERE lsp.student_id = ${studentId}
          GROUP BY lsp.lecture_id
        ),
        slide_view_counts AS (
          SELECT
            ls.lecture_id,
            COUNT(DISTINCT sv.slide_id)::int AS opened
          FROM slide_views sv
          JOIN lecture_slides ls ON ls.id = sv.slide_id
          WHERE sv.student_id = ${studentId}
          GROUP BY ls.lecture_id
        ),
        combined AS (
          SELECT
            lt.lecture_id,
            lt.db_slide_total,
            pr.progress_percentage,
            GREATEST(
              COALESCE(pm.opened, 0),
              COALESCE(svc.opened, 0),
              CASE WHEN lt.db_slide_total = 0 THEN COALESCE(pr.raw_opened, 0) ELSE 0 END,
              CASE
                WHEN lt.db_slide_total > 0 AND COALESCE(pr.progress_percentage, 0) > 0 THEN
                  GREATEST(1, ROUND(lt.db_slide_total * pr.progress_percentage / 100.0)::int)
                ELSE 0
              END,
              CASE
                WHEN lt.db_slide_total > 0 AND COALESCE(pr.last_viewed_slide_order, 0) > 0 THEN
                  LEAST(COALESCE(pr.last_viewed_slide_order, 0), lt.db_slide_total)
                ELSE 0
              END
            ) AS opened_slides
          FROM lecture_totals lt
          LEFT JOIN progress_rows pr ON pr.lecture_id = lt.lecture_id
          LEFT JOIN progress_mapped pm ON pm.lecture_id = lt.lecture_id
          LEFT JOIN slide_view_counts svc ON svc.lecture_id = lt.lecture_id
          WHERE COALESCE(pr.raw_opened, 0) > 0
             OR COALESCE(pm.opened, 0) > 0
             OR COALESCE(svc.opened, 0) > 0
             OR COALESCE(pr.progress_percentage, 0) > 0
             OR COALESCE(pr.last_viewed_slide_order, 0) > 0
        )
        SELECT
          lecture_id,
          opened_slides,
          CASE
            WHEN db_slide_total > 0 THEN db_slide_total
            WHEN progress_percentage > 0 AND opened_slides > 0 THEN
              GREATEST(
                opened_slides,
                ROUND(opened_slides * 100.0 / progress_percentage)::int
              )
            ELSE GREATEST(opened_slides, 1)
          END AS total_slides
        FROM combined
        WHERE opened_slides > 0
      `

  return (rows as { lecture_id: number; opened_slides: number; total_slides: number }[]).map((row) => {
    const totalSlides = Math.max(1, Number(row.total_slides) || 0)
    const openedSlides = Math.min(totalSlides, Math.max(0, Number(row.opened_slides) || 0))
    const ratio = openedSlides / totalSlides
    return {
      lectureId: Number(row.lecture_id),
      openedSlides,
      totalSlides,
      ratio,
      points: round2(openedSlides),
    }
  })
}

/** Sum of per-lecture opened/total ratios (each lecture contributes up to 1.0). */
export async function calculateLectureSlideViewRatioSum(
  studentId: number,
  options?: LectureSlideViewScoreOptions,
): Promise<number> {
  const scores = await getLectureSlideViewScores(studentId, options)
  return round2(scores.reduce((sum, s) => sum + s.ratio, 0))
}

/** Engagement credits for lecture reading (max 20): one point per fully viewed lecture, partial credit by slide ratio. */
export async function calculateLectureReadingEngagementCredits(studentId: number): Promise<number> {
  const scores = await getLectureSlideViewScores(studentId)
  const ratioSum = scores.reduce((sum, s) => sum + s.ratio, 0)
  return round2(Math.min(ratioSum, 20))
}

/** Trade Center weekly reading points: one point per slide opened this week, capped by caller. */
export async function calculateWeeklyLectureReadingPoints(
  studentId: number,
  weekStartDate: string,
): Promise<number> {
  const scores = await getLectureSlideViewScores(studentId, { weekStartDate })
  const openedThisWeek = scores.reduce((sum, s) => sum + s.openedSlides, 0)
  return openedThisWeek
}

/** Record a single slide view (idempotent). */
export async function recordSlideView(slideId: number, studentDbId: number): Promise<void> {
  await sql`
    INSERT INTO slide_views (slide_id, student_id)
    VALUES (${slideId}, ${studentDbId})
    ON CONFLICT (slide_id, student_id) DO NOTHING
  `
}
