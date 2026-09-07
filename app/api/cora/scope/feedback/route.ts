import { type NextRequest, NextResponse } from "next/server"
import { resolveAuthenticatedCoraActor } from "@/lib/cora/ai/request-context"
import { recordCoraScopeFeedback } from "@/lib/cora/scope/events"

export const dynamic = "force-dynamic"

/**
 * POST /api/cora/scope/feedback
 * Body: { related: boolean, eventId?, note?, role? }
 * When related=true, client should retry the original message with confirmScopeRelated=true.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      related?: boolean
      eventId?: number
      note?: string
      role?: string
    }

    const actor = await resolveAuthenticatedCoraActor(request, body.role ?? null)
    if (!actor.ok) return actor.response

    const related = Boolean(body.related)
    const role =
      actor.userRole === "instructor"
        ? "faculty"
        : actor.userRole === "admin"
          ? "admin"
          : "student"

    await recordCoraScopeFeedback({
      eventId: body.eventId != null ? Number(body.eventId) : null,
      userId: actor.userId,
      userRole: role,
      related,
      note: body.note ?? null,
    })

    return NextResponse.json({
      ok: true,
      related,
      /** Client may retry original prompt with confirmScopeRelated: true */
      allowRetry: related,
    })
  } catch (error) {
    console.error("[cora/scope/feedback]", error)
    return NextResponse.json({ error: "Failed to record feedback" }, { status: 500 })
  }
}
