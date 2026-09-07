import { NextRequest, NextResponse } from "next/server"
import { type AssessmentType } from "@/lib/assessment-core/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { loadAssessmentResultsInProcess } from "@/lib/assessment-results-internal"

export const dynamic = "force-dynamic"

/**
 * GET /api/instructor/results/export
 *
 * Scoped to the instructor's active course (same headers as /api/instructor/results).
 */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }

    const { searchParams } = new URL(request.url)
    const quizId = searchParams.get("quizId")
    const section = searchParams.get("section")
    const assessmentType = searchParams.get("assessment_type")

    const singleTypeMap: Record<string, AssessmentType> = {
      quiz: "quiz",
      homework: "homework",
      mid_semester: "midsem",
      midsem: "midsem",
      final: "final",
      finals: "final",
    }

    const params = new URLSearchParams()
    if (quizId && quizId !== "all") params.append("assessmentId", quizId)
    if (section && section !== "all") params.append("section", section)
    params.append("showRetakes", "true")

    let allResults: any[] = []

    if (assessmentType && assessmentType !== "all") {
      const normalizedType = singleTypeMap[assessmentType] || "quiz"
      const loaded = await loadAssessmentResultsInProcess(request, normalizedType, params, scope)
      if (!loaded.ok) return loaded.response
      allResults = ((loaded.data.results as any[]) || []).map((r) => ({
        ...r,
        assessment_type: assessmentType,
      }))
    } else {
      const aggregate: Array<[string, AssessmentType]> = [
        ["quiz", "quiz"],
        ["homework", "homework"],
        ["mid_semester", "midsem"],
        ["final", "final"],
      ]
      for (const [displayType, apiType] of aggregate) {
        const loaded = await loadAssessmentResultsInProcess(request, apiType, params, scope)
        if (!loaded.ok) continue
        const rows = (loaded.data.results as any[]) || []
        allResults.push(...rows.map((r) => ({ ...r, assessment_type: displayType })))
      }
    }

    const headers = [
      "Student Name",
      "Student ID",
      "Section",
      "Assessment Title",
      "Assessment Type",
      "Score",
      "Total Questions",
      "Percentage",
      "Completed At",
    ]

    const rows = allResults.map((r: any) => [
      r.student_name || "",
      r.student_id || "",
      r.section || "",
      r.assessment_title || r.quiz_title || "",
      r.assessment_type || "",
      r.score || 0,
      r.total_questions || 0,
      r.percentage || 0,
      r.completed_at || "",
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n")

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="assessment-results-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    })
  } catch (error: any) {
    console.error("[Results Export] Error:", error)
    return NextResponse.json(
      { error: "Failed to export results", details: error.message },
      { status: 500 },
    )
  }
}
