import { resolveModelForFeature } from "@/lib/resolve-feature-ai-model"
import {
  openaiToolsForNames,
  type CoraAgentToolName,
} from "@/lib/cora/tools/openai-tool-definitions"
import { executeCoraTool, type CoraToolActor } from "@/lib/cora/tools/execute-cora-tool"
import { agentPolicyForRole } from "@/lib/cora/agent/clearances"
import { detectCoraToolIntent, toolsForRoleAndIntent } from "@/lib/cora/agent/intent-tools"
import { resolveCoraCapabilities } from "@/lib/cora/security/capability-resolver"
import type { CoraAgentRole } from "@/lib/cora/roles"
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
import {
  appendCoraDisclosurePolicy,
  applyCoraOutputSecurityGate,
  disclosureRoleFromAgent,
  leastContextModulesForIntent,
  wrapUntrustedCoraData,
} from "@/lib/cora/disclosure"
import { getMaxAgentToolRounds } from "@/lib/cora/models/flags"
import { filterToolsForLite } from "@/lib/cora/agent/clearances"
import { nextCoraEscalation } from "@/lib/cora/models/escalation"
import {
  verificationContextFromMessage,
  verifyAndNormalizeQuestionDrafts,
} from "@/lib/cora/models/verification"

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool"
  content: string
  tool_call_id?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool_calls?: any[]
}

export type CoraTokenUsage = {
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  reasoningTokens?: number
  totalTokens?: number
}

export type CoraTurnPerf = {
  modelMs: number
  toolMs: number
  toolRounds: number
  totalMs: number
}

export type CoraAgentResult = {
  content: string
  modelUsed: string
  toolCalls: { name: string; args: Record<string, unknown> }[]
  usage: CoraTokenUsage
  creditsCharged: number
  perf?: CoraTurnPerf
  agentRunId?: string
  provider?: "openai" | "anthropic"
  artifacts?: {
    questionDraftsJson?: string
    proposals?: CoraActionProposal[]
    plans?: CoraTransactionPlan[]
    verification?: {
      status: string
      ran: boolean
      issues?: string[]
      verifierModel?: string
      verifierProvider?: string
    }
  }
}

function emptyUsage(): CoraTokenUsage {
  return { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, reasoningTokens: 0, totalTokens: 0 }
}

function addCompletionUsage(
  acc: CoraTokenUsage,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  completion: any,
): void {
  const u = completion?.usage
  if (!u) return
  acc.inputTokens += Number(u.prompt_tokens ?? u.input_tokens ?? 0)
  acc.outputTokens += Number(u.completion_tokens ?? u.output_tokens ?? 0)
  const cached =
    u.prompt_tokens_details?.cached_tokens ??
    u.input_tokens_details?.cached_tokens ??
    0
  acc.cachedInputTokens += Number(cached || 0)
}

/** Multi-module exam prep needs several read rounds + multiple propose_* calls. */
const MAX_TOOL_ROUNDS = getMaxAgentToolRounds()

function parseToolArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

