import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { resolveModuleContentSessionFilter } from "@/lib/module-content-session-scope"
import {
  ensureCourseDigitalNotesSchema,
  fetchCourseDigitalNotesForInstructor,
  mapCourseDigitalNote,
} from "@/lib/course-digital-notes"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureCourseDigitalNotesSchema()
    const sessionFilter = await resolveModuleContentSessionFilter(
      request,
      request.nextUrl.searchParams.get("session"),
    )
    const rows = await fetchCourseDigitalNotesForInstructor(scope.course.id, sessionFilter)

    return NextResponse.json({
      notes: rows.map(mapCourseDigitalNote),
      courseCode: scope.course.course_code,
      session:
        sessionFilter.mode === "section" ? sessionFilter.sessionCode : "ALL",
    })
  } catch (error) {
    console.error("[instructor/course-notes GET]", error)
    return NextResponse.json({ error: "Failed to load course notes" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureCourseDigitalNotesSchema()

    const body = (await request.json()) as {
      title?: string
      bodyText?: string
      inkWorkspace?: unknown | null
      topic?: string | null
      session?: string | null
      isPublished?: boolean
    }

    const title = String(body.title ?? "Untitled note").trim() || "Untitled note"
    const bodyText = String(body.bodyText ?? "")
    const inkWorkspace =
      body.inkWorkspace != null ? JSON.stringify(body.inkWorkspace) : null
    const topic = body.topic != null ? String(body.topic).trim() || null : null
    let sessionRaw = body.session != null ? String(body.session).trim() : ""
    if (!sessionRaw) {
      const sessionFilter = await resolveModuleContentSessionFilter(request, null)
      if (sessionFilter.mode === "section") {
        sessionRaw = sessionFilter.sessionCode
      }
    }
    const session = sessionRaw && sessionRaw !== "ALL" ? sessionRaw : null
    const isPublished = Boolean(body.isPublished)

    const rows = await sql`
      INSERT INTO course_digital_notes (
        course_id, instructor_id, topic, title, body_text, ink_workspace, session, is_published
      )
      VALUES (
        ${scope.course.id}, ${scope.instructorId}, ${topic}, ${title}, ${bodyText}, ${inkWorkspace}::jsonb, ${session}, ${isPublished}
      )
      RETURNING *
    `

    return NextResponse.json({ note: mapCourseDigitalNote(rows[0] as never) })
  } catch (error) {
    console.error("[instructor/course-notes POST]", error)
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 })
  }
}
