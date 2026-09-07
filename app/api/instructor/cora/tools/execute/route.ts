import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { executeCoraTool, type CoraToolActor } from "@/lib/cora/tools/execute-cora-tool"
import type { CoraAgentToolName } from "@/lib/cora/tools/openai-tool-definitions"
import { buildFacultyCoraSession } from "@/lib/cora/security"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const body = (await request.json()) as {
      toolId?: string
      input?: Record<string, unknown>
    }

    const toolId = String(body.toolId ?? "").trim() as CoraAgentToolName
    if (!toolId) {
      return NextResponse.json({ error: "toolId required" }, { status: 400 })
    }

    const FACULTY_EXECUTE_READ_TOOLS = new Set<CoraAgentToolName>([
      "get_faculty_course_summary",
      "list_course_announcements",
      "analyze_assessment_results",
      "search_platform",
    ])
    if (!FACULTY_EXECUTE_READ_TOOLS.has(toolId)) {
      return NextResponse.json(
        { error: "Mutating tools require a signed confirmation from Cora chat." },
        { status: 403 },
      )
    }

    const session = await buildFacultyCoraSession({
      instructorId: scope.instructorId,
      courseId: scope.course.id,
      courseCode: scope.course.course_code ?? null,
      courseTitle: scope.course.course_title ?? null,
    })

    const actor: CoraToolActor = {
      role: "copilot",
      instructorId: scope.instructorId,
      courseId: scope.course.id,
      courseCode: scope.course.course_code ?? null,
      courseTitle: scope.course.course_title ?? null,
      session,
    }

    const resultText = await executeCoraTool(actor, toolId, body.input ?? {})
    let result: Record<string, unknown> = { content: resultText }
    try {
      result = JSON.parse(resultText) as Record<string, unknown>
    } catch {
      /* keep text */
    }

    return NextResponse.json({ result, actions: [] })
  } catch (error) {
    console.error("[instructor/cora/tools/execute]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Tool execution failed" },
      { status: 500 },
    )
  }
}
