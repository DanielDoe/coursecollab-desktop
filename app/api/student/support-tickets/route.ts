import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { ensureSystemLogsSchema } from "@/lib/ensure-system-logs-schema"
import {
  logSupportTicketToSystemLog,
  mapGroupStatusToTicketStatus,
} from "@/lib/system-log-support-ticket"
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id"
import { loadInstructorActor } from "@/lib/instructor-actor-scope"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"

async function resolveStudentContext(studentDbId: number) {
  const rows = await sql`
    SELECT
      s.id,
      s.full_name,
      s.course_id,
      c.course_code,
      c.course_title
    FROM students s
    LEFT JOIN courses c ON c.id = s.course_id
    WHERE s.id = ${studentDbId}
    LIMIT 1
  `
  return rows[0] as
    | {
        id: number
        full_name: string | null
        course_id: number | null
        course_code: string | null
        course_title: string | null
      }
    | undefined
}

export async function GET(request: NextRequest) {
  try {
    const studentIdParam = new URL(request.url).searchParams.get("studentId")
    const category = new URL(request.url).searchParams.get("category")?.trim() || null
    const bound = await requireBoundStudentCaller(request, studentIdParam)
    if (!bound.ok) return bound.response
    const studentDbId = bound.studentDbId

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
      WHERE l.metadata->>'source' = 'student_support_ticket'
        AND l.metadata->>'studentDbId' = ${String(studentDbId)}
        AND (${category}::text IS NULL OR l.metadata->>'category' = ${category})
      ORDER BY l.created_at DESC
      LIMIT 100
    `

    const tickets = rows.map((row) => {
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
    })

    return NextResponse.json({ tickets })
  } catch (error) {
    console.error("[student/support-tickets] GET failed", error)
    return NextResponse.json({ error: "Failed to fetch support tickets" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const subject = String(body.subject ?? "").trim()
    const description = String(body.description ?? "").trim()
    const category = String(body.category ?? "general").trim() || "general"
    const priority = String(body.priority ?? "medium").trim() || "medium"
    const moduleId = body.moduleId != null ? String(body.moduleId).trim() || null : null
    const moduleName = body.moduleName != null ? String(body.moduleName).trim() || null : null
    const instructorIdRaw = body.instructorId
    const instructorId =
      instructorIdRaw != null && Number.isFinite(Number(instructorIdRaw)) ? Number(instructorIdRaw) : null
    const audience =
      body.audience === "guest" ? "guest" : instructorId != null ? "instructor" : "student"
    const rawStudentId = body.studentId
    const attachments = Array.isArray(body.attachments) ? body.attachments : []

    if (!subject || !description) {
      return NextResponse.json({ error: "Subject and description are required" }, { status: 400 })
    }

    let studentDbId: number | null = null
    let studentName: string | null = null
    let courseId: number | null = null
    let courseName: string | null = null
    let instructorName: string | null = null

    if (instructorId != null) {
      const actor = await loadInstructorActor(instructorId)
      instructorName = actor?.name ?? actor?.username ?? null
    }

    if (rawStudentId != null && String(rawStudentId).trim() !== "") {
      studentDbId = await resolveStudentDatabaseIdFromParam(String(rawStudentId))
      if (studentDbId) {
        const student = await resolveStudentContext(studentDbId)
        if (student) {
          studentName = student.full_name
          courseId = student.course_id
          courseName = student.course_title ?? student.course_code
        }
      }
    }

    const { ticketId, logId } = await logSupportTicketToSystemLog({
      studentDbId,
      studentName,
      courseId,
      courseName,
      subject,
      description,
      category,
      priority,
      audience,
      instructorId,
      instructorName,
      moduleId,
      moduleName,
      attachments,
    })

    return NextResponse.json({
      success: true,
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
    console.error("[student/support-tickets] POST failed", error)
    return NextResponse.json({ error: "Failed to submit support ticket" }, { status: 500 })
  }
}
