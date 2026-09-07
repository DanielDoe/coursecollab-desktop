import type { CoraSession } from "@/lib/cora/security/types"
import { logCoraAuditEvent } from "@/lib/cora/security/audit"
import { getCoraScopeConfig } from "@/lib/cora/scope/config"
import { classifyCoraPurposeScope } from "@/lib/cora/scope/deterministic-classifier"
import {
  classifyCoraPurposeWithLlm,
  isCoraScopeLlmClassifyEnabled,
} from "@/lib/cora/scope/llm-classifier"
import { buildCoraScopeProfile, emptyCoraScopeProfile } from "@/lib/cora/scope/profile"
import {
  coraScopeRedirectMessage,
  coraScopeRepeatRedirectMessage,
} from "@/lib/cora/scope/redirect-copy"
import { recordCoraScopeEvent } from "@/lib/cora/scope/events"
import type {
  CoraScopeClassificationResult,
  CoraScopeDecision,
  CoraScopeEvaluation,
} from "@/lib/cora/scope/types"

type EvaluateArgs = {
  session: CoraSession | null
  role: CoraSession["role"]
  message: string
  conversationHistory?: Array<{ role: string; content: string }>
  /** Prior REDIRECT count in this conversation (optional) */
  priorRedirectCount?: number
  program?: string | null
  department?: string | null
  courseTopics?: string[]
  academicDomains?: string[]
  assessmentContext?: CoraScopeEvaluation["profile"]["assessmentContext"]
  /**
   * One-shot override after user says redirect was a false positive.
   * Does NOT expand tool/data permissions — only purpose scope ALLOW.
   */
  confirmScopeRelated?: boolean
  declaredAcademicContext?: string | null
}

function decisionFromClassification(
  academicPurpose: boolean,
  classification: string,
  confidence: number,
): CoraScopeDecision {
  if (classification === "CLEARLY_UNRELATED" && !academicPurpose && confidence >= 0.85) {
    return "REDIRECT"
  }
  if (classification === "UNCERTAIN") return "ALLOW"
  if (academicPurpose) return "ALLOW"
  return "ALLOW" // bias allow
}

function needsLlmAssist(det: CoraScopeClassificationResult, message: string): boolean {
  if (!isCoraScopeLlmClassifyEnabled()) return false
  if (det.classification === "CLEARLY_UNRELATED" && det.confidence >= 0.9) return false
  if (det.classification === "UNCERTAIN" && message.trim().length >= 40) return true
  // Soft personal words without hard unrelated hit — ask cheap model
  if (
    det.academicPurpose &&
    det.confidence < 0.7 &&
    /\b(trip|travel|dinner|weekend|party|shopping)\b/i.test(message)
  ) {
    return true
  }
  return false
}

/**
 * Academic-purpose scope evaluation.
 * Does NOT replace integrity or tool authorization.
 */
