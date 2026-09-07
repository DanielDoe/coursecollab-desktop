import { type NextRequest, NextResponse } from "next/server"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import {
  CODEBENCH_WORKSPACE_MAX_BYTES,
  fetchStudentIdeWorkspace,
  parseIdeWorkspacePayload,
  saveStudentIdeWorkspace,
} from "@/lib/codebench-ide-cloud"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const claimed = request.nextUrl.searchParams.get("studentId")
    const auth = await requireCodebenchStudent(request, claimed)
    if (!auth.ok) return auth.response

    const stored = await fetchStudentIdeWorkspace(auth.studentDbId)
    return NextResponse.json({
      workspace: stored?.workspace ?? null,
      updatedAt: stored?.updatedAt ?? null,
    })
  } catch (error) {
    console.error("[codebench/workspace GET]", error)
    return NextResponse.json({ error: "Failed to load CodeBench workspace" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      studentId?: unknown
      workspace?: unknown
    }
    const claimed = body.studentId != null ? String(body.studentId) : request.nextUrl.searchParams.get("studentId")
    const auth = await requireCodebenchStudent(request, claimed)
    if (!auth.ok) return auth.response

    const workspace = parseIdeWorkspacePayload(body.workspace)
    if (!workspace) {
      return NextResponse.json({ error: "Invalid CodeBench workspace" }, { status: 400 })
    }

    const bytes = Buffer.byteLength(JSON.stringify(workspace), "utf8")
    if (bytes > CODEBENCH_WORKSPACE_MAX_BYTES) {
      return NextResponse.json({ error: "Workspace is too large to sync" }, { status: 413 })
    }

    const saved = await saveStudentIdeWorkspace(auth.studentDbId, workspace)
    return NextResponse.json({
      workspace: saved.workspace,
      updatedAt: saved.updatedAt,
      conflict: saved.conflict,
    })
  } catch (error) {
    console.error("[codebench/workspace PUT]", error)
    return NextResponse.json({ error: "Failed to save CodeBench workspace" }, { status: 500 })
  }
}
