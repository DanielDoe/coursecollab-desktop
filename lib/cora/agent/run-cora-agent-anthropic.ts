/**
 * Anthropic (Claude) tool-use agent loop — mirrors OpenAI runCoraAgent tool rounds.
 */

import type Anthropic from "@anthropic-ai/sdk"
import { getAnthropicClient } from "@/lib/anthropic-chat"
import {
  anthropicToolsForNames,
  type CoraAgentToolName,
} from "@/lib/cora/tools/openai-tool-definitions"
import { executeCoraTool, type CoraToolActor } from "@/lib/cora/tools/execute-cora-tool"
import {
  extractProposalsFromToolText,
  type CoraActionProposal,
} from "@/lib/cora/confirmations/action-proposals"
import {
  extractPlansFromToolText,
  type CoraTransactionPlan,
} from "@/lib/cora/confirmations/transaction-plans"
import type { CoraSession } from "@/lib/cora/security/types"
import { logCoraAuditEvent } from "@/lib/cora/security/audit"
import type { CoraTokenUsage } from "@/lib/cora/agent/run-cora-agent"

import { getMaxAgentToolRounds } from "@/lib/cora/models/flags"

const MAX_TOOL_ROUNDS = getMaxAgentToolRounds()

function emptyUsage(): CoraTokenUsage {
  return { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, reasoningTokens: 0, totalTokens: 0 }
}

function addAnthropicUsage(acc: CoraTokenUsage, response: Anthropic.Message): void {
  const u = response.usage
  if (!u) return
  acc.inputTokens += Number(u.input_tokens ?? 0)
  acc.outputTokens += Number(u.output_tokens ?? 0)
  acc.totalTokens = (acc.totalTokens ?? 0) + Number(u.input_tokens ?? 0) + Number(u.output_tokens ?? 0)
}

function parseToolArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return {}
}

async function processToolResultText(
  result: string,
  artifacts: {
    questionDraftsJson?: string
    proposals?: CoraActionProposal[]
    plans?: CoraTransactionPlan[]
  },
): Promise<string> {
  let next = result
  const draftMarker = "\n__DRAFTS_JSON__:"
  const draftIdx = next.indexOf(draftMarker)
  if (draftIdx >= 0) {
    artifacts.questionDraftsJson = next.slice(draftIdx + draftMarker.length)
    const draftBlob = artifacts.questionDraftsJson
    const proposalInDraft = extractProposalsFromToolText(draftBlob)
    if (proposalInDraft.proposals.length) {
      artifacts.proposals = [...(artifacts.proposals ?? []), ...proposalInDraft.proposals]
      artifacts.questionDraftsJson = proposalInDraft.cleanText
    }
    next = next.slice(0, draftIdx)
  }
  const extracted = extractProposalsFromToolText(next)
  next = extracted.cleanText
  if (extracted.proposals.length) {
    artifacts.proposals = [...(artifacts.proposals ?? []), ...extracted.proposals]
  }
  const planExtracted = extractPlansFromToolText(next)
  next = planExtracted.cleanText
  if (planExtracted.plans.length) {
    artifacts.plans = [...(artifacts.plans ?? []), ...planExtracted.plans]
  }
  return next
}

export type AnthropicAgentLoopResult = {
  content: string
  modelUsed: string
  toolCalls: { name: string; args: Record<string, unknown> }[]
  usage: CoraTokenUsage
  artifacts: {
    questionDraftsJson?: string
    proposals?: CoraActionProposal[]
    plans?: CoraTransactionPlan[]
  }
  modelCalls: number
}

export async function runAnthropicCoraToolLoop(opts: {
  model: string
  systemContent: string
  conversationHistory: { role: string; content: string }[]
  userMessage: string
  allowedTools: readonly CoraAgentToolName[]
  actor: CoraToolActor
  session?: CoraSession | null
  temperature: number
  maxTokens: number
  onModelCall?: (response: Anthropic.Message) => Promise<void>
}): Promise<AnthropicAgentLoopResult> {
  const client = getAnthropicClient()
  if (!client) {
    throw new Error("ANTHROPIC_API_KEY is not configured")
  }

  const tools = anthropicToolsForNames(opts.allowedTools)
  const toolTrace: AnthropicAgentLoopResult["toolCalls"] = []
  const artifacts: AnthropicAgentLoopResult["artifacts"] = {}
  let usage = emptyUsage()
  let modelCalls = 0
  let modelUsed = opts.model

  const history: Anthropic.MessageParam[] = [
    ...opts.conversationHistory.slice(-10).map((m) => ({
      role: (m.role === "student" || m.role === "user" ? "user" : "assistant") as
        | "user"
        | "assistant",
      content: m.content,
    })),
    { role: "user", content: opts.userMessage },
  ]

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const omitTemperature = opts.model.toLowerCase().includes("opus")
    const response = await client.messages.create({
      model: opts.model,
      system: opts.systemContent,
      messages: history,
      max_tokens: Math.min(2200, Math.max(900, opts.maxTokens)),
      ...(!omitTemperature ? { temperature: opts.temperature } : {}),
      ...(tools.length ? { tools } : {}),
    })
    modelUsed = response.model || opts.model
    addAnthropicUsage(usage, response)
    modelCalls += 1
    if (opts.onModelCall) await opts.onModelCall(response)

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    )
    const textParts = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()

    if (!toolUses.length) {
      const text = textParts || "I couldn't generate a response. Please try again."
      if (opts.session) {
        void logCoraAuditEvent({
          session: opts.session,
          action: "cora.chat.complete",
          outcome: "success",
          modelUsed,
          promptText: opts.userMessage,
          responseText: text,
          metadata: { tool_calls: toolTrace, usage, provider: "anthropic" },
        })
      }
      return {
        content: text,
        modelUsed,
        toolCalls: toolTrace,
        usage,
        artifacts,
        modelCalls,
      }
    }

    history.push({ role: "assistant", content: response.content })

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const call of toolUses) {
      const name = call.name as CoraAgentToolName
      const args = parseToolArgs(call.input)
      toolTrace.push({ name, args })

      const { wrapUntrustedCoraData } = await import("@/lib/cora/disclosure/sanitize-tool-result")
      let result = opts.allowedTools.includes(name)
        ? wrapUntrustedCoraData(await executeCoraTool(opts.actor, name, args))
        : "Denied: tool not available in this mode."
      const denied = result.startsWith("Denied")
      if (opts.session) {
        void logCoraAuditEvent({
          session: opts.session,
          action: denied ? "cora.tool.blocked" : "cora.tool.execute",
          toolName: name,
          outcome: denied ? "blocked" : "success",
          modelUsed,
          metadata: { args, provider: "anthropic" },
          errorMessage: denied ? result : null,
        })
      }
      result = await processToolResultText(result, artifacts)
      toolResults.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: result.slice(0, 12000),
      })
    }
    history.push({ role: "user", content: toolResults })
  }

  const final = await client.messages.create({
    model: opts.model,
    system: opts.systemContent,
    messages: history,
    max_tokens: 1600,
    temperature: 0.5,
  })
  addAnthropicUsage(usage, final)
  modelCalls += 1
  if (opts.onModelCall) await opts.onModelCall(final)
  modelUsed = final.model || opts.model

  const text =
    final.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim() ||
    "I gathered CourseCollab data but couldn't finish the summary. Please try again."

  return {
    content: text,
    modelUsed,
    toolCalls: toolTrace,
    usage,
    artifacts,
    modelCalls,
  }
}
