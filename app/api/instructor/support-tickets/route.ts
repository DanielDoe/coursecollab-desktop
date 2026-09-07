import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { ensureSystemLogsSchema } from "@/lib/ensure-system-logs-schema"
import { loadInstructorActor } from "@/lib/instructor-actor-scope"
import {
  logSupportTicketToSystemLog,
  mapGroupStatusToTicketStatus,
} from "@/lib/system-log-support-ticket"

export const dynamic = "force-dynamic"

async function requireInstructor(request: NextRequest) {
  const instructorIdRaw = request.headers.get("x-instructor-id")
  if (!instructorIdRaw) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  const instructorId = Number(instructorIdRaw)
  if (!Number.isFinite(instructorId)) {
    return { ok: false as const, response: NextResponse.json({ error: "Invalid instructor id" }, { status: 400 }) }
  }
  const actor = await loadInstructorActor(instructorId)
  if (!actor || actor.role === "ta") {
    return { ok: false as const, response: NextResponse.json({ error: "Instructor access required" }, { status: 403 }) }
  }
  return { ok: true as const, instructorId, actor }
}

function mapTicketRow(row: Record<string, unknown>) {
  const meta = (row.metadata ?? {}) as Record<string, unknown>
  const groupStatus = row.group_status as string | null
  return {
    id: String(meta.ticketId ?? row.log_id ?? row.id),
    subject: String(meta.subject ?? row.error_message ?? row.title ?? "Support ticket"),
    description: String(row.description ?? ""),
    category: String(meta.category ?? "general"),
    priority: String(meta.priority ?? "medium"),
    status: mapGroupStatusToTicketStatus(groupStatus),
    moduleId: meta.moduleId != null ? String(meta.moduleId) : null,
    moduleLabel: meta.moduleLabel != null ? String(meta.moduleLabel) : null,
    attachments: Array.isArray(meta.attachments) ? meta.attachments : [],
    createdAt: row.created_at,
    updatedAt: row.group_updated_at ?? row.created_at,
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireInstructor(request)
    if (!auth.ok) return auth.response

    const category = new URL(request.url).searchParams.get("category")?.trim() || null

    await ensureSystemLogsSchema()

    const rows = await sql`
      SELECT
        l.id,
        l.log_id,
        l.title,
        l.description,
        l.error_message,
        l.metadata,
        l.created_at,
        g.status AS group_status,
        g.updated_at AS group_updated_at
      FROM system_logs l
      LEFT JOIN system_log_groups g ON g.id = l.group_id
      WHERE l.metadata->>'source' = 'instructor_support_ticket'
        AND l.metadata->>'instructorId' = ${String(auth.instructorId)}
        AND (${category}::text IS NULL OR l.metadata->>'category' = ${category})
      ORDER BY l.created_at DESC
      LIMIT 100
    `

    return NextResponse.json({ tickets: rows.map((row) => mapTicketRow(row as Record<string, unknown>)) })
  } catch (error) {
    console.error("[instructor/support-tickets] GET failed", error)
    return NextResponse.json({ error: "Failed to fetch support tickets" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireInstructor(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const subject = String(body.subject ?? "").trim()
    const description = String(body.description ?? body.message ?? "").trim()
    const category = String(body.category ?? "general").trim() || "general"
    const priority = String(body.priority ?? "medium").trim() || "medium"
    const courseIdRaw = body.courseId
    const courseId =
      courseIdRaw != null && Number.isFinite(Number(courseIdRaw)) ? Number(courseIdRaw) : null
    const moduleId = body.moduleId != null ? String(body.moduleId).trim() || null : null
    const moduleName = body.moduleName != null ? String(body.moduleName).trim() || null : null
    const attachments = Array.isArray(body.attachments) ? body.attachments : []

    if (!subject || !description) {
      return NextResponse.json({ error: "Subject and description are required" }, { status: 400 })
    }

    let courseName: string | null = null
    if (courseId != null) {
      const courseRows = await sql`
        SELECT course_code, course_title
        FROM courses
        WHERE id = ${courseId} AND instructor_id = ${auth.instructorId}
        LIMIT 1
      `
      if (courseRows.length === 0) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 })
      }
      const course = courseRows[0] as { course_code: string; course_title: string }
      courseName = course.course_title ?? course.course_code
    }

    const { ticketId, logId } = await logSupportTicketToSystemLog({
      studentDbId: null,
      courseId,
      courseName,
      subject,
      description,
      category,
      priority,
      audience: "instructor",
      instructorId: auth.instructorId,
      instructorName: auth.actor.name ?? auth.actor.username,
      moduleId,
      moduleName,
      attachments,
    })

    return NextResponse.json({
      success: true,
      message: "Submitted — we'll review your message and respond soon.",
      ticket: {
        id: ticketId,
        logId,
        subject,
        description,
        category,
        priority,
        status: "open",
      },
    })
  } catch (error) {
    console.error("[instructor/support-tickets] POST failed", error)
    return NextResponse.json({ error: "Failed to submit support ticket" }, { status: 500 })
  }
}
