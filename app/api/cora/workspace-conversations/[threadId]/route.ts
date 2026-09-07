import { type NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { deleteCoraWorkspaceThread } from "@/lib/cora/workspace-conversations.server"

export const dynamic = "force-dynamic"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    const { threadId } = await params
    if (!threadId?.trim()) {
      return NextResponse.json({ error: "Thread id required" }, { status: 400 })
    }

    const deleted = await deleteCoraWorkspaceThread(auth.studentDbId, threadId.trim())
    if (!deleted) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[cora/workspace-conversations DELETE]", error)
    return NextResponse.json({ error: "Failed to delete conversation" }, { status: 500 })
  }
}