export async function evaluateCoraPurposeScope(args: EvaluateArgs): Promise<CoraScopeEvaluation> {
  const config = getCoraScopeConfig()
  const profile = args.session
    ? buildCoraScopeProfile({
        session: args.session,
        program: args.program,
        department: args.department,
        courseTopics: args.courseTopics,
        academicDomains: args.academicDomains,
      })
    : emptyCoraScopeProfile(args.role)

  if (args.assessmentContext) {
    profile.assessmentContext = { ...profile.assessmentContext, ...args.assessmentContext }
  }

  if (config.mode === "off") {
    return {
      classification: "UNCERTAIN",
      confidence: 1,
      academicPurpose: true,
      matchedContext: [],
      reasonCode: "SCOPE_DISABLED",
      decision: "ALLOW",
      mode: "off",
      shouldEnforce: false,
      userMessage: null,
      creditsCharged: null,
      profile,
      scopeEventId: null,
      offerFeedback: false,
    }
  }

  // False-positive retry: user declared academic framing — allow purpose only
  if (args.confirmScopeRelated) {
    const declared = String(args.declaredAcademicContext ?? "").trim()
    const evaluation: CoraScopeEvaluation = {
      classification: "ACADEMIC_RELATED",
      confidence: 0.95,
      academicPurpose: true,
      matchedContext: declared ? ["user_declared_context"] : ["user_feedback_override"],
      reasonCode: declared ? "DECLARED_EXTERNAL_COURSE" : "LEGITIMATE_ACADEMIC_REQUEST",
      decision: "ALLOW",
      mode: config.mode,
      shouldEnforce: false,
      userMessage: null,
      creditsCharged: null,
      profile,
      scopeEventId: null,
      offerFeedback: false,
    }
    if (args.session) {
      void logCoraAuditEvent({
        session: args.session,
        action: "cora.scope.feedback_allow",
        outcome: "success",
        promptText: args.message,
        metadata: { declaredAcademicContext: declared.slice(0, 300) },
      })
    }
    return evaluation
  }

  let classified = classifyCoraPurposeScope({
    role: args.role,
    message: args.message,
    conversationHistory: args.conversationHistory,
    profile,
  })

  let classifierProviderCostUsd = 0
  if (needsLlmAssist(classified, args.message)) {
    const llm = await classifyCoraPurposeWithLlm({
      role: args.role,
      message: args.message,
      conversationHistory: args.conversationHistory,
    })
    if (llm) {
      classifierProviderCostUsd = llm.providerCostUsd
      // Prefer LLM only when it is more decisive; never let LLM tighten a clear ALLOW
      if (classified.classification === "UNCERTAIN") {
        classified = llm.result
      } else if (
        llm.result.academicPurpose &&
        classified.classification === "CLEARLY_UNRELATED"
      ) {
        // LLM rescues false positive
        classified = llm.result
      }
    }
  }

  let decision = decisionFromClassification(
    classified.academicPurpose,
    classified.classification,
    classified.confidence,
  )

  if (
    classified.classification === "CLEARLY_UNRELATED" &&
    classified.confidence >= 0.85 &&
    !classified.academicPurpose
  ) {
    decision = "REDIRECT"
  } else if (classified.academicPurpose) {
    decision = "ALLOW"
  }

  const shouldEnforce = config.mode === "enforce" && decision === "REDIRECT"
  const prior = args.priorRedirectCount ?? 0
  const userMessage =
    decision === "REDIRECT"
      ? prior > 0
        ? coraScopeRepeatRedirectMessage(args.role)
        : coraScopeRedirectMessage(args.role)
      : null

  const scopeEventId = await recordCoraScopeEvent({
    userId: args.session?.userId ?? null,
    userRole: args.role,
    institutionId: args.session?.institutionId ?? null,
    classification: classified.classification,
    decision,
    confidence: classified.confidence,
    reasonCode: classified.reasonCode,
    mode: config.mode,
    enforced: shouldEnforce,
    creditsCharged: shouldEnforce ? 0 : 0,
  })

  const evaluation: CoraScopeEvaluation = {
    ...classified,
    decision,
    mode: config.mode,
    shouldEnforce,
    userMessage,
    creditsCharged: shouldEnforce ? 0 : null,
    profile,
    scopeEventId,
    offerFeedback: shouldEnforce,
    classifierProviderCostUsd,
  }

  if (args.session) {
    void logCoraAuditEvent({
      session: args.session,
      action: shouldEnforce ? "cora.scope.redirect" : "cora.scope.observe",
      outcome: shouldEnforce ? "blocked" : "success",
      promptText: args.message,
      errorMessage: shouldEnforce ? classified.reasonCode : null,
      metadata: {
        scopeClassification: classified.classification,
        scopeDecision: decision,
        scopeConfidence: classified.confidence,
        scopeReasonCode: classified.reasonCode,
        scopeMode: config.mode,
        academicPurpose: classified.academicPurpose,
        matchedContext: classified.matchedContext,
        creditsCharged: shouldEnforce ? 0 : null,
        scopeEventId,
        classifierProviderCostUsd,
      },
    })
  }

  return evaluation
}
