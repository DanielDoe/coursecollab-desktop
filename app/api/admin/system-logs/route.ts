import { type NextRequest, NextResponse } from "next/server"
import { requireSystemLogAccess } from "@/lib/system-log-auth"
import {
  deleteOldSystemLogs,
  parseSystemLogSearchParams,
  querySystemLogs,
} from "@/lib/system-log-query"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireSystemLogAccess(request)
  if (!auth.ok) return auth.response

  try {
    const filters = parseSystemLogSearchParams(new URL(request.url).searchParams)
    const result = await querySystemLogs(filters)
    return NextResponse.json({
      logs: result.logs,
      total: result.total,
      offset: filters.offset,
      limit: filters.limit,
    })
  } catch (error) {
    console.error("[admin/system-logs] GET failed", error)
    return NextResponse.json({ error: "Failed to fetch system logs" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireSystemLogAccess(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const olderThan = body.olderThan ? new Date(body.olderThan) : null
    if (!olderThan || Number.isNaN(olderThan.getTime())) {
      return NextResponse.json({ error: "olderThan date required" }, { status: 400 })
    }

    const deletedCount = await deleteOldSystemLogs(olderThan)
    return NextResponse.json({ deletedCount, olderThan: olderThan.toISOString() })
  } catch (error) {
    console.error("[admin/system-logs] DELETE failed", error)
    return NextResponse.json({ error: "Failed to delete logs" }, { status: 500 })
  }
}
