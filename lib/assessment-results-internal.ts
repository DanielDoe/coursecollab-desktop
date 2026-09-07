import { NextRequest, NextResponse } from "next/server"
import { GET as getAssessmentResults } from "@/app/api/[assessmentType]/results/route"
import type { AssessmentType } from "@/lib/assessment-core/db"

/**
 * Load typed results in-process. Do not HTTP-fetch the public origin —
 * Node/Vercel strips Cookie on that hop, so production returned empty lists.
 */
export async function loadAssessmentResultsInProcess(
  request: NextRequest,
  assessmentType: AssessmentType,
  search: URLSearchParams,
  scope: { instructorId: number; course: { id: number } },
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  const url = new URL(`/api/${assessmentType}/results?${search.toString()}`, request.url)
  const headers = new Headers(request.headers)
  headers.set("x-instructor-id", String(scope.instructorId))
  headers.set("x-course-id", String(scope.course.id))
  const inner = new NextRequest(url, { headers, method: "GET" })
  const res = await getAssessmentResults(inner, { params: Promise.resolve({ assessmentType }) })
  const data = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: (data.error as string) || "Failed to fetch results", details: data.details },
        { status: res.status },
      ),
    }
  }
  return { ok: true, data }
}
