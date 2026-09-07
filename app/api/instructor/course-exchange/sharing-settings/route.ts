import { NextRequest, NextResponse } from "next/server"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import {
  defaultApprovalModules,
  getCourseSharingSettings,
  listInstructorCoursesWithSharingSettings,
  updateCourseSharingSettings,
} from "@/lib/course-exchange/service"
import { normalizeModuleList } from "@/lib/course-exchange/modules"
import type { CourseExchangeSharingMode } from "@/lib/course-exchange/types"

export const dynamic = "force-dynamic"

/** List every course this instructor owns + sharing opt-in status. */
export async function GET(request: NextRequest) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response

    const courses = await listInstructorCoursesWithSharingSettings(session.instructorId)
    return NextResponse.json({
      courses,
      defaultApprovalModules: defaultApprovalModules(),
    })
  } catch (error) {
    console.error("[course-exchange/sharing-settings GET]", error)
    return NextResponse.json({ error: "Failed to load sharing settings" }, { status: 500 })
  }
}

/** Opt a specific owned course into (or out of) Discover with shareable modules. */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response

    const body = await request.json()
    const courseId = Number(body.courseId)
    if (!Number.isFinite(courseId) || courseId <= 0) {
      return NextResponse.json({ error: "courseId is required" }, { status: 400 })
    }

    const sharingMode = body.sharingMode as CourseExchangeSharingMode
    if (sharingMode !== "off" && sharingMode !== "request_only") {
      return NextResponse.json({ error: "Invalid sharingMode" }, { status: 400 })
    }

    const settings = await updateCourseSharingSettings({
      instructorId: session.instructorId,
      courseId,
      sharingMode,
      discoverableTitle: body.discoverableTitle ?? null,
      shareableModules: normalizeModuleList(body.shareableModules),
      autoApprove: Boolean(body.autoApprove),
    })

    return NextResponse.json({ settings, course: settings ?? (await getCourseSharingSettings(courseId)) })
  } catch (error) {
    console.error("[course-exchange/sharing-settings PUT]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update sharing settings" },
      { status: 500 },
    )
  }
}
