import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  listFacultyImportContainers,
  listFacultyImportItems,
  listFacultyImportSources,
  resolveFacultyImportedQuestion,
  type FacultyImportSourceKey,
} from "@/lib/cora/faculty-question-import-browse"

export const dynamic = "force-dynamic"

const SOURCE_KEYS = new Set<FacultyImportSourceKey>([
  "question_bank",
  "quizzes",
  "homework",
  "mid_semester",
  "final",
])

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const level = request.nextUrl.searchParams.get("level") || "sources"
    const sourceKey = request.nextUrl.searchParams.get("sourceKey") as FacultyImportSourceKey | null
    const containerId = request.nextUrl.searchParams.get("containerId")
    const ctx = { courseId: scope.course.id, instructorId: scope.instructorId }

    if (level === "sources") {
      const sources = await listFacultyImportSources(ctx)
      return NextResponse.json({ level: "sources", sources })
    }

    if (level === "containers") {
      if (!sourceKey || !SOURCE_KEYS.has(sourceKey)) {
        return NextResponse.json({ error: "Valid sourceKey required" }, { status: 400 })
      }
      const containers = await listFacultyImportContainers(ctx, sourceKey)
      return NextResponse.json({ level: "containers", sourceKey, containers })
    }

    if (level === "questions") {
      if (!sourceKey || !SOURCE_KEYS.has(sourceKey) || !containerId) {
        return NextResponse.json({ error: "sourceKey and containerId required" }, { status: 400 })
      }
      const items = await listFacultyImportItems(ctx, sourceKey, containerId)
      return NextResponse.json({ level: "questions", sourceKey, containerId, items })
    }

    return NextResponse.json({ error: "Invalid level" }, { status: 400 })
  } catch (error) {
    console.error("[instructor/cora/question-import GET]", error)
    return NextResponse.json({ error: "Failed to load" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const body = (await request.json()) as {
      source?: string
      questionId?: number | string
      quizId?: number
      bankQuestionId?: number
    }

    if (!body?.source) {
      return NextResponse.json({ error: "source is required" }, { status: 400 })
    }

    const problem = await resolveFacultyImportedQuestion({
      courseId: scope.course.id,
      instructorId: scope.instructorId,
      source: body.source,
      questionId: body.questionId,
      quizId: body.quizId,
      bankQuestionId: body.bankQuestionId,
    })

    return NextResponse.json({ problem })
  } catch (error) {
    console.error("[instructor/cora/question-import POST]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import question" },
      { status: 400 },
    )
  }
}
