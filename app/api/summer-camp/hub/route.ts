import { type NextRequest, NextResponse } from "next/server"
import { requireBoundSummerCamper } from "@/lib/require-summer-camper"
import {
  hubAchievements,
  hubAnnouncements,
  hubBrowse,
  hubCalendar,
  hubCheckpoints,
  hubDashboard,
  hubDiscussions,
  hubMyTrainings,
  hubProjects,
  hubResources,
  hubRoadmap,
  hubSupport,
} from "@/lib/summer-camp/camper-hub"

export const dynamic = "force-dynamic"

const PUBLIC_VIEWS = new Set(["browse", "support"])

export async function GET(request: NextRequest) {
  try {
    const view = request.nextUrl.searchParams.get("view") ?? "dashboard"

    if (!PUBLIC_VIEWS.has(view)) {
      const camper = await requireBoundSummerCamper(request)
      if (!camper.ok) return camper.response
      const studentDbId = camper.studentDbId

      switch (view) {
        case "dashboard":
          return NextResponse.json(await hubDashboard(studentDbId))
        case "my-trainings":
          return NextResponse.json(await hubMyTrainings(studentDbId))
        case "roadmap":
          return NextResponse.json(await hubRoadmap(studentDbId))
        case "projects":
          return NextResponse.json(await hubProjects(studentDbId))
        case "checkpoints":
          return NextResponse.json(await hubCheckpoints(studentDbId))
        case "discussions":
          return NextResponse.json(await hubDiscussions(studentDbId))
        case "resources":
          return NextResponse.json(await hubResources(studentDbId))
        case "achievements":
          return NextResponse.json(await hubAchievements(studentDbId))
        case "calendar":
          return NextResponse.json(await hubCalendar(studentDbId))
        case "announcements":
          return NextResponse.json(await hubAnnouncements(studentDbId))
        default:
          return NextResponse.json({ error: "Unknown view" }, { status: 400 })
      }
    }

    if (view === "browse") {
      const { requireCallerStudentDbId } = await import("@/lib/student-api-auth")
      const caller = await requireCallerStudentDbId(request)
      return NextResponse.json(await hubBrowse(caller.ok ? caller.studentDbId : null))
    }
    if (view === "support") {
      return NextResponse.json(hubSupport())
    }

    return NextResponse.json({ error: "Unknown view" }, { status: 400 })
  } catch (error) {
    console.error("[summer-camp/hub]", error)
    return NextResponse.json({ error: "Failed to load camp data" }, { status: 500 })
  }
}
