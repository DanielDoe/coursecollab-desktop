import { resolveModelForFeature } from "@/lib/resolve-feature-ai-model"
import { guestOpenAiToolsForNames, type GuestCoraToolName } from "@/lib/cora/tools/guest-tool-definitions"
import { executeGuestCoraTool } from "@/lib/cora/tools/execute-guest-cora-tool"
import {
  GUEST_DISCOVERY_CORA_TOOLS,
  guestCoraToolsForCapabilities,
} from "@/lib/cora/agent/guest-clearances"
import { detectGuestCoraToolIntent, guestToolsForIntent } from "@/lib/cora/agent/guest-intent-tools"
import type { GuestCapability } from "@/lib/guest/types"
import { providerCostToCoraCredits } from "@/lib/cora/ai/pricing"
import { deductGuestCoraCredits } from "@/lib/guest/cora-credit-ledger"
import { recordGuestCoraUsage } from "@/lib/guest/record-guest-cora-usage"
import type { GuestPlan } from "@/lib/guest/types"
import { getMaxAgentToolRounds } from "@/lib/cora/models/flags"
import { routeCoraModel } from "@/lib/cora/models/router"
import { nextCoraEscalation } from "@/lib/cora/models/escalation"
import {
  appendCoraDisclosurePolicy,
  applyCoraOutputSecurityGate,
  wrapUntrustedCoraData,
} from "@/lib/cora/disclosure"
import type { RawModelUsage } from "@/lib/cora/ai/types"

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool"
  content: string
  tool_call_id?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool_calls?: any[]
}

export type GuestCoraAgentResult = {
  content: string
  modelUsed: string
  toolCalls: { name: string; args: Record<string, unknown> }[]
  creditsCharged: number
  creditsRemaining: number | null
  routeProfile?: string
}

const MAX_TOOL_ROUNDS = getMaxAgentToolRounds()

function parseToolArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function runGuestCoraAgent({
  openai,
  guestId,
  capabilities,
  systemPrompt,
  conversationHistory,
  userMessage,
  creditFree = false,
  guestPlan = "guest_free",
  coraLiteMode = false,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  openai: any
  guestId: number
  capabilities: readonly GuestCapability[]
  systemPrompt: string
  conversationHistory: { role: string; content: string }[]
  userMessage: string
  creditFree?: boolean
  guestPlan?: GuestPlan
  coraLiteMode?: boolean
}): Promise<GuestCoraAgentResult> {
  const { coraGatewayChatCompletions } = await import("@/lib/cora/ai")
  const routed = routeCoraModel({
    userRole: "guest",
    portal: "career",
    message: userMessage,
    conversationHistory,
    coraLiteMode,
    clientProfileHint: null,
  })
  // Guest tool loop currently runs on the OpenAI chat.completions client.
  // Never pass Anthropic model IDs into that path (OpenAI returns 404).
  let model =
    routed.provider === "openai"
      ? routed.model || resolveModelForFeature("tutor")
      : routed.fallback?.provider === "openai"
        ? routed.fallback.model
        : resolveModelForFeature("tutor")
  if (/claude/i.test(model)) {
    model = resolveModelForFeature("tutor")
  }
  const roleAllowed = coraLiteMode
    ? GUEST_DISCOVERY_CORA_TOOLS
    : guestCoraToolsForCapabilities(capabilities)
  const intent = detectGuestCoraToolIntent(userMessage)
  const allowed = guestToolsForIntent(roleAllowed, intent)
  const tools = guestOpenAiToolsForNames(allowed)
  const toolTrace: GuestCoraAgentResult["toolCalls"] = []
  let creditsChargedTotal = 0
  let creditsRemaining: number | null = null
  let escalationsUsed = 0
  let consecutiveToolFails = 0
  let modelCalls = 0

  const messages: ChatMessage[] = [
    { role: "system", content: appendCoraDisclosurePolicy(systemPrompt) },
    ...conversationHistory
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-12)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userMessage },
  ]

  const usageContext = {
    actor: { userId: guestId, userRole: "guest" as const },
    feature: "CHAT" as const,
    module: "guest-cora-chat",
    billable: false,
  }

  async function chargeFromUsage(usage: {
    inputTokens: number
    outputTokens: number
    cachedInputTokens: number
    totalTokens: number
    reasoningTokens: number
  }, modelUsed: string) {
    const { calculateProviderCostUsd } = await import("@/lib/cora/ai/pricing")
    const cost = calculateProviderCostUsd({ model: modelUsed, usage })
    const credits = creditFree ? 0 : providerCostToCoraCredits(cost, { billable: true })

    if (!creditFree && credits > 0) {
      const deducted = await deductGuestCoraCredits(guestId, credits, "Guest Cora chat", "guest_cora_chat")
      if (!deducted.ok) throw new Error("Insufficient Cora Credits — add a credit pack to continue.")
      creditsChargedTotal += credits
      creditsRemaining = deducted.remaining
    }

    void recordGuestCoraUsage({
      guestId,
      plan: guestPlan,
      model: modelUsed,
      usage,
      providerCostUsd: cost,
      creditsCharged: credits,
      operation: "guest_cora_chat",
      billable: !creditFree && credits > 0,
    }).catch((err) => console.error("[guest-cora] usage log failed", err))
  }

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const { completion, usage } = await coraGatewayChatCompletions({
      openai,
      context: usageContext,
      model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      temperature: routed.temperature,
      maxTokens: Math.min(2400, Math.max(900, routed.maxOutputTokens ?? 1600)),
      modelCallsSoFar: modelCalls,
      creditsChargedSoFar: creditsChargedTotal,
    })
    modelCalls += 1
    const normalizedUsage: RawModelUsage = {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cachedInputTokens: usage.cachedInputTokens,
      reasoningTokens: usage.reasoningTokens ?? 0,
      totalTokens: usage.totalTokens ?? usage.inputTokens + usage.outputTokens,
    }
    await chargeFromUsage(normalizedUsage, completion.model ?? model)

    const choice = completion.choices?.[0]
    const msg = choice?.message
    if (!msg) break

    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: msg.content ?? "",
      tool_calls: msg.tool_calls,
    }
    messages.push(assistantMsg)

    const calls = msg.tool_calls ?? []
    if (calls.length === 0) {
      return {
        content: (msg.content ?? "").trim(),
        modelUsed: completion.model ?? model,
        toolCalls: toolTrace,
        creditsCharged: creditsChargedTotal,
        creditsRemaining,
        routeProfile: routed.profile,
      }
    }

    for (const call of calls) {
      const name = call.function?.name as GuestCoraToolName
      const args = parseToolArgs(call.function?.arguments)
      toolTrace.push({ name, args })

      if (!allowed.includes(name)) {
        consecutiveToolFails += 1
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ error: "Tool not permitted for this Career Member account." }),
        })
        continue
      }

      try {
        const result = wrapUntrustedCoraData(
          await executeGuestCoraTool(name, args, { guestId, capabilities }),
        )
        consecutiveToolFails = 0
        messages.push({ role: "tool", tool_call_id: call.id, content: result })
      } catch {
        consecutiveToolFails += 1
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: wrapUntrustedCoraData(
            JSON.stringify({ error: "I couldn't complete that action. Please try again or contact support." }),
          ),
        })
      }
    }

    if (consecutiveToolFails >= 2) {
      const next = nextCoraEscalation({
        current: routed.profile,
        signal: "repeated_tool_failure",
        escalationsUsed,
        liteMode: coraLiteMode,
      })
      if (next) {
        escalationsUsed += 1
        model = next.model
        consecutiveToolFails = 0
      }
    }
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")
  const gated = applyCoraOutputSecurityGate({
    text: (lastAssistant?.content ?? "").trim() || "I couldn't complete that request. Please try again.",
    role: "guest",
  })
  return {
    content: gated.text,
    modelUsed: model,
    toolCalls: toolTrace,
    creditsCharged: creditsChargedTotal,
    creditsRemaining,
    routeProfile: routed.profile,
  }
}
