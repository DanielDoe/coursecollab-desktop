import { type NextRequest, NextResponse } from "next/server"
import { resolveStudentCourseContextFromRequest } from "@/lib/student-course-scope"
import { getSyllabusByCourseId } from "@/lib/syllabus/syllabus-service"
import { extractSyllabusDeadlines } from "@/lib/calendar/syllabus-deadlines"

export const dynamic = "force-dynamic"

/** Read-only syllabus deadline rows for semester timeline (no calendar import). */
export async function GET(request: NextRequest) {
  try {
    const resolved = await resolveStudentCourseContextFromRequest(request)
    if (!resolved.ok) return resolved.response

    const syllabus = await getSyllabusByCourseId(resolved.ctx.courseId, resolved.ctx.sessionId)
    if (!syllabus || syllabus.status !== "published") {
      return NextResponse.json({ deadlines: [], published: false })
    }

    const deadlines = extractSyllabusDeadlines({
      ...syllabus,
      sections: syllabus.sections.filter((s) => s.isVisible),
    })

    return NextResponse.json({
      published: true,
      deadlines: deadlines.map((d) => ({
        ...d,
        parsedDate: d.parsedDate?.toISOString() ?? null,
      })),
    })
  } catch (error) {
    console.error("[Student Syllabus Deadlines] GET failed:", error)
    return NextResponse.json({ error: "Failed to load syllabus deadlines" }, { status: 500 })
  }
}
