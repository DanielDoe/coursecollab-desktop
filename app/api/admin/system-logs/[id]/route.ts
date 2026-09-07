import { type NextRequest, NextResponse } from "next/server"
import { requireSystemLogAccess } from "@/lib/system-log-auth"
import { getRelatedLogs, getSystemLogById } from "@/lib/system-log-query"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSystemLogAccess(request)
  if (!auth.ok) return auth.response

  try {
    const { id } = await params
    const logId = Number(id)
    if (!Number.isFinite(logId)) {
      return NextResponse.json({ error: "Invalid log id" }, { status: 400 })
    }

    const log = await getSystemLogById(logId)
    if (!log) {
      return NextResponse.json({ error: "Log not found" }, { status: 404 })
    }

    const related = await getRelatedLogs(log)
    return NextResponse.json({ log, related })
  } catch (error) {
    console.error("[admin/system-logs/[id]] GET failed", error)
    return NextResponse.json({ error: "Failed to fetch log" }, { status: 500 })
  }
}
