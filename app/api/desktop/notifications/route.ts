import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { resolveInstructorIdFromSessionProof } from "@/lib/instructor-session-auth"
import {
  ensureInstructorNotificationOwnershipColumns,
  instructorNotificationOwnershipSqlFragment,
} from "@/lib/ensure-instructor-notification-ownership"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type FeedRow = {
  id: number
  type: string
  title: string
  message: string
  link: string | null
  is_read: boolean
  created_at: string
  source_name?: string | null
}

function parseSinceParam(raw: string | null): Date | null {
  if (!raw?.trim()) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

async function studentFeed(studentDbId: number, since: Date | null, limit: number): Promise<FeedRow[]> {
  const rows = since
    ? await sql`
        SELECT id, type, title, message, link, is_read, created_at
        FROM notifications
        WHERE student_id = ${studentDbId}
          AND created_at > ${since.toISOString()}
        ORDER BY created_at ASC
        LIMIT ${limit}
      `
    : await sql`
        SELECT id, type, title, message, link, is_read, created_at
        FROM notifications
        WHERE student_id = ${studentDbId}
          AND is_read = FALSE
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
  return rows as FeedRow[]
}

/**
 * Scoped to the calling instructor. This previously selected the whole table, so
 * every faculty member received OS notification-center banners for every other
 * faculty member's student questions and submissions.
 */
async function instructorFeed(
  instructorId: number,
  courseId: number | null,
  since: Date | null,
  limit: number,
): Promise<FeedRow[]> {
  await ensureInstructorNotificationOwnershipColumns()
  const ownedBy = instructorNotificationOwnershipSqlFragment("n", instructorId, courseId)

  const rows = since
    ? await sql`
        SELECT n.id, n.type, n.title, n.message, n.link, n.is_read, n.created_at
        FROM instructor_notifications n
        WHERE n.created_at > ${since.toISOString()} AND ${ownedBy}
        ORDER BY n.created_at ASC
        LIMIT ${limit}
      `
    : await sql`
        SELECT n.id, n.type, n.title, n.message, n.link, n.is_read, n.created_at
        FROM instructor_notifications n
        WHERE n.is_read = FALSE AND ${ownedBy}
        ORDER BY n.created_at DESC
        LIMIT ${limit}
      `
  return rows as FeedRow[]
}

async function adminFeed(adminId: number, since: Date | null, limit: number): Promise<FeedRow[]> {
  const rows = since
    ? await sql`
        SELECT id, type, title, message, link, is_read, created_at
        FROM admin_notifications
        WHERE admin_id = ${adminId}
          AND created_at > ${since.toISOString()}
        ORDER BY created_at ASC
        LIMIT ${limit}
      `
    : await sql`
        SELECT id, type, title, message, link, is_read, created_at
        FROM admin_notifications
        WHERE admin_id = ${adminId}
          AND is_read = FALSE
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
  return rows as FeedRow[]
}

/** Lightweight notification poll for the desktop shell (since-cursor for OS alerts). */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const since = parseSinceParam(searchParams.get("since"))
    const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get("limit") || "20", 10)))

    const studentAuth = await requireCallerStudentDbId(request)
    if (studentAuth.ok) {
      const notifications = await studentFeed(studentAuth.studentDbId, since, limit)
      return NextResponse.json({ portal: "student", notifications })
    }

    const instructorId = await resolveInstructorIdFromSessionProof(request)
    if (instructorId != null) {
      const rawCourseId = Number(request.headers.get("x-course-id"))
      const courseId = Number.isFinite(rawCourseId) && rawCourseId > 0 ? Math.trunc(rawCourseId) : null
      const notifications = await instructorFeed(instructorId, courseId, since, limit)
      return NextResponse.json({ portal: "faculty", notifications })
    }

    const adminId = Number(request.headers.get("x-admin-id"))
    if (Number.isFinite(adminId) && adminId > 0) {
      // NOTE: admin identity here is header-asserted, matching /api/admin/notifications.
      // Tighten both together when admin sessions gain a server-side proof.
      const notifications = await adminFeed(adminId, since, limit)
      return NextResponse.json({ portal: "admin", notifications })
    }

    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  } catch (error) {
    console.error("[desktop/notifications]", error)
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
  }
}
