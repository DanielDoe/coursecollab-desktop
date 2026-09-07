import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import {
  buildHardDenyRefusal,
  detectHardDeniedIntent,
  agentPolicyForRole,
} from "@/lib/cora/agent/clearances"
import { buildAdminCoraSession, logCoraAuditEvent } from "@/lib/cora/security"
import { runCoraAgentRuntime } from "@/lib/cora/agent/runtime"
import { coraUiFromProposals } from "@/lib/cora/models/ui-payloads"
import { resolveCoraDynamicRoute } from "@/lib/cora/ai/dynamic-router"
import { buildPublicCoraChatFields } from "@/lib/cora/models/public-route"
import OpenAI from "openai"

export const dynamic = "force-dynamic"

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null

type ChatMessage = { role: "user" | "assistant"; content: string }

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    const adminId = Number.parseInt(String(auth.adminId), 10)
    if (!Number.isFinite(adminId) || adminId <= 0) {
      return NextResponse.json({ error: "Invalid admin session" }, { status: 401 })
    }

    const body = (await request.json()) as {
      message?: string
      conversationHistory?: ChatMessage[]
      institutionId?: number | null
      domainHint?: import("@/lib/cora/ai/dynamic-router").CoraTaskDomain | null
      confirmScopeRelated?: boolean
      declaredAcademicContext?: string | null
    }

    const message = String(body.message ?? "").trim()
    if (!message || message.length > 8000) {
      return NextResponse.json({ error: "Message required (max 8000 chars)" }, { status: 400 })
    }

    const adminSession = await buildAdminCoraSession({
      adminId,
      institutionId:
        body.institutionId != null && Number.isFinite(Number(body.institutionId))
          ? Number(body.institutionId)
          : null,
    })

    const forbidden = detectHardDeniedIntent("admin", message)
    if (forbidden) {
      void logCoraAuditEvent({
        session: adminSession,
        action: "cora.chat.blocked",
        outcome: "blocked",
        promptText: message,
        errorMessage: forbidden,
      })
      return NextResponse.json({
        reply: buildHardDenyRefusal(forbidden),
        restricted: true,
      })
    }

    {
      const { evaluateCoraDisclosureGate } = await import("@/lib/cora/disclosure")
      const disclosure = await evaluateCoraDisclosureGate({
        role: "admin",
        message,
        conversationHistory: (body.conversationHistory ?? []).slice(-8),
        session: adminSession,
      })
      if (disclosure.decision !== "ALLOW" && disclosure.userMessage) {
        return NextResponse.json({
          reply: disclosure.userMessage,
          restricted: true,
          creditsCharged: 0,
        })
      }
      const { evaluateCoraPurposeScope } = await import("@/lib/cora/scope")
      const scopeEval = await evaluateCoraPurposeScope({
        session: adminSession,
        role: "admin",
        message,
        conversationHistory: (body.conversationHistory ?? []).slice(-8),
        confirmScopeRelated: Boolean(body.confirmScopeRelated),
        declaredAcademicContext: body.declaredAcademicContext
          ? String(body.declaredAcademicContext)
          : null,
      })
      if (scopeEval.shouldEnforce && scopeEval.userMessage) {
        return NextResponse.json({
          reply: scopeEval.userMessage,
          restricted: true,
          scopeRedirect: true,
          scopeDecision: scopeEval.decision,
          scopeEventId: scopeEval.scopeEventId ?? null,
          offerScopeFeedback: Boolean(scopeEval.offerFeedback),
          creditsCharged: 0,
        })
      }
    }

    if (!openai) {
      return NextResponse.json({ error: "AI is not configured." }, { status: 503 })
    }

    const history = (body.conversationHistory ?? [])
      .filter((m) => m?.role === "user" || m?.role === "assistant")
      .slice(-12)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: String(m.content ?? "").slice(0, 6000),
      }))

    const { resolveModuleCapabilities } = await import(
      "@/lib/cora/capabilities/resolve-capabilities"
    )
    const moduleCaps = resolveModuleCapabilities({ session: adminSession })

    const coraRouting = resolveCoraDynamicRoute({
      message,
      conversationHistory: history,
      forAgentTools: true,
      userRole: "admin",
      portal: "admin",
    })

    const agentResult = await runCoraAgentRuntime({
      openai,
      role: "admin",
      session: adminSession,
      actor: {
        session: adminSession,
      },
      systemPrompt:
        agentPolicyForRole("admin") +
        "\nUse only live Admin module capabilities. Never impersonate students/faculty or act as Faculty Cora.",
      conversationHistory: history,
      userMessage: message,
      requestContext: {
        userRole: "admin",
        portal: "admin",
        message,
        conversationHistory: history,
        requiresTools: true,
        agenticAction: true,
      },
    })

    return NextResponse.json({
      reply: agentResult.content,
      toolCalls: agentResult.toolCalls,
      proposals: agentResult.artifacts?.proposals ?? [],
      plans: agentResult.artifacts?.plans ?? [],
      capabilityProfile: {
        principle: moduleCaps.principle,
        capabilityIds: moduleCaps.capabilityIds,
        lockedModules: moduleCaps.lockedModules,
        packet: moduleCaps.packet,
      },
      contextSyncedAt: new Date().toISOString(),
      ...buildPublicCoraChatFields({
        profile: coraRouting.profile ?? "agent",
        complexity: coraRouting.complexity,
        reason: coraRouting.reason,
        ui: coraUiFromProposals(agentResult.content, agentResult.artifacts?.proposals),
      }),
    })
  } catch (error) {
    console.error("[admin/cora/chat]", error)
    return NextResponse.json({ error: "Chat failed" }, { status: 500 })
  }
}
