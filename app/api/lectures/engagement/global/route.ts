import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sanitizeCommentForStudent, sanitizePeerForStudent } from "@/lib/student-privacy"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"

export const dynamic = "force-dynamic"

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function buildWeeklyViews(rows: Array<{ day: Date | string; views: number }>) {
  const byDay = new Map<string, number>()
  for (const row of rows) {
    const key = new Date(row.day).toISOString().slice(0, 10)
    byDay.set(key, Number(row.views) || 0)
  }

  const result: { label: string; views: number; dateKey: string }[] = []
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    const dateKey = d.toISOString().slice(0, 10)
    result.push({
      label: DAY_LABELS[d.getDay()] ?? "",
      views: byDay.get(dateKey) ?? 0,
      dateKey,
    })
  }
  return result
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const session = searchParams.get("session")
    const studentRosterId = searchParams.get("studentId")?.trim() || null
    const viewer = await requireCallerStudentDbId(request)
    const viewerDatabaseId = viewer.ok ? String(viewer.studentDbId) : null

    if (!session) {
      return NextResponse.json({ error: "Session is required" }, { status: 400 })
    }

    const safeSession = session.replace(/'/g, "''")
    const sessionFilter = sql.unsafe(
      `(l.session_access IS NULL OR '${safeSession}' = ANY(l.session_access))`,
    )

    const [
      topMaterials,
      topCommentsRaw,
      weeklyViewsRaw,
      recentReadersRaw,
      classWeekProgress,
      sessionPulse,
      stats,
    ] = await Promise.all([
      sql`
      SELECT 
        lm.id,
        lm.lecture_id,
        lm.file_url,
        lm.title,
        lm.view_count,
        l.title as lecture_title,
        l.week
      FROM lecture_materials lm
      JOIN lectures l ON lm.lecture_id = l.id
      WHERE l.is_published = true
        AND l.deleted_at IS NULL
        AND ${sessionFilter}
      ORDER BY lm.view_count DESC
      LIMIT 5
    `,
      sql`
      SELECT 
        lc.id,
        lc.lecture_id,
        lc.student_id,
        lc.comment,
        lc.likes,
        lc.created_at,
        s.full_name as student_name,
        l.title as lecture_title,
        l.week
      FROM lecture_comments lc
      JOIN students s ON lc.student_id = s.id
      JOIN lectures l ON lc.lecture_id = l.id
      WHERE l.is_published = true
        AND l.deleted_at IS NULL
        AND ${sessionFilter}
      ORDER BY lc.likes DESC
      LIMIT 5
    `,
      sql`
      SELECT DATE(lv.viewed_at) AS day, COUNT(*)::int AS views
      FROM lecture_views lv
      INNER JOIN lectures l ON l.id = lv.lecture_id
      WHERE l.is_published = true
        AND l.deleted_at IS NULL
        AND ${sessionFilter}
        AND lv.viewed_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(lv.viewed_at)
      ORDER BY day ASC
    `,
      sql`
      SELECT
        s.id AS student_id,
        s.full_name,
        l.week,
        l.title AS lecture_title,
        COALESCE(lsp.progress_percentage, 0)::int AS progress_percentage,
        lsp.status,
        lsp.last_accessed
      FROM lecture_student_progress lsp
      INNER JOIN students s ON s.id = lsp.student_id
      INNER JOIN lectures l ON l.id = lsp.lecture_id
      WHERE l.is_published = true
        AND l.deleted_at IS NULL
        AND ${sessionFilter}
        AND lsp.last_accessed >= NOW() - INTERVAL '45 minutes'
        AND lsp.status IN ('in_progress', 'completed')
      ORDER BY lsp.last_accessed DESC
      LIMIT 12
    `,
      sql`
      SELECT
        l.week,
        COUNT(*) FILTER (WHERE lsp.status = 'completed')::int AS completed_count,
        COUNT(*) FILTER (WHERE lsp.status = 'in_progress')::int AS in_progress_count
      FROM lectures l
      LEFT JOIN lecture_student_progress lsp ON lsp.lecture_id = l.id
      WHERE l.is_published = true
        AND l.deleted_at IS NULL
        AND ${sessionFilter}
      GROUP BY l.week
      ORDER BY l.week ASC
    `,
      sql`
      SELECT
        (
          SELECT COUNT(DISTINCT lsp.student_id)::int
          FROM lecture_student_progress lsp
          INNER JOIN lectures l ON l.id = lsp.lecture_id
          WHERE l.is_published = true
            AND l.deleted_at IS NULL
            AND ${sessionFilter}
            AND lsp.last_accessed >= NOW() - INTERVAL '15 minutes'
            AND lsp.status = 'in_progress'
        ) AS currently_reading,
        (
          SELECT COUNT(DISTINCT lv.student_id)::int
          FROM lecture_views lv
          INNER JOIN lectures l ON l.id = lv.lecture_id
          WHERE l.is_published = true
            AND l.deleted_at IS NULL
            AND ${sessionFilter}
        ) AS active_students
    `,
      studentRosterId
      ? sql`
          SELECT
            (
              SELECT COUNT(*)::int
              FROM lecture_views lv
              INNER JOIN lectures l ON l.id = lv.lecture_id
              INNER JOIN students s ON s.id = lv.student_id
              WHERE s.student_id = ${studentRosterId}
                AND l.is_published = true
                AND l.deleted_at IS NULL
                AND ${sessionFilter}
            ) AS total_views,
            (
              SELECT COUNT(*)::int
              FROM lecture_comments lc
              INNER JOIN lectures l ON l.id = lc.lecture_id
              INNER JOIN students s ON s.id = lc.student_id
              WHERE s.student_id = ${studentRosterId}
                AND l.is_published = true
                AND l.deleted_at IS NULL
                AND ${sessionFilter}
            ) AS total_comments,
            (
              SELECT COUNT(*)::int
              FROM lecture_bookmarks lb
              INNER JOIN lectures l ON l.id = lb.lecture_id
              INNER JOIN students s ON s.id = lb.student_id
              WHERE s.student_id = ${studentRosterId}
                AND l.is_published = true
                AND l.deleted_at IS NULL
                AND ${sessionFilter}
            ) AS total_bookmarks,
            (
              SELECT COUNT(*)::int
              FROM lecture_student_progress lsp
              INNER JOIN lectures l ON l.id = lsp.lecture_id
              INNER JOIN students s ON s.id = lsp.student_id
              WHERE s.student_id = ${studentRosterId}
                AND lsp.status = 'in_progress'
                AND l.is_published = true
                AND l.deleted_at IS NULL
                AND ${sessionFilter}
            ) AS lectures_in_progress,
            (
              SELECT COUNT(*)::int
              FROM lecture_student_progress lsp
              INNER JOIN lectures l ON l.id = lsp.lecture_id
              INNER JOIN students s ON s.id = lsp.student_id
              WHERE s.student_id = ${studentRosterId}
                AND lsp.status = 'completed'
                AND l.is_published = true
                AND l.deleted_at IS NULL
                AND ${sessionFilter}
            ) AS lectures_completed,
            (
              SELECT COALESCE(SUM(jsonb_array_length(lsp.completed_slides::jsonb)), 0)::int
              FROM lecture_student_progress lsp
              INNER JOIN lectures l ON l.id = lsp.lecture_id
              INNER JOIN students s ON s.id = lsp.student_id
              WHERE s.student_id = ${studentRosterId}
                AND l.is_published = true
                AND l.deleted_at IS NULL
                AND ${sessionFilter}
            ) AS slides_viewed
        `
      : sql`
          SELECT
            (
              SELECT COUNT(*)::int
              FROM lecture_views lv
              INNER JOIN lectures l ON l.id = lv.lecture_id
              WHERE l.is_published = true
                AND l.deleted_at IS NULL
                AND ${sessionFilter}
            ) AS total_views,
            (
              SELECT COUNT(*)::int
              FROM lecture_comments lc
              INNER JOIN lectures l ON l.id = lc.lecture_id
              WHERE l.is_published = true
                AND l.deleted_at IS NULL
                AND ${sessionFilter}
            ) AS total_comments,
            (
              SELECT COUNT(*)::int
              FROM lecture_bookmarks lb
              INNER JOIN lectures l ON l.id = lb.lecture_id
              WHERE l.is_published = true
                AND l.deleted_at IS NULL
                AND ${sessionFilter}
            ) AS total_bookmarks
        `,
    ])

    const pulse = sessionPulse[0] ?? { currently_reading: 0, active_students: 0 }
    const mergedStats = {
      ...(stats[0] || {
        total_views: 0,
        total_comments: 0,
        total_bookmarks: 0,
      }),
      currently_reading: Number(pulse.currently_reading) || 0,
      active_students: Number(pulse.active_students) || 0,
    }

    const topComments = viewerDatabaseId
      ? (topCommentsRaw || []).map((comment: Record<string, unknown>) =>
          sanitizeCommentForStudent(comment, viewerDatabaseId)
        )
      : topCommentsRaw

    const recentReaders = viewerDatabaseId
      ? (recentReadersRaw || []).map((row: Record<string, unknown>) => {
          const peer = sanitizePeerForStudent(
            { id: row.student_id, full_name: row.full_name as string | undefined },
            viewerDatabaseId
          )
          return {
            display_label: peer.display_label,
            is_current_user: peer.is_current_user,
            week: Number(row.week) || 0,
            lecture_title: row.lecture_title as string,
            progress_percentage: Number(row.progress_percentage) || 0,
            status: row.status as string,
            last_accessed: row.last_accessed as string,
          }
        })
      : (recentReadersRaw || []).map((row: Record<string, unknown>) => ({
          display_label: "Student",
          is_current_user: false,
          week: Number(row.week) || 0,
          lecture_title: row.lecture_title as string,
          progress_percentage: Number(row.progress_percentage) || 0,
          status: row.status as string,
          last_accessed: row.last_accessed as string,
        }))

    return NextResponse.json({
      topMaterials: topMaterials || [],
      topComments: topComments || [],
      stats: mergedStats,
      weeklyViews: buildWeeklyViews(weeklyViewsRaw as Array<{ day: Date | string; views: number }>),
      recentReaders,
      classWeekProgress: (classWeekProgress || []).map((row: Record<string, unknown>) => ({
        week: Number(row.week) || 0,
        completed: Number(row.completed_count) || 0,
        active: Number(row.in_progress_count) || 0,
      })),
    })
  } catch (error) {
    console.error("Failed to fetch global engagement:", error)
    return NextResponse.json({ error: "Failed to fetch engagement data" }, { status: 500 })
  }
}
