import { NextRequest, NextResponse } from "next/server"
import { requireInstructorPracticeBankMutation } from "@/lib/instructor-practice-scope"
import {
  disablePracticeTopicForAllCourseSessions,
  disablePracticeTopicForSession,
} from "@/lib/practice-topic-availability"

export const dynamic = "force-dynamic"

export async function DELETE(request: NextRequest) {
  try {
    const gate = await requireInstructorPracticeBankMutation(request)
    if (!gate.ok) return gate.response

    const { searchParams } = new URL(request.url)
    const topic = searchParams.get("topic")
    const session = searchParams.get("session")

    if (!topic || !session) {
      return NextResponse.json({ error: "Topic and session are required" }, { status: 400 })
    }

    if (session === "ALL") {
      await disablePracticeTopicForAllCourseSessions({
        courseId: gate.course.id,
        topicName: topic,
        updatedBy: gate.instructorId,
      })

      return NextResponse.json({
        success: true,
        message: `Topic "${topic}" disabled for ALL sessions`,
      })
    }

    await disablePracticeTopicForSession({
      topicName: topic,
      session,
      updatedBy: gate.instructorId,
    })

    return NextResponse.json({
      success: true,
      message: `Topic "${topic}" disabled for session "${session}"`,
    })
  } catch (error) {
    console.error("Error removing topic:", error)
    return NextResponse.json({ error: "Failed to remove topic" }, { status: 500 })
  }
}
