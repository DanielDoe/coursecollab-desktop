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

    const { topic, session, daily_limit, is_available } = await request.json()

    if (!topic || !session || daily_limit === undefined || is_available === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (session === "ALL") {
      await upsertPracticeTopicForAllCourseSessions({
        courseId: gate.course.id,
        topicName: topic,
        isAvailable: Boolean(is_available),
        dailyLimit: Number(daily_limit),
        updatedBy: gate.instructorId,
      })

      return NextResponse.json({
        success: true,
        message: "Topic configuration updated for ALL sessions",
        configuration: { topic, session, is_available, daily_limit },
      })
    }

    await upsertPracticeTopicAvailability({
      topicName: topic,
      session,
      isAvailable: Boolean(is_available),
      dailyLimit: Number(daily_limit),
      updatedBy: gate.instructorId,
    })

    return NextResponse.json({
      success: true,
      message: "Topic configuration updated successfully",
      configuration: { topic, session, is_available, daily_limit },
    })
  } catch (error) {
    console.error("Error configuring topic:", error)
    return NextResponse.json({ error: "Failed to configure topic" }, { status: 500 })
  }
}
