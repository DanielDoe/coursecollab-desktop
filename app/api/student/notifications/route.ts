
import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { ensureNotificationAiSummaryColumns } from "@/lib/ensure-notification-ai-summary"
import { backfillStudentNotificationSummaries } from "@/lib/notification-ai-summary"
import {
  filterPreCourseNotifications,
  isPreCourseStudent,
} from "@/lib/student-course-access-gate"

// Use Node runtime for database operations
export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export const runtime = "nodejs"

// Cache for 10 seconds to reduce database load from polling
export const revalidate = 10


// In-memory rate limiting — return cached payload on rapid repeats (React strict-mode double mount)
const lastFetchTime = new Map<string, number>()
const lastFetchPayload = new Map<string, { notifications: unknown[]; unread_count: number }>()
const THROTTLE_MS = 3000

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    const internalStudentId = auth.studentDbId
    const cacheKey = String(internalStudentId)

    const now = Date.now()
    const lastFetch = lastFetchTime.get(cacheKey)
    if (lastFetch && now - lastFetch < THROTTLE_MS) {
      const cached = lastFetchPayload.get(cacheKey)
      if (cached) {
        return NextResponse.json(cached)
      }
      return NextResponse.json({ throttled: true }, { status: 429 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const unreadOnly = searchParams.get("unread_only") === "true"

    await ensureNotificationAiSummaryColumns()
    void backfillStudentNotificationSummaries(internalStudentId, 8).catch((error) => {
      console.warn("[Notifications] ai_summary backfill:", error)
    })

    try {
      const result = unreadOnly
        ? await sql`
            SELECT 
              id, type, title, message, link, ai_summary, is_read, created_at, read_at,
              COUNT(*) OVER() as total_unread
            FROM notifications
            WHERE student_id = ${internalStudentId} AND is_read = FALSE
            ORDER BY created_at DESC
            LIMIT ${limit}
          `
        : await sql`
            SELECT 
              n.id, n.type, n.title, n.message, n.link, n.ai_summary, n.is_read, n.created_at, n.read_at,
              (SELECT COUNT(*) FROM notifications WHERE student_id = ${internalStudentId} AND is_read = FALSE) as total_unread
            FROM notifications n
            WHERE n.student_id = ${internalStudentId}
            ORDER BY n.created_at DESC
            LIMIT ${limit}
          `

      const notifications = result.map(({ total_unread, ...notification }) => notification)
      let visibleNotifications = notifications
      if (await isPreCourseStudent(internalStudentId)) {
        visibleNotifications = filterPreCourseNotifications(notifications)
      }
      const unreadCount = visibleNotifications.filter(
        (n) => (n as { is_read?: boolean }).is_read === false,
      ).length

      const payload = { notifications: visibleNotifications, unread_count: unreadCount }
      lastFetchTime.set(cacheKey, now)
      lastFetchPayload.set(cacheKey, payload)

      return NextResponse.json(payload)
    } catch (dbError: any) {
      // If notifications table doesn't exist, return empty results
      if (dbError?.code === "42P01") {
        return NextResponse.json({
          notifications: [],
          unread_count: 0,
        })
      }
      throw dbError
    }
  } catch (error) {
    console.error("[Notifications] Failed to fetch:", error)
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    const internalStudentId = auth.studentDbId

    const body = await request.json()
    const { notification_id, mark_all_read, dismiss } = body

    try {
      if (dismiss && notification_id) {
        const result = await sql`
          DELETE FROM notifications
          WHERE id = ${notification_id} AND student_id = ${internalStudentId}
          RETURNING id, is_read
        `
        if (result.length === 0) {
          return NextResponse.json({ error: "Notification not found" }, { status: 404 })
        }
        return NextResponse.json({
          success: true,
          message: "Notification dismissed",
          was_unread: result[0].is_read === false,
        })
      } else if (mark_all_read) {
        const result = await sql`
          UPDATE notifications
          SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
          WHERE student_id = ${internalStudentId} AND is_read = FALSE
          RETURNING id
        `
        return NextResponse.json({ success: true, message: "All notifications marked as read", count: result.length })
      } else if (notification_id) {
        const result = await sql`
          UPDATE notifications
          SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
          WHERE id = ${notification_id} AND student_id = ${internalStudentId}
          RETURNING id
        `
        void (async () => {
          try {
            const { markInterventionsViewedForStudent, listOpenInterventionsForStudent } = await import(
              "@/lib/institutions/interventions"
            )
            const open = await listOpenInterventionsForStudent(internalStudentId)
            if (open.length > 0) {
              await markInterventionsViewedForStudent(
                internalStudentId,
                open.slice(0, 1).map((row) => row.id),
              )
            }
          } catch {
            /* non-blocking */
          }
        })()
        return NextResponse.json({ success: true, message: "Notification marked as read" })
      } else {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 })
      }
    } catch (dbError: any) {
      // If notifications table doesn't exist, return success silently
      if (dbError?.code === "42P01") {
        return NextResponse.json({ success: true, message: "Notifications not configured" })
      }
      throw dbError
    }
  } catch (error) {
    console.error("[Notifications] Failed to update:", error)
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 })
  }
}
