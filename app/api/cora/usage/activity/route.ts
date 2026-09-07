import { type NextRequest, NextResponse } from "next/server"
import { listUsageActivity } from "@/lib/cora/ai"
import { resolveAuthenticatedCoraActor } from "@/lib/cora/ai/request-context"

export const dynamic = "force-dynamic"

function activityTitle(row: {
  feature: string
  module: string | null
  operation: string | null
  toolName: string | null
}): string {
  if (row.toolName) return row.toolName.replace(/_/g, " ")
  if (row.operation && row.operation !== "agent_turn" && row.operation !== "runCoraAgent") {
    return row.operation.replace(/_/g, " ")
  }
  if (row.module && row.module !== "cora-agent") return `${row.module} · ${row.feature}`
  return row.feature
}

/**
 * GET /api/cora/usage/activity?role=&limit=&offset=&page=&q=
 * Prefer page (1-based) + limit, or offset + limit.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const actor = await resolveAuthenticatedCoraActor(request, searchParams.get("role"))
    if (!actor.ok) return actor.response

    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(searchParams.get("limit") ?? "5"), 10) || 5),
    )
    const pageParam = parseInt(String(searchParams.get("page") ?? ""), 10)
    const offsetParam = parseInt(String(searchParams.get("offset") ?? "0"), 10) || 0
    const page = Number.isFinite(pageParam) && pageParam >= 1 ? pageParam : null
    const offset = page != null ? (page - 1) * limit : Math.max(0, offsetParam)
    const query = searchParams.get("q") ?? searchParams.get("query") ?? null

    const result = await listUsageActivity({
      userRole: actor.userRole,
      userId: actor.userId,
      limit,
      offset,
      query,
    })

    const totalPages = Math.max(1, Math.ceil(result.total / limit) || 1)
    const currentPage = Math.min(totalPages, Math.floor(offset / limit) + 1)

    return NextResponse.json({
      activity: result.activity.map((a) => ({
        id: a.id,
        feature: a.feature,
        title: activityTitle(a),
        module: a.module,
        operation: a.operation,
        toolName: a.toolName,
        model: a.model,
        provider: a.provider,
        creditsCharged: a.creditsCharged,
        tokens: {
          input: a.inputTokens,
          cachedInput: a.cachedInputTokens,
          output: a.outputTokens,
          reasoning: a.reasoningTokens,
          total: a.totalTokens,
        },
        agentRunId: a.agentRunId,
        createdAt: a.createdAt,
        latencyMs: a.latencyMs,
        status: a.status,
        providerCostHidden: true,
      })),
      hasMore: result.hasMore,
      nextOffset: result.nextOffset,
      total: result.total,
      totalPages,
      page: currentPage,
      limit: result.limit,
      offset: result.offset,
      query: query?.trim() || null,
    })
  } catch (error) {
    console.error("[cora/usage/activity]", error)
    return NextResponse.json({ error: "Failed to load activity" }, { status: 500 })
  }
}
