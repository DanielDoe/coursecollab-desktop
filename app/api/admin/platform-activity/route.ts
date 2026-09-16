import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { isClientPlatformId } from "@/lib/client-platform"
import { ensurePlatformActivitySchema } from "@/lib/ensure-platform-activity-schema"
import { sql } from "@/lib/db"
import type { PlatformActivityRow } from "@/lib/platform-activity-constants"

export const dynamic = "force-dynamic"

function parseDateParam(value: string | null, endOfDay: boolean): Date | null {
  if (!value?.trim()) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  if (endOfDay) d.setHours(23, 59, 59, 999)
  else d.setHours(0, 0, 0, 0)
  return d
}

/** Resolved client surface for filtering (metadata first, else UA heuristics). */
const CLIENT_PLATFORM_SQL = sql.unsafe(`
  COALESCE(
    NULLIF(LOWER(TRIM(l.metadata->>'clientPlatform')), ''),
    CASE
      WHEN l.user_agent ILIKE '%CourseCollab-Native%'
        OR l.user_agent ILIKE '%com.coursecollab.app%'
        OR l.user_agent ILIKE '%ExpoBundle%'
        OR LOWER(l.user_agent) LIKE '%okhttp%'
        THEN 'mobile'
      WHEN LOWER(l.user_agent) LIKE '%electron%'
        OR LOWER(l.user_agent) LIKE '%coursecollab-desktop%'
        THEN 'desktop'
      ELSE 'web'
    END
  )
`)

