import { type NextRequest, NextResponse } from "next/server"
import { requireSystemLogAccess } from "@/lib/system-log-auth"
import { getSystemLogStats } from "@/lib/system-log-query"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireSystemLogAccess(request)
  if (!auth.ok) return auth.response

  try {
    const stats = await getSystemLogStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error("[admin/system-logs/stats] failed", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
