import { type NextRequest, NextResponse } from "next/server"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import { loadStudentDashboardBundle } from "@/lib/data/resources/student-dashboard-bundle"
import { logRequestPerf, startPerfTimer } from "@/lib/perf/request-log"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: NextRequest) {
  const elapsed = startPerfTimer()
  try {
    const studentId = request.nextUrl.searchParams.get("studentId")
    const sessionParam = request.nextUrl.searchParams.get("session") || "ALL"

    const auth = await requireBoundStudentCaller(request, studentId)
    if (!auth.ok) {
      logRequestPerf({ route: "/api/student/dashboard-stats", status: auth.response.status, durationMs: elapsed() })
      return auth.response
    }

    const bundle = await loadStudentDashboardBundle({
      studentDbId: auth.studentDbId,
      sessionParam,
    })
    const body = JSON.stringify(bundle)
    logRequestPerf({
      route: "/api/student/dashboard-stats",
      status: 200,
      durationMs: elapsed(),
      payloadBytes: body.length,
    })
    return new NextResponse(body, {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  } catch (error) {
    console.error("[dashboard-stats]", error)
    logRequestPerf({ route: "/api/student/dashboard-stats", status: 500, durationMs: elapsed() })
    return NextResponse.json({ error: "Failed to load dashboard stats" }, { status: 500 })
  }
}
