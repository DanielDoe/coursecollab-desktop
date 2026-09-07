import { getLongContextTokenThreshold } from "@/lib/cora/models/flags"
import type {
  CoraComplexityLevel,
  CoraModelRequestContext,
  CoraTaskCategory,
} from "@/lib/cora/models/types"

const CODE_RE =
  /\b(code|coding|debug|compile|runtime|segfault|pointer|algorithm|leetcode|refactor|typescript|javascript|python|java\b|c\+\+|cpp|matlab|sql|regex|codebench|stack\s*trace|function\s*\()\b/i

const TUTOR_RE =
  /\b(explain|teach|tutor|lesson|concept|understand|eli5|walk\s*me\s*through|help\s*me\s*learn|guide\s*me|solve\s*with\s*me|hint|ohm'?s\s*law|kirchhoff|kcl|kvl)\b/i

const STEM_HARD_RE =
  /\b(prove|derive|laplace|fourier|differential|eigen|thevenin|norton|phaser|transient|op-?amp|bode|nyquist|maxwell|schrodinger)\b/i

const LIGHT_RE =
  /\b(what\s+is|define|when\s+is|due\s+date|deadline|grade|schedule|syllabus|office\s*hours|how\s+do\s+i\s+open|navigate|go\s+to|hi|hello|thanks|hey)\b/i

const AGENT_RE =
  /\b(create|make|send|publish|announce|draft|generate|build|add|schedule|save)\b.{0,48}\b(note|notes|flashcards?|announcement|quiz|exam|homework|question|lecture|study plan|deck)\b/i

const EXAM_RE = /\b(final exam|midterm|comprehensive exam|high-?stakes|answer key|rubric)\b/i

const POWERFUL_MODEL_INJECTION_RE =
  /\b(use|switch to|run)\b.{0,24}\b(most powerful|gpt-?5|claude|opus|o1|o3|frontier|best model|advanced reasoning)\b/i

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function stripClientModelRequests(message: string): string {
  return message.replace(POWERFUL_MODEL_INJECTION_RE, " ").replace(/\s+/g, " ").trim()
}

export function inferTaskCategory(ctx: CoraModelRequestContext): CoraTaskCategory {
  if (ctx.taskCategory && ctx.taskCategory !== "unknown") return ctx.taskCategory
  if (ctx.requestedOperation === "embed" || ctx.requestedOperation === "embedding") return "embedding"
  if (ctx.requiresVision || ctx.hasImages) return "vision"
  const message = stripClientModelRequests(ctx.message ?? "")
  if (CODE_RE.test(message) || ctx.requestedOperation === "codebench") return "coding"
  if (EXAM_RE.test(message) || ctx.assessmentContext === "final" || ctx.assessmentContext === "exam") {
    return "assessment_exam"
  }
  if (AGENT_RE.test(message) || ctx.agenticAction || ctx.requiresTools) return "agent"
  if (TUTOR_RE.test(message)) return "tutoring"
  if (ctx.portal === "career") return "career"
  if (ctx.portal === "admin") return "admin"
  if (LIGHT_RE.test(message) && wordCount(message) < 25) return "faq"
  if (ctx.requestedOperation === "classify" || ctx.requestedOperation === "intent") return "classification"
  return "conversation"
}

export function classifyCoraComplexity(ctx: CoraModelRequestContext): CoraComplexityLevel {
  const message = stripClientModelRequests(ctx.message ?? "")
  const words = wordCount(message)
  const tokens = ctx.estimatedContextTokens ?? 0
  const hist = ctx.conversationHistory?.length ?? 0
  let score = 0

  if (/^(hi|hello|hey|thanks)\b/i.test(message.trim()) || words < 8) score -= 3
  if (words < 18 && !ctx.hasImages && !ctx.requiresTools) score -= 1
  if (words > 80) score += 2
  if (words > 160) score += 2
  if (hist >= 6) score += 1
  if (ctx.hasImages || ctx.requiresVision) score += 2
  if (ctx.hasFiles) score += 1
  if (tokens >= getLongContextTokenThreshold()) score += 3
  if (CODE_RE.test(message)) score += 2
  if (STEM_HARD_RE.test(message)) score += 3
  if (EXAM_RE.test(message) || ctx.assessmentContext === "final") score += 3
  if (ctx.riskLevel === "high") score += 2
  if (ctx.riskLevel === "critical") score += 4
  if (ctx.highImpact) score += 2
  if (ctx.agenticAction || ctx.requiresTools) score += 1

  if (score >= 7) return "VERY_HIGH"
  if (score >= 4) return "HIGH"
  if (score <= -1) return "LOW"
  return "NORMAL"
}

export function isLongContextRequest(ctx: CoraModelRequestContext): boolean {
  if (ctx.requiresLongContext) return true
  return (ctx.estimatedContextTokens ?? 0) >= getLongContextTokenThreshold()
}

export function isLiteRestrictedRequest(ctx: CoraModelRequestContext): boolean {
  if (ctx.hasImages || ctx.requiresVision) return true
  if (isLongContextRequest(ctx)) return true
  if (ctx.hasFiles && (ctx.estimatedContextTokens ?? 0) > 4000) return true
  if (ctx.agenticAction && (ctx.toolRequirements?.length ?? 0) > 1) return true
  const category = inferTaskCategory(ctx)
  return (
    category === "coding" ||
    category === "assessment" ||
    category === "assessment_exam" ||
    category === "vision"
  )
}

export const CORA_COMPLEXITY_SIGNALS = {
  CODE_RE,
  TUTOR_RE,
  STEM_HARD_RE,
  LIGHT_RE,
  AGENT_RE,
  EXAM_RE,
}
