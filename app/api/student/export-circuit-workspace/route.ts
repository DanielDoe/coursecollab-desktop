import { type NextRequest, NextResponse } from "next/server"
import { exportCircuitWorkspaceForStudentAttempt } from "@/lib/student-export-circuit-workspace"
import type { CircuitWorkspace } from "@/lib/circuit-workspace"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 120

/**
 * POST /api/student/export-circuit-workspace
 *
 * Server-side workspace PNG export when the client cannot resolve studentDatabaseId
 * or browser canvas export fails during quiz finalize.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const attemptId = Number(body.attemptId)
    const questionId = Number(body.questionId)
    const workspace = body.workspace as CircuitWorkspace | undefined
    const title = body.title != null ? String(body.title) : undefined

    if (!Number.isFinite(attemptId) || attemptId <= 0) {
      return NextResponse.json({ error: "attemptId required" }, { status: 400 })
    }
    if (!Number.isFinite(questionId) || questionId <= 0) {
      return NextResponse.json({ error: "questionId required" }, { status: 400 })
    }
    if (!workspace || typeof workspace !== "object") {
      return NextResponse.json({ error: "workspace required" }, { status: 400 })
    }

    const result = await exportCircuitWorkspaceForStudentAttempt({
      attemptId,
      questionId,
      workspace,
      title,
    })

    return NextResponse.json({
      success: true,
      exportedPages: result.exportedPages,
      solutionUploads: result.solutionUploads,
      answerJson: result.answerJson,
    })
  } catch (error: unknown) {
    console.error("[export-circuit-workspace]", error)
    const message = error instanceof Error ? error.message : "Workspace export failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
