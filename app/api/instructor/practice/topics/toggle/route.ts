import { NextRequest, NextResponse } from "next/server"
import { requireInstructorPracticeBankMutation } from "@/lib/instructor-practice-scope"
import {
  upsertPracticeTopicAvailability,
  upsertPracticeTopicForAllCourseSessions,
} from "@/lib/practice-topic-availability"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const gate = await requireInstructorPracticeBankMutation(request)
    if (!gate.ok) return gate.response

    const { topicName, session, isAvailable, dailyLimit = 10 } = await request.json()

    if (!topicName || !session) {
      return NextResponse.json({ error: "Topic name and session are required" }, { status: 400 })
    }

    if (session === "ALL") {
      await upsertPracticeTopicForAllCourseSessions({
        courseId: gate.course.id,
        topicName,
        isAvailable: Boolean(isAvailable),
        dailyLimit: Number(dailyLimit) || 10,
        updatedBy: gate.instructorId,
      })

      return NextResponse.json({
        success: true,
        message: `Topic ${topicName} ${isAvailable ? "enabled" : "disabled"} for ALL sessions`,
      })
    }

    await upsertPracticeTopicAvailability({
      topicName,
      session,
      isAvailable: Boolean(isAvailable),
      dailyLimit: Number(dailyLimit) || 10,
      updatedBy: gate.instructorId,
    })

    return NextResponse.json({
      success: true,
      message: `Topic ${topicName} ${isAvailable ? "enabled" : "disabled"} for session ${session}`,
    })
  } catch (error) {
    console.error("Error toggling topic availability:", error)
    return NextResponse.json(
      {
        error: "Failed to toggle topic availability",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
