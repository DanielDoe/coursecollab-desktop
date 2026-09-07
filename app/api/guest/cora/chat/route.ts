import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { sql } from "@/lib/db"
import { requirePlatformGuestDatabaseId } from "@/lib/require-platform-guest"
import { resolveGuestCapabilities } from "@/lib/guest/entitlements"
import { GuestAuthorizationError, guestAuthErrorResponse } from "@/lib/guest/authorization"
import { getGuestCoraBalance } from "@/lib/guest/cora-credit-ledger"
import { guestCoraChatAllowed } from "@/lib/guest/cora-usage"
import { isDeniedGuestCoraIntent } from "@/lib/cora/agent/guest-clearances"
import { buildGuestCoraSystemPrompt } from "@/lib/cora/guest-copilot-policy"
import { runCoraGuestRuntime } from "@/lib/cora/agent/runtime"
import { getGuestContextForCora } from "@/lib/cora/fetch-guest-context"
import { formatContextProfilePrompt, getOrBootstrapContextProfile } from "@/lib/cora/context/user-context-profile"
import { syncGuestMemoryAfterChat } from "@/lib/guest/cora-post-chat-sync"
import { isGuestFeatureEnabled } from "@/lib/guest/feature-flags"
import { resolveCoraDynamicRoute } from "@/lib/cora/ai/dynamic-router"
import { buildPublicCoraChatFields } from "@/lib/cora/models/public-route"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null

type ChatMessage = { role: "user" | "assistant"; content: string }

export async function POST(request: NextRequest) {
  try {
    if (!openai) {
      return NextResponse.json({ error: "AI is not configured" }, { status: 503 })
    }
    if (!isGuestFeatureEnabled("guestWorkspaceEnabled")) {
      return NextResponse.json({ error: "Career Member workspace is disabled" }, { status: 503 })
    }

    const body = (await request.json()) as {
      message?: string
      studentDatabaseId?: string
      conversationHistory?: ChatMessage[]
      requestId?: number | null
    }

    const raw = String(body.studentDatabaseId ?? "").trim()
    if (!raw) return NextResponse.json({ error: "Guest id required" }, { status: 401 })

    const guestId = await requirePlatformGuestDatabaseId(raw)
    if (guestId == null) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const message = String(body.message ?? "").trim()
    if (!message || message.length > 8000) {
      return NextResponse.json({ error: "Message required (max 8000 chars)" }, { status: 400 })
    }

    {
      const { evaluateCoraDisclosureGate } = await import("@/lib/cora/disclosure")
      const disclosure = await evaluateCoraDisclosureGate({
        role: "guest",
        message,
        conversationHistory: body.conversationHistory ?? [],
      })
      if (disclosure.decision !== "ALLOW" && disclosure.userMessage) {
        return NextResponse.json({
          content: disclosure.userMessage,
          creditsCharged: 0,
          denied: true,
        })
      }
    }

    if (isDeniedGuestCoraIntent(message)) {
      return NextResponse.json({
        content:
          "I can't help with course grades, assessments, or recommendation letters. I can help with recommendation preparation briefs and — with Cora Career — résumés, applications, and interview prep.",
        creditsCharged: 0,
        denied: true,
      })
    }

    const entitlements = await resolveGuestCapabilities(guestId)
    const access = guestCoraChatAllowed({
      capabilities: entitlements.capabilities,
      message,
    })

    if (!access.allowed) {
      return NextResponse.json(
        {
          error: access.reason ?? "Upgrade required",
          code: "GUEST_CORA_UPGRADE",
          upgradeUrl: "/guest/cora-career/access",
        },
        { status: 403 },
      )
    }

    const bal = await getGuestCoraBalance(guestId)
    if (!access.creditFree && bal.available <= 0) {
      return NextResponse.json(
        {
          error: "Insufficient Cora Credits. Add a credit pack to continue using Cora Career.",
          code: "GUEST_CREDITS_EXHAUSTED",
          upgradeUrl: "/guest/cora-credits",
        },
        { status: 402 },
      )
    }

    const profileRows = await sql`
      SELECT full_name, guest_organization FROM students WHERE id = ${guestId} LIMIT 1
    `
    const profile = profileRows[0] as { full_name: string; guest_organization: string | null } | undefined

    const contextPayload = await getGuestContextForCora(guestId)

    const systemPrompt = buildGuestCoraSystemPrompt({
      fullName: profile?.full_name ?? "Guest",
      organization: profile?.guest_organization,
      plan: entitlements.plan,
      capabilities: entitlements.capabilities,
      creditsAvailable: bal.available,
      requestId: body.requestId ?? null,
      contextPayload,
    })
    const contextProfile = await getOrBootstrapContextProfile({
      role: "guest",
      userId: guestId,
      courseId: null,
    })
    const profileBlock = formatContextProfilePrompt(contextProfile)

    const coraRouting = resolveCoraDynamicRoute({
      message,
      conversationHistory: body.conversationHistory ?? [],
      forAgentTools: true,
      userRole: "guest",
      portal: "career",
    })

    const result = await runCoraGuestRuntime({
      openai,
      guestId,
      capabilities: entitlements.capabilities,
      systemPrompt: profileBlock ? `${systemPrompt}\n\n${profileBlock}` : systemPrompt,
      conversationHistory: body.conversationHistory ?? [],
      userMessage: message,
      creditFree: access.creditFree,
      guestPlan: entitlements.plan,
      requestContext: {
        userRole: "guest",
        portal: "career",
        message,
        conversationHistory: body.conversationHistory ?? [],
        coraLiteMode: !access.creditFree && bal.available <= 0,
      },
    })

    void syncGuestMemoryAfterChat({
      guestId,
      userMessage: message,
      assistantReply: result.content,
      toolNames: result.toolCalls.map((t) => t.name),
    }).catch((err) => console.error("[guest/cora/chat] memory sync failed", err))

    // Re-sync full context after tools may have mutated data
    const contextPayloadAfter = await getGuestContextForCora(guestId)

    const balanceAfter =
      result.creditsRemaining ?? (access.creditFree ? bal.available : (await getGuestCoraBalance(guestId)).available)

    return NextResponse.json({
      content: result.content,
      toolCalls: result.toolCalls,
      creditsCharged: result.creditsCharged,
      creditsRemaining: balanceAfter,
      creditFree: access.creditFree,
      plan: entitlements.plan,
      contextSyncedAt: contextPayloadAfter.syncedAt,
      hasMasterResume: Boolean(contextPayloadAfter.masterResume?.hasResume),
      focusTopics: contextPayloadAfter.focusTopics,
      ...buildPublicCoraChatFields({
        profile: coraRouting.profile ?? "standard",
        complexity: coraRouting.complexity,
        reason: coraRouting.reason,
      }),
    })
  } catch (e) {
    if (e instanceof Error && e.message.includes("Insufficient Cora Credits")) {
      return NextResponse.json(
        { error: e.message, code: "GUEST_CREDITS_EXHAUSTED", upgradeUrl: "/guest/cora-credits" },
        { status: 402 },
      )
    }
    if (e instanceof GuestAuthorizationError) {
      return guestAuthErrorResponse(e)
    }
    console.error("[guest/cora/chat]", e)
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message.slice(0, 300) : "Unexpected Career Cora error",
        code: "GUEST_CORA_ERROR",
      },
      { status: 500 },
    )
  }
}
