import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { buildInstructorOwnedCourseScopeSqlFragment } from "@/lib/instructor-default-courses"
import { fetchPracticeTopicAvailabilityForSession } from "@/lib/practice-topic-availability"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const url = request.url
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }

    const { searchParams } = new URL(url)
    const session = searchParams.get("session") || "ALL"
    const sessionVariants = session !== "ALL" ? normalizedSectionVariantsForSql(session) : []

    const qbScope = buildInstructorOwnedCourseScopeSqlFragment(
      "question_bank",
      "course_id",
      scope.course.id,
      scope.instructorId,
      { scopeCourseCode: scope.course.course_code },
    )

    const topics = await sql`
      SELECT
        topic,
        COUNT(*) as question_count
      FROM question_bank
      WHERE topic IS NOT NULL AND topic != ''
        AND deleted_at IS NULL
        AND (${qbScope})
      GROUP BY topic
      ORDER BY topic
    `

    const availability = await fetchPracticeTopicAvailabilityForSession(session, sessionVariants)

    const topicsWithAvailability = topics.map((topic) => {
      const topicAvailability = availability.find((av) => av.topic === topic.topic)
      return {
        name: topic.topic,
        question_count: Number(topic.question_count),
        availability: {
          [session]: topicAvailability
            ? {
                is_available: topicAvailability.is_available,
                daily_limit: Number(topicAvailability.daily_limit),
                updated_at: topicAvailability.updated_at,
                configured: true,
              }
            : {
                is_available: true,
                daily_limit: 10,
                updated_at: new Date().toISOString(),
                configured: false,
              },
        },
      }
    })

    return NextResponse.json({
      topics: topicsWithAvailability,
      practiceBankAvailable: topics.length > 0,
      courseCode: scope.course.course_code,
      message:
        topics.length === 0
          ? "No question bank topics found for this course. Add questions in the Question Bank first."
          : undefined,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Error fetching practice topics:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch topics",
        details: msg,
        debug: { session: new URL(url).searchParams.get("session") || "ALL" },
      },
      { status: 500 },
    )
  }
}
