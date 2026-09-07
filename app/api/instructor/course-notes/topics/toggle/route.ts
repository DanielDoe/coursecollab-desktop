import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  upsertModuleTopicAvailability,
  upsertModuleTopicForAllCourseSessions,
} from "@/lib/module-topic-availability"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const { topicName, session, isAvailable } = await request.json()
    if (!topicName || !session) {
      return NextResponse.json({ error: "topicName and session are required" }, { status: 400 })
    }

    if (session === "ALL") {
      await upsertModuleTopicForAllCourseSessions({
        module: "course_notes",
        courseId: scope.course.id,
        topicName: String(topicName),
        isAvailable: Boolean(isAvailable),
        updatedBy: scope.instructorId,
      })
    } else {
      await upsertModuleTopicAvailability({
        module: "course_notes",
        topicName: String(topicName),
        session: String(session),
        isAvailable: Boolean(isAvailable),
        updatedBy: scope.instructorId,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[instructor/course-notes/topics/toggle POST]", error)
    return NextResponse.json({ error: "Failed to update topic" }, { status: 500 })
  }
}
