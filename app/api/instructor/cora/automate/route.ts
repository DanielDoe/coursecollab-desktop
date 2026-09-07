import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  createFacultyAutomationJob,
  listFacultyAutomationJobs,
  type FacultyAutomationJobType,
} from "@/lib/cora/faculty-automations"

export const dynamic = "force-dynamic"

function parseJobType(value: unknown): FacultyAutomationJobType | null {
  if (value === "weekly_announcement" || value === "post_lecture_flashcards") return value
  return null
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const jobs = await listFacultyAutomationJobs(scope.course.id)
    return NextResponse.json({ jobs })
  } catch (error) {
    console.error("[instructor/cora/automate GET]", error)
    return NextResponse.json({ error: "Failed to load automations" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const body = (await request.json()) as {
      jobType?: string
      payload?: Record<string, unknown>
      runAt?: string
      runInHours?: number
    }

    const jobType = parseJobType(body.jobType)
    if (!jobType) {
      return NextResponse.json({ error: "Invalid jobType" }, { status: 400 })
    }

    let runAt: Date
    if (body.runAt) {
      runAt = new Date(body.runAt)
      if (Number.isNaN(runAt.getTime())) {
        return NextResponse.json({ error: "Invalid runAt" }, { status: 400 })
      }
    } else {
      const hours = Math.max(1, Math.min(24 * 30, Number(body.runInHours ?? 24)))
      runAt = new Date(Date.now() + hours * 60 * 60 * 1000)
    }

    const job = await createFacultyAutomationJob({
      courseId: scope.course.id,
      instructorId: scope.instructorId,
      jobType,
      payload: body.payload ?? {},
      runAt,
    })

    return NextResponse.json({ job })
  } catch (error) {
    console.error("[instructor/cora/automate POST]", error)
    return NextResponse.json({ error: "Failed to schedule automation" }, { status: 500 })
  }
}