export async function GET(request: NextRequest) {
  const auth = await requireAdminId(request)
  if (!auth.ok) return auth.response

  try {
    await ensurePlatformActivitySchema()

    const { searchParams } = new URL(request.url)
    const portal = searchParams.get("portal")
    const category = searchParams.get("category")
    const action = searchParams.get("action")
    const clientPlatformParam = searchParams.get("clientPlatform")
    const search = searchParams.get("search")?.trim() ?? ""
    const successParam = searchParams.get("success")
    const dateFrom = parseDateParam(searchParams.get("dateFrom"), false)
    const dateTo = parseDateParam(searchParams.get("dateTo"), true)
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 500)
    const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0)

    const portalFilter = portal && portal !== "all" ? portal : null
    const categoryFilter = category && category !== "all" ? category : null
    const actionFilter = action && action !== "all" ? action : null
    const clientPlatformFilter =
      clientPlatformParam && isClientPlatformId(clientPlatformParam) ? clientPlatformParam : null
    const successFilter =
      successParam === "true" ? true : successParam === "false" ? false : null
    const searchPattern = search ? `%${search}%` : null

    const [countRow] = await sql`
      SELECT COUNT(*)::int AS total
      FROM platform_activity_logs l
      LEFT JOIN students s
        ON l.actor_type = 'student'
       AND s.deleted_at IS NULL
       AND (
         l.actor_id = s.id
         OR TRIM(s.student_id) = TRIM(l.actor_id::text)
       )
      WHERE (${portalFilter}::text IS NULL OR l.portal = ${portalFilter})
        AND (${categoryFilter}::text IS NULL OR l.category = ${categoryFilter})
        AND (${actionFilter}::text IS NULL OR l.action = ${actionFilter})
        AND (${clientPlatformFilter}::text IS NULL OR ${CLIENT_PLATFORM_SQL} = ${clientPlatformFilter})
        AND (${successFilter}::boolean IS NULL OR l.success = ${successFilter})
        AND (${dateFrom}::timestamptz IS NULL OR l.created_at >= ${dateFrom})
        AND (${dateTo}::timestamptz IS NULL OR l.created_at <= ${dateTo})
        AND (
          ${searchPattern}::text IS NULL
          OR l.actor_label ILIKE ${searchPattern}
          OR l.actor_email ILIKE ${searchPattern}
          OR l.summary ILIKE ${searchPattern}
          OR l.action ILIKE ${searchPattern}
          OR l.path ILIKE ${searchPattern}
          OR s.full_name ILIKE ${searchPattern}
          OR s.student_id ILIKE ${searchPattern}
          OR s.email ILIKE ${searchPattern}
          OR l.metadata->>'studentId' ILIKE ${searchPattern}
          OR l.metadata->>'fullName' ILIKE ${searchPattern}
        )
    `

    const rows = await sql`
      SELECT
        l.id,
        l.portal,
        l.actor_type,
        l.actor_id,
        COALESCE(
          NULLIF(l.actor_label, TRIM(s.student_id)),
          NULLIF(l.actor_label, TRIM(l.actor_id::text)),
          s.full_name,
          NULLIF(l.metadata->>'fullName', ''),
          i.name,
          au.username
        ) AS actor_label,
        COALESCE(l.actor_email, s.email, i.email) AS actor_email,
        COALESCE(s.student_id, NULLIF(l.metadata->>'studentId', '')) AS actor_student_id,
        l.action,
        l.category,
        l.entity_type,
        l.entity_id,
        l.course_id,
        l.path,
        l.method,
        l.success,
        l.summary,
        l.metadata,
        l.ip_address,
        l.user_agent,
        l.created_at
      FROM platform_activity_logs l
      LEFT JOIN students s
        ON l.actor_type = 'student'
       AND s.deleted_at IS NULL
       AND (
         l.actor_id = s.id
         OR TRIM(s.student_id) = TRIM(l.actor_id::text)
       )
      LEFT JOIN instructors i
        ON l.actor_type = 'instructor'
       AND l.actor_id = i.id
      LEFT JOIN admin_users au
        ON l.actor_type = 'admin'
       AND l.actor_id = au.id
      WHERE (${portalFilter}::text IS NULL OR l.portal = ${portalFilter})
        AND (${categoryFilter}::text IS NULL OR l.category = ${categoryFilter})
        AND (${actionFilter}::text IS NULL OR l.action = ${actionFilter})
        AND (${clientPlatformFilter}::text IS NULL OR ${CLIENT_PLATFORM_SQL} = ${clientPlatformFilter})
        AND (${successFilter}::boolean IS NULL OR l.success = ${successFilter})
        AND (${dateFrom}::timestamptz IS NULL OR l.created_at >= ${dateFrom})
        AND (${dateTo}::timestamptz IS NULL OR l.created_at <= ${dateTo})
        AND (
          ${searchPattern}::text IS NULL
          OR l.actor_label ILIKE ${searchPattern}
          OR l.actor_email ILIKE ${searchPattern}
          OR l.summary ILIKE ${searchPattern}
          OR l.action ILIKE ${searchPattern}
          OR l.path ILIKE ${searchPattern}
          OR s.full_name ILIKE ${searchPattern}
          OR s.student_id ILIKE ${searchPattern}
          OR s.email ILIKE ${searchPattern}
          OR l.metadata->>'studentId' ILIKE ${searchPattern}
          OR l.metadata->>'fullName' ILIKE ${searchPattern}
        )
      ORDER BY l.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [statsToday] = await sql`
      SELECT
        COUNT(*)::int AS total_today,
        COUNT(*) FILTER (WHERE category = 'auth' AND action = 'login_success')::int AS logins_today,
        COUNT(*) FILTER (WHERE success = false)::int AS failures_today
      FROM platform_activity_logs
      WHERE created_at >= ${todayStart}
    `

    const portalBreakdown = await sql`
      SELECT portal, COUNT(*)::int AS count
      FROM platform_activity_logs
      WHERE created_at >= ${todayStart}
      GROUP BY portal
      ORDER BY count DESC
    `

    const categoryBreakdown = await sql`
      SELECT category, COUNT(*)::int AS count
      FROM platform_activity_logs
      WHERE created_at >= ${todayStart}
      GROUP BY category
      ORDER BY count DESC
    `

    const distinctActions = await sql`
      SELECT DISTINCT action FROM platform_activity_logs ORDER BY action ASC LIMIT 100
    `

    return NextResponse.json({
      logs: rows as PlatformActivityRow[],
      total: (countRow as { total: number }).total ?? 0,
      limit,
      offset,
      stats: {
        today: statsToday,
        portalBreakdown,
        categoryBreakdown,
      },
      distinctActions: (distinctActions as { action: string }[]).map((r) => r.action),
    })
  } catch (error) {
    console.error("[admin/platform-activity]", error)
    return NextResponse.json({ error: "Failed to load activity logs" }, { status: 500 })
  }
}
