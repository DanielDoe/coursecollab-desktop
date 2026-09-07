import { type NextRequest, NextResponse } from "next/server"
import {
  ACTIVITY_ACTIONS,
  logPlatformActivityFromRequest,
  type PlatformPortal,
} from "@/lib/platform-activity-log"
import { sql } from "@/lib/db"
import { requireAdminId } from "@/lib/admin-api-auth"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"

export const dynamic = "force-dynamic"

type ClientActivityBody = {
  portal?: PlatformPortal
  action?: string
  category?: string
  path?: string
  summary?: string
  entityType?: string
  entityId?: string
  courseId?: number
  metadata?: Record<string, unknown>
}

async function resolveActor(request: NextRequest): Promise<{
  portal: PlatformPortal
  actorType: string
  actorId: number
  actorLabel: string | null
  actorEmail: string | null
} | null> {
  const admin = await requireAdminId(request)
  if (admin.ok) {
    return {
      portal: "admin",
      actorType: "admin",
      actorId: Number(admin.adminId),
      actorLabel: null,
      actorEmail: null,
    }
  }

  const instructor = await requireInstructorSession(request)
  if (instructor.ok) {
    return {
      portal: "faculty",
      actorType: "instructor",
      actorId: instructor.instructorId,
      actorLabel: null,
      actorEmail: null,
    }
  }

  const student = await requireCallerStudentDbId(request)
  if (student.ok) {
    const path = request.headers.get("x-activity-path") ?? ""
    const portal: PlatformPortal = path.includes("/summer-camp") ? "summer_camper" : "student"
    return {
      portal,
      actorType: "student",
      actorId: student.studentDbId,
      actorLabel: null,
      actorEmail: null,
    }
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveActor(request)
    if (!actor || !Number.isFinite(actor.actorId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as ClientActivityBody
    const action = body.action?.trim() || ACTIVITY_ACTIONS.PAGE_VIEW
    const path = body.path?.trim() || request.headers.get("x-activity-path") || null

    if (actor.actorLabel == null) {
      if (actor.actorType === "admin") {
        const rows = await sql`SELECT username FROM admin_users WHERE id = ${actor.actorId} LIMIT 1`
        if (rows[0]) actor.actorLabel = String((rows[0] as { username: string }).username)
      } else if (actor.actorType === "instructor") {
        const rows = await sql`SELECT name, email FROM instructors WHERE id = ${actor.actorId} LIMIT 1`
        if (rows[0]) {
          const r = rows[0] as { name: string; email: string }
          actor.actorLabel = r.name
          actor.actorEmail = r.email
        }
      } else {
        const rows = await sql`
          SELECT id, full_name, email
          FROM students
          WHERE id = ${actor.actorId}
             OR TRIM(student_id) = TRIM(${String(actor.actorId)})
          LIMIT 1
        `
        if (rows[0]) {
          const r = rows[0] as { id: number; full_name: string; email: string | null }
          actor.actorId = r.id
          actor.actorLabel = r.full_name
          actor.actorEmail = r.email
        }
      }
    }

    await logPlatformActivityFromRequest(request, {
      portal: body.portal ?? actor.portal,
      actorType: actor.actorType,
      actorId: actor.actorId,
      actorLabel: actor.actorLabel,
      actorEmail: actor.actorEmail,
      action,
      category: (body.category as "navigation") ?? "navigation",
      entityType: body.entityType ?? null,
      entityId: body.entityId ?? null,
      courseId: body.courseId ?? null,
      path,
      summary: body.summary ?? null,
      metadata: body.metadata ?? {},
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[platform/activity]", error)
    return NextResponse.json({ error: "Failed to log activity" }, { status: 500 })
  }
}