/** Runs role-scoped Cora agent with OpenAI tool-calling loop. */
export async function runCoraAgent({
  openai,
  role,
  actor,
  session,
  systemPrompt,
  conversationHistory,
  userMessage,
  model: modelOverride,
  courseRoutingPolicy,
  coraLiteMode,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  openai: any
  role: CoraAgentRole
  actor: Omit<CoraToolActor, "role" | "session"> & { role?: CoraAgentRole; session?: CoraSession }
  session?: CoraSession
  systemPrompt: string
  conversationHistory: { role: string; content: string }[]
  userMessage: string
  /** Dynamic router pick — OpenAI-compatible model for the tool loop. */
  model?: string
  courseRoutingPolicy?: import("@/lib/cora/models/types").CoraModelRequestContext["courseRoutingPolicy"]
  coraLiteMode?: boolean
}): Promise<CoraAgentResult> {
  const {
    recordModelCall,
    startAgentRun,
    completeAgentRun,
    extractRawModelUsage,
    coraGatewayChatCompletions,
  } = await import("@/lib/cora/ai")
  const { resolveCoraDynamicRoute, routeUsesAnthropic } = await import(
    "@/lib/cora/ai/dynamic-router"
  )
  const { classifyCoraAgentTurn, classifyAfterTools } = await import(
    "@/lib/cora/ai/classify-usage"
  )
  let routed = resolveCoraDynamicRoute({
    message: userMessage,
    conversationHistory,
    forAgentTools: true,
    userRole: role === "assistant" ? "student" : role === "copilot" ? "instructor" : "admin",
    portal: role === "assistant" ? "student" : role === "copilot" ? "faculty" : "admin",
    membershipTier:
      (session?.membershipTier as string | null | undefined) ??
      (session?.instructorMembershipTier as string | null | undefined) ??
      (actor.session?.membershipTier as string | null | undefined) ??
      null,
    courseId: actor.courseId ?? session?.courseIds?.[0] ?? actor.session?.courseIds?.[0] ?? null,
    courseRoutingPolicy,
    coraLiteMode,
  })
  const intent = detectCoraToolIntent(userMessage)
  const turnClass = classifyCoraAgentTurn({
    intent,
    domain: routed.domain,
    complexity: routed.complexity,
    role,
    profile: routed.profile,
  })
  const useAnthropic = routeUsesAnthropic(routed)
  const model =
    (useAnthropic ? routed.modelId : routed.agentModelId) ||
    modelOverride?.trim() ||
    resolveModelForFeature("tutor")
  const toolTrace: CoraAgentResult["toolCalls"] = []
  let usage = emptyUsage()
  let creditsChargedTotal = 0
  let modelCalls = 0
  const resolvedSession = session ?? actor.session

  const userRole =
    role === "assistant" ? "student" : role === "copilot" ? "instructor" : "admin"
  const userId =
    userRole === "student"
      ? Number(actor.studentDbId ?? resolvedSession?.claims?.studentDbId ?? resolvedSession?.userId ?? 0)
      : userRole === "instructor"
        ? Number(
            actor.instructorId ?? resolvedSession?.claims?.instructorId ?? resolvedSession?.userId ?? 0,
          )
        : Number(resolvedSession?.claims?.adminId ?? resolvedSession?.userId ?? 0)

  const usageContext = {
    actor: {
      userId: userId || 0,
      userRole: userRole as "student" | "instructor" | "admin",
      membershipTier:
        (resolvedSession?.membershipTier as string | null | undefined) ??
        (resolvedSession?.instructorMembershipTier as string | null | undefined) ??
        null,
      courseId: actor.courseId ?? resolvedSession?.courseIds?.[0] ?? null,
      institutionId: resolvedSession?.institutionId ?? null,
    },
    feature: turnClass.feature,
    module: turnClass.module,
    operation: turnClass.operation,
    routingClass: turnClass.routingClass,
    billable: userId > 0,
    agentRunId: undefined as string | undefined,
    toolName: null as string | null,
    toolCallsCount: 0,
  }
  if (userId > 0) {
    try {
      usageContext.agentRunId = await startAgentRun({ context: usageContext })
    } catch {
      /* accounting must not break chat */
    }
  }

  const runStarted = Date.now()
  let modelMs = 0
  let toolMs = 0
  let toolRounds = 0
  const charge = () => Math.max(0, creditsChargedTotal)
  const resolvedCaps = resolvedSession
    ? resolveCoraCapabilities({
        session: resolvedSession,
        userMessage,
        instructorMembershipTier: resolvedSession.instructorMembershipTier ?? null,
      })
    : null
  const allowed = filterToolsForLite(
    resolvedCaps?.tools ?? toolsForRoleAndIntent(role, userMessage),
    role,
    coraLiteMode,
  )
  const tools = openaiToolsForNames(allowed)
  const fullActor: CoraToolActor = { ...actor, role, session: resolvedSession }
  const artifacts: CoraAgentResult["artifacts"] = {}

  async function trackCompletion(completion: unknown, provider: "OPENAI" | "ANTHROPIC" = "OPENAI") {
    const slice = extractRawModelUsage(completion)
    usage = {
      inputTokens: usage.inputTokens + slice.inputTokens,
      cachedInputTokens: usage.cachedInputTokens + slice.cachedInputTokens,
      outputTokens: usage.outputTokens + slice.outputTokens,
      reasoningTokens: (usage.reasoningTokens ?? 0) + slice.reasoningTokens,
      totalTokens:
        (usage.totalTokens ?? 0) +
        (slice.totalTokens || slice.inputTokens + slice.outputTokens),
    }
    modelCalls += 1
    if (userId > 0) {
      try {
        const recorded = await recordModelCall({
          context: usageContext,
          provider,
          model,
          rawResponse: completion,
          usage: slice,
        })
        creditsChargedTotal += recorded.creditsCharged
      } catch (err) {
        console.warn("[runCoraAgent] usage record failed", err)
      }
    }
  }

  async function gatewayRound(args: {
    model: string
    messages: ChatMessage[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools?: any[]
    temperature: number
    maxTokens: number
  }) {
    const t0 = Date.now()
    const { completion, creditsCharged } = await coraGatewayChatCompletions({
      openai,
      context: usageContext,
      model: args.model,
      messages: args.messages,
      tools: args.tools,
      temperature: args.temperature,
      maxTokens: args.maxTokens,
      modelCallsSoFar: modelCalls,
      creditsChargedSoFar: creditsChargedTotal,
    })
    modelMs += Date.now() - t0
    addCompletionUsage(usage, completion)
    modelCalls += 1
    creditsChargedTotal += creditsCharged
    return completion
  }

  const finish = (result: CoraAgentResult): CoraAgentResult => {
    const totalMs = Date.now() - runStarted
    void import("@/lib/cora/ai/turn-perf").then(({ logCoraTurnPerf }) => {
      logCoraTurnPerf({
        provider: result.provider,
        modelMs,
        toolMs,
        toolRounds,
        toolCalls: toolTrace.length,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        credits: charge(),
        totalMs,
      })
    })
    const gated = applyCoraOutputSecurityGate({
      text: result.content,
      role: disclosureRoleFromAgent(role),
      session: resolvedSession,
    })
    return {
      ...result,
      content: gated.text,
      perf: { modelMs, toolMs, toolRounds, totalMs },
    }
  }

  if (resolvedSession) {
    void logCoraAuditEvent({
      session: resolvedSession,
      action: "cora.agent.start",
      outcome: "success",
      modelUsed: model,
      promptText: userMessage,
      permissionChecks: [...resolvedSession.permissions],
      metadata: {
        tools: allowed,
        blockedTools: resolvedCaps?.blockedTools ?? [],
        intent,
        domain: routed.domain,
        profile: routed.profile,
        operation: turnClass.operation,
        module: turnClass.module,
        feature: turnClass.feature,
        provider: useAnthropic ? "anthropic" : "openai",
      },
    })
  }

  let systemContent = `${agentPolicyForRole(role)}\n\n${systemPrompt}`
  if (role === "assistant") {
    const { STUDENT_CORA_AUTHORIZATION_PRINCIPLE, buildStudentCapabilityPacket } = await import(
      "@/lib/cora/capabilities/student-module-registry"
    )
    const orchestrationHint =
      detectCoraToolIntent(userMessage) === "study_orchestration"
        ? [
            "ACTIVE TASK: multi-module exam/study orchestration.",
            "You MUST call read tools first, then emit propose_* confirmation cards in this same reply.",
            "Do NOT ask the student to paste CourseCollab data or type Confirm in chat.",
            "Do NOT stop after explaining a plan — proposals are how the plan becomes actionable.",
          ].join(" ")
        : ""
    systemContent = [
      agentPolicyForRole(role),
      STUDENT_CORA_AUTHORIZATION_PRINCIPLE,
      buildStudentCapabilityPacket(
        leastContextModulesForIntent("assistant", detectCoraToolIntent(userMessage)) as import("@/lib/cora/capabilities/student-module-registry").StudentCoraModuleId[],
      ),
      orchestrationHint,
      systemPrompt,
    ]
      .filter(Boolean)
      .join("\n\n")
  } else if (role === "copilot") {
    const { FACULTY_CORA_AUTHORIZATION_PRINCIPLE, buildFacultyCapabilityPacket } = await import(
      "@/lib/cora/capabilities/faculty-module-registry"
    )
    const { resolveModuleCapabilities } = await import(
      "@/lib/cora/capabilities/resolve-capabilities"
    )
    const moduleCaps = resolvedSession
      ? resolveModuleCapabilities({
          session: resolvedSession,
          membershipTier:
            resolvedSession.instructorMembershipTier ?? resolvedSession.membershipTier,
          focusModules: leastContextModulesForIntent("copilot", detectCoraToolIntent(userMessage)),
        })
      : null
    const blockedNote =
      resolvedCaps?.blockedTools?.length
        ? `\nMembership-gated (do not claim you performed these): ${resolvedCaps.blockedTools
            .map((b) => `${b.tool} — ${b.reason}`)
            .join("; ")}`
        : ""
    const lockedNote =
      moduleCaps?.lockedModules?.length
        ? `\nModules locked by membership (explain upgrade; do not call endpoints): ${moduleCaps.lockedModules
            .map((m) => `${m.label} [${m.minTier}]`)
            .join("; ")}`
        : ""
    systemContent = [
      agentPolicyForRole(role),
      FACULTY_CORA_AUTHORIZATION_PRINCIPLE,
      moduleCaps?.packet ?? buildFacultyCapabilityPacket(),
      blockedNote,
      lockedNote,
      systemPrompt,
    ]
      .filter(Boolean)
      .join("\n\n")
  } else if (role === "admin") {
    const { ADMIN_CORA_AUTHORIZATION_PRINCIPLE, buildAdminCapabilityPacket } = await import(
      "@/lib/cora/capabilities/admin-module-registry"
    )
    const { resolveModuleCapabilities } = await import(
      "@/lib/cora/capabilities/resolve-capabilities"
    )
    const moduleCaps = resolvedSession
      ? resolveModuleCapabilities({
          session: resolvedSession,
          focusModules: leastContextModulesForIntent("admin", detectCoraToolIntent(userMessage)),
        })
      : null
    const blockedNote =
      resolvedCaps?.blockedTools?.length
        ? `\nUnavailable (do not claim you performed these): ${resolvedCaps.blockedTools
            .map((b) => `${b.tool} — ${b.reason}`)
            .join("; ")}`
        : ""
    const plannedNote =
      moduleCaps?.lockedModules?.length
        ? `\nPlanned modules (no executable tools): ${moduleCaps.lockedModules
            .map((m) => m.label)
            .join("; ")}`
        : ""
    systemContent = [
      agentPolicyForRole(role),
      ADMIN_CORA_AUTHORIZATION_PRINCIPLE,
      moduleCaps?.packet ?? buildAdminCapabilityPacket(),
      blockedNote,
      plannedNote,
      systemPrompt,
    ]
      .filter(Boolean)
      .join("\n\n")
  }

  systemContent = appendCoraDisclosurePolicy(systemContent)

  // Claude tool-use path when dynamic router prefers Anthropic (e.g. coding).
  if (useAnthropic) {
    try {
      const { runAnthropicCoraToolLoop } = await import(
        "@/lib/cora/agent/run-cora-agent-anthropic"
      )
      const anthropicResult = await runAnthropicCoraToolLoop({
        model,
        systemContent,
        conversationHistory,
        userMessage,
        allowedTools: allowed,
        actor: fullActor,
        session: resolvedSession,
        temperature: routed.temperature,
        maxTokens: Math.min(2200, Math.max(900, routed.maxTokens)),
        onModelCall: async (response) => {
          await trackCompletion(response, "ANTHROPIC")
        },
      })
      toolTrace.push(...anthropicResult.toolCalls)
      if (anthropicResult.artifacts.proposals?.length) {
        artifacts.proposals = [
          ...(artifacts.proposals ?? []),
          ...anthropicResult.artifacts.proposals,
        ]
      }
      if (anthropicResult.artifacts.plans?.length) {
        artifacts.plans = [...(artifacts.plans ?? []), ...anthropicResult.artifacts.plans]
      }
      if (anthropicResult.artifacts.questionDraftsJson) {
        const verified = await verifyAndNormalizeQuestionDrafts({
          draftsJson: anthropicResult.artifacts.questionDraftsJson,
          generatorProvider: "anthropic",
          context: verificationContextFromMessage({
            userRole: role === "assistant" ? "student" : role === "copilot" ? "instructor" : "admin",
            portal: role === "assistant" ? "student" : role === "copilot" ? "faculty" : "admin",
            message: userMessage,
            coraLiteMode,
          }),
        })
        artifacts.questionDraftsJson = verified.draftsJson
        artifacts.verification = verified.verification
      }
      usage = anthropicResult.usage
      modelCalls = anthropicResult.modelCalls

      const refined = classifyAfterTools(
        turnClass,
        anthropicResult.toolCalls.map((t) => t.name),
      )
      usageContext.feature = refined.feature
      usageContext.module = refined.module
      usageContext.operation = refined.operation
      usageContext.toolName = anthropicResult.toolCalls[0]?.name ?? null
      usageContext.toolCallsCount = anthropicResult.toolCalls.length

      if (usageContext.agentRunId) {
        try {
          await completeAgentRun({
            agentRunId: usageContext.agentRunId,
            status: "success",
            totals: {
              modelCalls,
              toolCalls: toolTrace.length,
              inputTokens: usage.inputTokens,
              cachedInputTokens: usage.cachedInputTokens,
              outputTokens: usage.outputTokens,
              reasoningTokens: usage.reasoningTokens ?? 0,
              totalTokens: usage.totalTokens ?? usage.inputTokens + usage.outputTokens,
              providerCostUsd: 0,
              creditsCharged: charge(),
            },
            latencyMs: Date.now() - runStarted,
          })
        } catch {
          /* ignore */
        }
      }

      toolRounds = Math.max(toolRounds, anthropicResult.toolCalls.length ? 1 : 0)
      return finish({
        content: anthropicResult.content,
        modelUsed: anthropicResult.modelUsed,
        toolCalls: toolTrace,
        usage,
        creditsCharged: charge(),
        agentRunId: usageContext.agentRunId,
        provider: "anthropic",
        artifacts,
      })
    } catch (err) {
      console.warn("[runCoraAgent] Anthropic tool loop failed, falling back to OpenAI", err)
      if (!isOpenAiConfigured()) {
        throw err
      }
    }
  }

  let openAiModel =
    useAnthropic && isOpenAiConfigured()
      ? routed.agentModelId || resolveModelForFeature("tutor")
      : model
  let escalationsUsed = 0
  let consecutiveToolFails = 0

  const messages: ChatMessage[] = [
    { role: "system", content: systemContent },
    ...conversationHistory.slice(-10).map((m) => ({
      role: (m.role === "student" || m.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ]

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await gatewayRound({
      model: openAiModel,
      messages,
      tools: tools.length ? tools : undefined,
      temperature: routed.temperature,
      maxTokens: Math.min(2200, Math.max(900, routed.maxTokens)),
    })

    const choice = completion.choices[0]?.message
    if (!choice) {
      if (resolvedSession) {
        void logCoraAuditEvent({
          session: resolvedSession,
          action: "cora.agent.empty",
          outcome: "error",
          modelUsed: openAiModel,
          errorMessage: "empty_completion",
          metadata: { operation: usageContext.operation, module: usageContext.module },
        })
      }
      return finish({
        content: "I couldn't generate a response. Please try again.",
        modelUsed: openAiModel,
        toolCalls: toolTrace,
        usage,
        creditsCharged: charge(),
        provider: "openai",
        artifacts,
      })
    }

    const toolCalls = choice.tool_calls ?? []
    if (toolCalls.length === 0) {
      const text = choice.content?.trim() || "I couldn't generate a response. Please try again."
      const refined = classifyAfterTools(
        turnClass,
        toolTrace.map((t) => t.name),
      )
      usageContext.feature = refined.feature
      usageContext.module = refined.module
      usageContext.operation = toolTrace.length ? refined.operation : turnClass.operation
      usageContext.toolName = toolTrace[0]?.name ?? null
      usageContext.toolCallsCount = toolTrace.length
      if (resolvedSession) {
        void logCoraAuditEvent({
          session: resolvedSession,
          action: "cora.agent.complete",
          outcome: "success",
          modelUsed: openAiModel,
          promptText: userMessage,
          responseText: text,
          metadata: {
            tool_calls: toolTrace,
            usage,
            operation: usageContext.operation,
            module: usageContext.module,
            feature: usageContext.feature,
            intent,
          },
        })
      }
      if (usageContext.agentRunId) {
        try {
          await completeAgentRun({
            agentRunId: usageContext.agentRunId,
            status: "success",
            totals: {
              modelCalls,
              toolCalls: toolTrace.length,
              inputTokens: usage.inputTokens,
              cachedInputTokens: usage.cachedInputTokens,
              outputTokens: usage.outputTokens,
              reasoningTokens: usage.reasoningTokens ?? 0,
              totalTokens: usage.totalTokens ?? usage.inputTokens + usage.outputTokens,
              providerCostUsd: 0,
              creditsCharged: charge(),
            },
            latencyMs: Date.now() - runStarted,
          })
        } catch {
          /* ignore */
        }
      }
      return finish({
        content: text,
        modelUsed: openAiModel,
        toolCalls: toolTrace,
        usage,
        creditsCharged: charge(),
        provider: "openai",
        artifacts,
      })
    }

    messages.push({
      role: "assistant",
      content: choice.content ?? "",
      tool_calls: toolCalls,
    })

    toolRounds += 1
    for (const call of toolCalls) {
      if (call.type !== "function") continue
      const name = call.function.name as CoraAgentToolName
      const args = parseToolArgs(call.function.arguments)
      toolTrace.push({ name, args })
      usageContext.toolName = name
      usageContext.toolCallsCount = toolTrace.length
      const refined = classifyAfterTools(turnClass, [name])
      usageContext.feature = refined.feature
      usageContext.module = refined.module
      usageContext.operation = name

      let result = "Denied: tool not available in this mode."
      if (allowed.includes(name)) {
        const t0 = Date.now()
        result = wrapUntrustedCoraData(await executeCoraTool(fullActor, name, args))
        toolMs += Date.now() - t0
      }
      const denied = result.startsWith("Denied")
      const invalid =
        denied ||
        result.startsWith("Error:") ||
        /invalid (json|args|schema)/i.test(result)
      if (invalid) {
        consecutiveToolFails += 1
        const signal =
          consecutiveToolFails >= 2 ? "repeated_tool_failure" : "tool_args_invalid"
        const next = nextCoraEscalation({
          current: routed.profile ?? "standard",
          signal,
          escalationsUsed,
          liteMode: coraLiteMode,
        })
        if (next) {
          escalationsUsed += 1
          openAiModel = next.model
        }
      } else {
        consecutiveToolFails = 0
      }
      if (resolvedSession) {
        void logCoraAuditEvent({
          session: resolvedSession,
          action: denied ? "cora.tool.blocked" : "cora.tool.execute",
          toolName: name,
          outcome: denied ? "blocked" : "success",
          modelUsed: openAiModel,
          metadata: { args, module: usageContext.module, operation: name },
          errorMessage: denied ? result : null,
        })
      }

      const draftMarker = "\n__DRAFTS_JSON__:"
      const draftIdx = result.indexOf(draftMarker)
      if (draftIdx >= 0) {
        artifacts.questionDraftsJson = result.slice(draftIdx + draftMarker.length)
        const draftBlob = artifacts.questionDraftsJson
        const proposalInDraft = extractProposalsFromToolText(draftBlob)
        if (proposalInDraft.proposals.length) {
          artifacts.proposals = [...(artifacts.proposals ?? []), ...proposalInDraft.proposals]
          artifacts.questionDraftsJson = proposalInDraft.cleanText
        }
        result = result.slice(0, draftIdx)
        let draftsValid = true
        try {
          JSON.parse(artifacts.questionDraftsJson || "null")
        } catch {
          draftsValid = false
          const next = nextCoraEscalation({
            current: routed.profile ?? "standard",
            signal: "schema_validation_failed",
            escalationsUsed,
            liteMode: coraLiteMode,
          })
          if (next) {
            escalationsUsed += 1
            openAiModel = next.model
          }
        }
        if (draftsValid && artifacts.questionDraftsJson) {
          const verified = await verifyAndNormalizeQuestionDrafts({
            draftsJson: artifacts.questionDraftsJson,
            generatorProvider: "openai",
            context: verificationContextFromMessage({
              userRole: role === "assistant" ? "student" : role === "copilot" ? "instructor" : "admin",
              portal: role === "assistant" ? "student" : role === "copilot" ? "faculty" : "admin",
              message: userMessage,
              coraLiteMode,
            }),
          })
          artifacts.questionDraftsJson = verified.draftsJson
          artifacts.verification = verified.verification
          if (verified.escalate) {
            const next = nextCoraEscalation({
              current: routed.profile ?? "standard",
              signal: "verifier_rejected",
              escalationsUsed,
              liteMode: coraLiteMode,
            })
            if (next) {
              escalationsUsed += 1
              openAiModel = next.model
            }
          }
        }
      }

      const extracted = extractProposalsFromToolText(result)
      result = extracted.cleanText
      if (extracted.proposals.length) {
        artifacts.proposals = [...(artifacts.proposals ?? []), ...extracted.proposals]
      }
      const planExtracted = extractPlansFromToolText(result)
      result = planExtracted.cleanText
      if (planExtracted.plans.length) {
        artifacts.plans = [...(artifacts.plans ?? []), ...planExtracted.plans]
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result.slice(0, 12000),
      })
    }
  }

  const final = await gatewayRound({
    model: openAiModel,
    messages,
    temperature: 0.5,
    maxTokens: 1600,
  })

  const text =
    final.choices[0]?.message?.content?.trim() ||
    "I gathered CourseCollab data but couldn't finish the summary. Please try again."

  if (usageContext.agentRunId) {
    try {
      await completeAgentRun({
        agentRunId: usageContext.agentRunId,
        status: "success",
        totals: {
          modelCalls,
          toolCalls: toolTrace.length,
          inputTokens: usage.inputTokens,
          cachedInputTokens: usage.cachedInputTokens,
          outputTokens: usage.outputTokens,
          reasoningTokens: usage.reasoningTokens ?? 0,
          totalTokens: usage.totalTokens ?? usage.inputTokens + usage.outputTokens,
          providerCostUsd: 0,
          creditsCharged: charge(),
        },
        latencyMs: Date.now() - runStarted,
      })
    } catch {
      /* ignore */
    }
  }

  if (resolvedSession) {
    void logCoraAuditEvent({
      session: resolvedSession,
      action: "cora.agent.complete",
      outcome: "success",
      modelUsed: openAiModel,
      promptText: userMessage,
      responseText: text,
      metadata: {
        tool_calls: toolTrace,
        usage,
        operation: usageContext.operation,
        module: usageContext.module,
        feature: usageContext.feature,
        rounds: MAX_TOOL_ROUNDS,
      },
    })
  }

  return finish({
    content: text,
    modelUsed: openAiModel,
    toolCalls: toolTrace,
    usage,
    creditsCharged: charge(),
    agentRunId: usageContext.agentRunId,
    provider: "openai",
    artifacts,
  })
}

function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim())
}


/** @deprecated use agentPolicyForRole("assistant") */
export const CORA_AGENT_TOOL_POLICY = agentPolicyForRole("assistant")
