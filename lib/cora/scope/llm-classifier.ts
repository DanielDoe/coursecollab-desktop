/**
 * Optional cheap LLM classify for borderline purpose-scope cases.
 * Only used when deterministic classifier returns UNCERTAIN or soft-conflict.
 * Default OFF — enable with CORA_SCOPE_LLM_CLASSIFY=1.
 */

import OpenAI from "openai"
import { extractRawModelUsage } from "@/lib/cora/ai/usage-extract"
import { calculateProviderCostUsd } from "@/lib/cora/ai/pricing"
import type { CoraPrincipalRole } from "@/lib/cora/security/types"
import type { CoraScopeClassificationResult, CoraPurposeClassification } from "@/lib/cora/scope/types"

const ALLOWED: CoraPurposeClassification[] = [
  "COURSE_RELATED",
  "ACADEMIC_RELATED",
  "STUDENT_SUCCESS",
  "PROFESSIONAL_ACADEMIC",
  "COURSECOLLAB_OPERATION",
  "UNCERTAIN",
  "CLEARLY_UNRELATED",
]

export function isCoraScopeLlmClassifyEnabled(): boolean {
  return /^(1|true|on|yes)$/i.test(String(process.env.CORA_SCOPE_LLM_CLASSIFY ?? ""))
}

export async function classifyCoraPurposeWithLlm(args: {
  role: CoraPrincipalRole
  message: string
  conversationHistory?: Array<{ role: string; content: string }>
}): Promise<{
  result: CoraScopeClassificationResult
  providerCostUsd: number
} | null> {
  if (!process.env.OPENAI_API_KEY) return null

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const history = (args.conversationHistory ?? [])
    .slice(-4)
    .map((m) => `${m.role}: ${String(m.content ?? "").slice(0, 400)}`)
    .join("\n")

  const system = `You classify whether a CourseCollab Cora request has legitimate educational/academic/professional/student-success purpose.
Cora is a BROAD academic assistant — not limited to the user's major or enrolled courses.
ALLOW general educational curiosity (history, biology, art, economics, programming, etc.).
ALLOW career prep, study skills, research exploration, interdisciplinary questions.
ALLOW mixed requests where academic/professional intent is clear (conference travel prep, coding a restaurant app for class).
ONLY mark CLEARLY_UNRELATED for obvious personal-assistant abuse: vacations, dating, fantasy sports, dinner recipes, shopping, stock picks — with no academic framing.
When uncertain, prefer ACADEMIC_RELATED with academicPurpose true (bias toward helping).
Role: ${args.role}
Return JSON only:
{"classification":"ACADEMIC_RELATED|CLEARLY_UNRELATED|UNCERTAIN|STUDENT_SUCCESS|PROFESSIONAL_ACADEMIC|COURSECOLLAB_OPERATION|COURSE_RELATED","confidence":0.0-1.0,"academicPurpose":true|false,"matchedContext":["..."],"reasonCode":"LEGITIMATE_ACADEMIC_REQUEST|CLEARLY_GENERAL_PURPOSE|BIAS_ALLOW_UNCERTAIN|STUDENT_SUCCESS_REQUEST|PROFESSIONAL_ACADEMIC_REQUEST|COURSECOLLAB_OPERATION"}`

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.CORA_SCOPE_CLASSIFIER_MODEL || "gpt-4o-mini",
      temperature: 0,
      max_tokens: 180,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Recent conversation:\n${history || "(none)"}\n\nCurrent message:\n${args.message.slice(0, 2000)}`,
        },
      ],
    })

    const usage = extractRawModelUsage(completion)
    const providerCostUsd = calculateProviderCostUsd({
      provider: "OPENAI",
      model: completion.model || "gpt-4o-mini",
      usage,
    })

    const raw = completion.choices[0]?.message?.content || "{}"
    const parsed = JSON.parse(raw) as Record<string, unknown>
    let classification = String(parsed.classification || "UNCERTAIN") as CoraPurposeClassification
    if (!ALLOWED.includes(classification)) classification = "UNCERTAIN"
    const academicPurpose =
      classification === "CLEARLY_UNRELATED"
        ? false
        : parsed.academicPurpose !== false
    const confidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5))

    // Hard bias: LLM uncertain → allow
    if (classification === "UNCERTAIN") {
      return {
        result: {
          classification: "UNCERTAIN",
          confidence,
          academicPurpose: true,
          matchedContext: Array.isArray(parsed.matchedContext)
            ? (parsed.matchedContext as string[]).slice(0, 6)
            : ["llm"],
          reasonCode: "BIAS_ALLOW_UNCERTAIN",
        },
        providerCostUsd,
      }
    }

    return {
      result: {
        classification,
        confidence,
        academicPurpose,
        matchedContext: Array.isArray(parsed.matchedContext)
          ? (parsed.matchedContext as string[]).slice(0, 6)
          : ["llm"],
        reasonCode:
          academicPurpose === false
            ? "CLEARLY_GENERAL_PURPOSE"
            : classification === "STUDENT_SUCCESS"
              ? "STUDENT_SUCCESS_REQUEST"
              : classification === "PROFESSIONAL_ACADEMIC"
                ? "PROFESSIONAL_ACADEMIC_REQUEST"
                : classification === "COURSECOLLAB_OPERATION"
                  ? "COURSECOLLAB_OPERATION"
                  : "LEGITIMATE_ACADEMIC_REQUEST",
      },
      providerCostUsd,
    }
  } catch (err) {
    console.warn("[cora.scope.llm] classify failed", err)
    return null
  }
}
