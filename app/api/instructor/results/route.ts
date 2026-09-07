import { NextRequest, NextResponse } from "next/server"
import type { AssessmentType } from "@/lib/assessment-core/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { loadAssessmentResultsInProcess } from "@/lib/assessment-results-internal"

export const dynamic = "force-dynamic"

const TYPE_MAP: Record<string, AssessmentType> = {
  quiz: "quiz",
  homework: "homework",
  mid_semester: "midsem",
  midsem: "midsem",
  final: "final",
  finals: "final",
}

function resultsSearchParams(request: NextRequest): URLSearchParams {
  const { searchParams } = new URL(request.url)
  const quizId = searchParams.get("quizId")
  const section = searchParams.get("section")
  const showRetakes = searchParams.get("showRetakes") === "true"
  const params = new URLSearchParams()
  if (quizId && quizId !== "all") params.append("assessmentId", quizId)
  if (section && section !== "all") params.append("section", section)
  params.append("showRetakes", showRetakes.toString())
  return params
}

/**
 * GET /api/instructor/results
 *
 * Updated to use assessment-specific tables
 * Supports backward compatibility with assessment_type parameter
 */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }

    const { searchParams } = new URL(request.url)
    const assessmentType = searchParams.get("assessment_type")
    const params = resultsSearchParams(request)

    if (assessmentType && assessmentType !== "all") {
      const normalizedType = TYPE_MAP[assessmentType] || "quiz"
      const loaded = await loadAssessmentResultsInProcess(request, normalizedType, params, scope)
      if (!loaded.ok) return loaded.response
      const data = loaded.data
      return NextResponse.json({
        results: ((data.results as unknown[]) || []).map((r: any) => ({
          ...r,
          quiz_title: r.assessment_title,
          assessment_type: assessmentType,
        })),
        totalResults: Array.isArray(data.results) ? data.results.length : 0,
        filteredCount: Array.isArray(data.results) ? data.results.length : 0,
      })
    }

    const aggregateTypes: Array<[string, AssessmentType]> = [
      ["quiz", "quiz"],
      ["homework", "homework"],
      ["mid_semester", "midsem"],
      ["final", "final"],
    ]

    const allResults: any[] = []
    for (const [displayType, apiType] of aggregateTypes) {
      const loaded = await loadAssessmentResultsInProcess(request, apiType, params, scope)
      if (!loaded.ok) continue
      const rows = (loaded.data.results as any[]) || []
      allResults.push(
        ...rows.map((r) => ({
          ...r,
          quiz_title: r.assessment_title,
          assessment_type: displayType,
        })),
      )
    }

    return NextResponse.json({
      results: allResults,
      totalResults: allResults.length,
      filteredCount: allResults.length,
    })
  } catch (error: any) {
    console.error("[Instructor Results] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch results", details: error.message },
      { status: 500 },
    )
  }
}
