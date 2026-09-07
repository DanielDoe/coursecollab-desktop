/**
 * Production Cora agent entry. Routes by capability profile; never trusts a client model id.
 */

import { runCoraAgent, type CoraAgentResult } from "@/lib/cora/agent/run-cora-agent"
import { runGuestCoraAgent, type GuestCoraAgentResult } from "@/lib/cora/agent/run-guest-cora-agent"
import { routeCoraModel } from "@/lib/cora/models/router"
import type { CoraModelProfile, CoraModelRequestContext, CoraToolCall } from "@/lib/cora/models/types"
import type { CoraAgentRole } from "@/lib/cora/roles"
import type { CoraToolActor } from "@/lib/cora/tools/execute-cora-tool"
import type { CoraSession } from "@/lib/cora/security/types"
import type { GuestCapability, GuestPlan } from "@/lib/guest/types"
import {
  evaluateCoraDisclosureGate,
  disclosureRoleFromAgent,
} from "@/lib/cora/disclosure"

export function toCoraToolCalls(
  calls: { name: string; args: Record<string, unknown> }[],
): CoraToolCall[] {
  return calls.map((call, index) => ({
    id: `tool_${index}_${call.name}`,
    toolName: call.name,
    arguments: call.args,
  }))
}

export async function runCoraAgentRuntime(args: {
  openai: unknown
  role: CoraAgentRole
  actor: Omit<CoraToolActor, "role" | "session"> & { role?: CoraAgentRole; session?: CoraSession }
  session?: CoraSession
  systemPrompt: string
  conversationHistory: { role: string; content: string }[]
  userMessage: string
  requestContext: CoraModelRequestContext
  profile?: CoraModelProfile
}): Promise<CoraAgentResult & { routeProfile: CoraModelProfile; toolCallsNormalized: CoraToolCall[] }> {
  const routed = routeCoraModel({
    ...args.requestContext,
    message: args.userMessage,
    conversationHistory: args.conversationHistory,
    clientProfileHint: null,
  })
  const profile = args.profile ?? routed.profile
  const disclosure = await evaluateCoraDisclosureGate({
    role: disclosureRoleFromAgent(args.role),
    message: args.userMessage,
    conversationHistory: args.conversationHistory,
    session: args.session ?? args.actor.session ?? null,
  })
  if (disclosure.decision !== "ALLOW" && disclosure.userMessage) {
    return {
      content: disclosure.userMessage,
      modelUsed: "cora-disclosure-gate",
      toolCalls: [],
      usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, totalTokens: 0 },
      creditsCharged: 0,
      routeProfile: profile,
      toolCallsNormalized: [],
    }
  }
  const result = await runCoraAgent({
    openai: args.openai,
    role: args.role,
    actor: args.actor,
    session: args.session,
    systemPrompt: args.systemPrompt,
    conversationHistory: args.conversationHistory,
    userMessage: args.userMessage,
    courseRoutingPolicy: args.requestContext.courseRoutingPolicy,
    coraLiteMode: args.requestContext.coraLiteMode,
  })
  return {
    ...result,
    routeProfile: profile,
    toolCallsNormalized: toCoraToolCalls(result.toolCalls),
  }
}

/** Career / guest entry — same router + gateway loop as student/faculty, guest tools only. */
export async function runCoraGuestRuntime(args: {
  openai: unknown
  guestId: number
  capabilities: readonly GuestCapability[]
  systemPrompt: string
  conversationHistory: { role: string; content: string }[]
  userMessage: string
  creditFree?: boolean
  guestPlan?: GuestPlan
  requestContext: CoraModelRequestContext
}): Promise<GuestCoraAgentResult & { routeProfile: CoraModelProfile; toolCallsNormalized: CoraToolCall[] }> {
  const routed = routeCoraModel({
    ...args.requestContext,
    userRole: "guest",
    portal: "career",
    message: args.userMessage,
    conversationHistory: args.conversationHistory,
    clientProfileHint: null,
  })
  const disclosure = await evaluateCoraDisclosureGate({
    role: "guest",
    message: args.userMessage,
    conversationHistory: args.conversationHistory,
  })
  if (disclosure.decision !== "ALLOW" && disclosure.userMessage) {
    return {
      content: disclosure.userMessage,
      modelUsed: "cora-disclosure-gate",
      toolCalls: [],
      creditsCharged: 0,
      creditsRemaining: null,
      routeProfile: routed.profile,
      toolCallsNormalized: [],
    }
  }
  const result = await runGuestCoraAgent({
    openai: args.openai,
    guestId: args.guestId,
    capabilities: args.capabilities,
    systemPrompt: args.systemPrompt,
    conversationHistory: args.conversationHistory,
    userMessage: args.userMessage,
    creditFree: args.creditFree,
    guestPlan: args.guestPlan,
    coraLiteMode: args.requestContext.coraLiteMode,
  })
  return {
    ...result,
    routeProfile: routed.profile,
    toolCallsNormalized: toCoraToolCalls(result.toolCalls),
  }
}
