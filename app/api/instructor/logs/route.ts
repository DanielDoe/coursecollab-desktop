import { type NextRequest, NextResponse } from "next/server"
import { requireSystemLogAccess } from "@/lib/system-log-auth"
import {
  deleteOldSystemLogs,
  parseSystemLogSearchParams,
  querySystemLogs,
  getSystemLogStats,
} from "@/lib/system-log-query"

export const dynamic = "force-dynamic"

/** Instructor-facing system logs — same data store as admin system logs */
export async function GET(req: NextRequest) {
  const auth = await requireSystemLogAccess(req)
  if (!auth.ok) return auth.response

  try {
    const filters = parseSystemLogSearchParams(new URL(req.url).searchParams)
    const [result, stats] = await Promise.all([
      querySystemLogs(filters),
      getSystemLogStats(),
    ])

    const logs = result.logs.map((log) => ({
      id: log.id,
      level: log.severity,
      message: log.title ?? log.error_message ?? "",
      timestamp: log.created_at,
      source: log.module_name ?? log.category,
      details: log.description ?? log.error_message,
      userId: log.user_id,
      quizId: log.metadata?.quizId != null ? String(log.metadata.quizId) : undefined,
      category: log.category,
      moduleName: log.module_name,
      pageUrl: log.page_url,
      apiEndpoint: log.api_endpoint,
    }))

    return NextResponse.json({
      logs,
      stats: {
        total: result.total,
        byLevel: stats.severityBreakdown.reduce(
          (acc, row) => {
            acc[row.severity] = row.count
            return acc
          },
          {} as Record<string, number>,
        ),
        bySource: stats.categoryBreakdown.reduce(
          (acc, row) => {
            acc[row.category] = row.count
            return acc
          },
          {} as Record<string, number>,
        ),
        errorsToday: stats.today.error_level_today,
        criticalToday: stats.today.critical_today,
        needsAttentionIssues: stats.needsAttentionIssues,
        openIssues: stats.openIssues,
        resolvedIssues: stats.resolvedIssues,
        activeIssues: stats.openIssues,
      },
      filters: {
        level: filters.severity ?? "all",
        limit: filters.limit,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[instructor/logs] GET failed", error)
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSystemLogAccess(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const olderThan = body.olderThan ? new Date(body.olderThan) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const deletedCount = await deleteOldSystemLogs(olderThan)
    return NextResponse.json({
      message: `Successfully deleted ${deletedCount} log entries`,
      deletedCount,
      filters: { olderThan: olderThan.toISOString() },
    })
  } catch (error) {
    console.error("[instructor/logs] DELETE failed", error)
    return NextResponse.json({ error: "Failed to delete logs" }, { status: 500 })
  }
}
