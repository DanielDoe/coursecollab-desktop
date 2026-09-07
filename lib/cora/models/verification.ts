import OpenAI from "openai"
import { createWithFallback } from "@/lib/openai-with-fallback"
import { isCoraCrossModelVerificationEnabled } from "@/lib/cora/models/flags"
import { resolveCoraVerifierDeployment } from "@/lib/cora/models/registry"
import type {
  CoraModelProvider,
  CoraModelRequestContext,
  CoraPortal,
  CoraUserRole,
} from "@/lib/cora/models/types"

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null

export type CoraVerificationArtifact = {
  status: "verified" | "repaired" | "rejected" | "error" | "skipped"
  ran: boolean
  issues?: string[]
  verifierModel?: string
  verifierProvider?: string
}

export type CoraDraftVerificationResult = {
  draftsJson: string
  verification: CoraVerificationArtifact
  escalate: boolean
}

export function isExamVerificationContext(context: CoraModelRequestContext): boolean {
  if (context.assessmentContext === "final" || context.assessmentContext === "exam") return true
  if (context.taskCategory === "assessment_exam") return true
  if (context.requestedOperation === "verify" || context.requestedOperation === "validate_exam") {
    return true
  }
  return false
}

/** Exams always verify. The env flag only adds extra high-impact checks. Lite never verifies. */
export function shouldVerifyTask(context: CoraModelRequestContext): boolean {
  if (context.coraLiteMode) return false
  if (isExamVerificationContext(context)) return true
  if (!isCoraCrossModelVerificationEnabled()) return false
  if (context.highImpact && context.riskLevel === "critical") return true
  return false
}

export function resolveVerifierForGenerator(generatorProvider: CoraModelProvider) {
  return resolveCoraVerifierDeployment(generatorProvider)
}

export function verificationContextFromMessage(args: {
  userRole: CoraUserRole
  portal: CoraPortal
  message: string
  coraLiteMode?: boolean
}): CoraModelRequestContext {
  const examLike = /\b(exam|midterm|final)\b/i.test(args.message)
  return {
    userRole: args.userRole,
    portal: args.portal,
    message: args.message,
    assessmentContext: /final/i.test(args.message) ? "final" : examLike ? "exam" : null,
    highImpact: examLike,
    taskCategory: examLike ? "assessment_exam" : undefined,
    coraLiteMode: args.coraLiteMode,
  }
}

export function parseCoraVerifierPayload(raw: string): {
  ok: boolean
  issues: string[]
  repairedDraftsJson?: string
} {
  const trimmed = String(raw ?? "").trim()
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  const jsonText = start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed
  try {
    const parsed = JSON.parse(jsonText) as {
      ok?: unknown
      issues?: unknown
      repairedDrafts?: unknown
    }
    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.map((item) => String(item)).filter(Boolean)
      : []
    let repairedDraftsJson: string | undefined
    if (parsed.repairedDrafts != null) {
      const asJson = JSON.stringify(parsed.repairedDrafts)
      JSON.parse(asJson)
      repairedDraftsJson = asJson
    }
    return {
      ok: parsed.ok === true && issues.length === 0,
      issues,
      repairedDraftsJson,
    }
  } catch {
    return { ok: false, issues: ["Verifier returned unparseable JSON"] }
  }
}

/**
 * Opposite-provider check of generated question drafts.
 * Fail-closed on verifier errors for exam paths.
 */
export async function verifyAndNormalizeQuestionDrafts(args: {
  draftsJson: string
  generatorProvider: CoraModelProvider
  context: CoraModelRequestContext
}): Promise<CoraDraftVerificationResult> {
  if (!shouldVerifyTask(args.context)) {
    return {
      draftsJson: args.draftsJson,
      verification: { status: "skipped", ran: false },
      escalate: false,
    }
  }

  const deployment = resolveCoraVerifierDeployment(args.generatorProvider)
  try {
    if (!openai && deployment.provider === "openai") {
      throw new Error("Verifier requires an OpenAI client")
    }
    const { content } = await createWithFallback(openai as never, {
      model: deployment.model,
      messages: [
        {
          role: "system",
          content:
            "You are an independent exam verifier. Check the generated question drafts for " +
            "answer-key consistency, type/schema validity, and whether the stem matches the key. " +
            'Return JSON only: {"ok":boolean,"issues":[string],"repairedDrafts":any|null}. ' +
            "ok must be true only when every draft is exam-ready. If you can repair, set ok false, " +
            "list issues, and put the fixed array in repairedDrafts.",
        },
        {
          role: "user",
          content: `Instructor request:\n${args.context.message ?? ""}\n\nDrafts JSON:\n${args.draftsJson}`,
        },
      ],
      temperature: 0,
      max_tokens: 2500,
      response_format: { type: "json_object" },
    })

    const parsed = parseCoraVerifierPayload(String(content ?? ""))
    if (parsed.ok) {
      return {
        draftsJson: args.draftsJson,
        verification: {
          status: "verified",
          ran: true,
          issues: [],
          verifierModel: deployment.model,
          verifierProvider: deployment.provider,
        },
        escalate: false,
      }
    }
    if (parsed.repairedDraftsJson) {
      return {
        draftsJson: parsed.repairedDraftsJson,
        verification: {
          status: "repaired",
          ran: true,
          issues: parsed.issues,
          verifierModel: deployment.model,
          verifierProvider: deployment.provider,
        },
        escalate: true,
      }
    }
    return {
      draftsJson: "[]",
      verification: {
        status: "rejected",
        ran: true,
        issues: parsed.issues.length ? parsed.issues : ["Verifier rejected drafts"],
        verifierModel: deployment.model,
        verifierProvider: deployment.provider,
      },
      escalate: true,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "verifier_error"
    return {
      draftsJson: "[]",
      verification: {
        status: "error",
        ran: true,
        issues: [message],
        verifierModel: deployment.model,
        verifierProvider: deployment.provider,
      },
      escalate: true,
    }
  }
}
