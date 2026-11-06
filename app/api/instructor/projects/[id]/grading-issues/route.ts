import { NextRequest, NextResponse } from "next/server"
import { requireInstructorProjectAccess } from "@/lib/project-request-auth"
import { ensureProjectPhase3Schema } from "@/lib/ensure-project-phase3-schema"
import { loadGradingConfigForProjectOrLegacy } from "@/lib/projects/load-project-grading-config"
import { collectProjectGradingIssues } from "@/lib/projects/project-grading-issues"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureProjectPhase3Schema()
    const projectId = Number.parseInt((await params).id, 10)
    const access = await requireInstructorProjectAccess(request, projectId)
    if (!access.ok) return access.response

    const { assignment } = await loadGradingConfigForProjectOrLegacy(projectId)
    const issues = await collectProjectGradingIssues(projectId, assignment)
    return NextResponse.json({ issues })
  } catch (error) {
    console.error("[grading-issues]", error)
    return NextResponse.json({ error: "Failed to load issues" }, { status: 500 })
  }
}
