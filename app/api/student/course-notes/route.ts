import { type NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { resolveStudentEnrollmentContext } from "@/lib/student-enrollment-context"
import {
  fetchPublishedCourseNotesForStudent,
  mapCourseDigitalNote,
} from "@/lib/course-digital-notes"
import { publishedCourseNotesLookupFromEnrollment } from "@/lib/student-course-notes-scope"

export const dynamic = "force-dynamic"

async function resolveStudentCourseContext(studentDbId: number) {
  return resolveStudentEnrollmentContext(studentDbId)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    const ctx = await resolveStudentCourseContext(auth.studentDbId)
    const { courseId, session } = publishedCourseNotesLookupFromEnrollment(ctx, {
      courseId: request.nextUrl.searchParams.get("courseId"),
      session: request.nextUrl.searchParams.get("session"),
    })

    const rows = await fetchPublishedCourseNotesForStudent({ courseId, session })
    return NextResponse.json({
      notes: rows.map(mapCourseDigitalNote),
      courseId,
      session,
    })
  } catch (error) {
    console.error("[student/course-notes GET]", error)
    return NextResponse.json({ error: "Failed to load course notes" }, { status: 500 })
  }
}
