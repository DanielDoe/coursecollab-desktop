import { type NextRequest, NextResponse } from "next/server"
import { requireSystemLogAccess } from "@/lib/system-log-auth"
import {
  getLatestLogForGroup,
  getRecentLogsForGroup,
  getSystemLogGroupById,
} from "@/lib/system-log-query"

export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSystemLogAccess(_request)
  if (!auth.ok) return auth.response

  try {
    const { id } = await params
    const groupId = Number(id)
    if (!Number.isFinite(groupId)) {
      return NextResponse.json({ error: "Invalid group id" }, { status: 400 })
    }

    const group = await getSystemLogGroupById(groupId)
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 })
    }

    const [latestLog, recentLogs] = await Promise.all([
      getLatestLogForGroup(groupId),
      getRecentLogsForGroup(groupId, 5),
    ])

    return NextResponse.json({ group, latestLog, recentLogs })
  } catch (error) {
    console.error("[admin/system-logs/groups/[id]] GET failed", error)
    return NextResponse.json({ error: "Failed to fetch group details" }, { status: 500 })
  }
}
