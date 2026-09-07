import OpenAI from "openai"
import { CORA_WALKTHROUGH_MAX_STEPS, CORA_WALKTHROUGH_MIN_STEPS } from "@/lib/cora/constants"
import { parseExplanationSteps, parseReferenceSteps } from "@/lib/cora/parse-solution-steps"
import { coraWalkthroughSystemPrompt, coraWalkthroughUserPrompt } from "@/lib/cora/prompts"
import { normalizeCoraProblem as normalizeProblem } from "@/lib/cora/question-context"
import type { CoraProblemContext, CoraWalkthroughResponse, CoraWalkthroughStep } from "@/lib/cora/types"
import { createForFeature } from "@/lib/resolve-feature-ai-model"

function fromReference(problem: CoraProblemContext): CoraWalkthroughStep[] {
  const fromSteps = parseReferenceSteps(problem.referenceSteps ?? [])
  if (fromSteps.length >= CORA_WALKTHROUGH_MIN_STEPS) return fromSteps.slice(0, CORA_WALKTHROUGH_MAX_STEPS)
  const fromExplanation = parseExplanationSteps(problem.explanation)
  if (fromExplanation.length >= CORA_WALKTHROUGH_MIN_STEPS) return fromExplanation.slice(0, CORA_WALKTHROUGH_MAX_STEPS)
  return fromSteps.length > 0 ? fromSteps : fromExplanation
}

function parseAiSteps(raw: unknown): CoraWalkthroughStep[] {
  if (!raw || typeof raw !== "object") return []
  const steps = (raw as { steps?: unknown }).steps
  if (!Array.isArray(steps)) return []
  return steps
    .map((s, index) => {
      if (!s || typeof s !== "object") return null
      const o = s as Record<string, unknown>
      const title = String(o.title ?? `Step ${index + 1}`).trim()
      const body = String(o.body ?? "").trim()
      if (!body) return null
      const kind = String(o.kind ?? "compute")
      return {
        id: `ai-step-${index + 1}`,
        index,
        title,
        body,
        kind: (["setup", "concept", "compute", "check", "code", "hint", "summary"].includes(kind)
          ? kind
          : "compute") as CoraWalkthroughStep["kind"],
        hint: o.hint ? String(o.hint) : undefined,
      }
    })
    .filter(Boolean) as CoraWalkthroughStep[]
}

async function generateAiWalkthrough(problem: CoraProblemContext): Promise<CoraWalkthroughResponse> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Cora is not configured on this server.")
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const { content } = await createForFeature(openai, "tutor", {
    messages: [
      { role: "system", content: coraWalkthroughSystemPrompt(problem.domain) },
      { role: "user", content: coraWalkthroughUserPrompt(problem) },
    ],
    temperature: 0.35,
    response_format: { type: "json_object" },
  })
  const text = content ?? "{}"
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error("Cora could not parse the walkthrough response.")
  }
  const steps = parseAiSteps(parsed)
  if (steps.length < CORA_WALKTHROUGH_MIN_STEPS) {
    throw new Error("Cora generated an incomplete walkthrough.")
  }
  const finalAnswer =
    parsed && typeof parsed === "object" && "finalAnswer" in parsed
      ? String((parsed as { finalAnswer?: unknown }).finalAnswer ?? "") || problem.expectedAnswer
      : problem.expectedAnswer

  return {
    domain: problem.domain,
    steps: steps.slice(0, CORA_WALKTHROUGH_MAX_STEPS),
    finalAnswer: finalAnswer ?? null,
    source: "ai",
    problemTitle: problem.title,
  }
}

export async function buildCoraWalkthrough(problemInput: CoraProblemContext): Promise<CoraWalkthroughResponse> {
  const problem = normalizeProblem(problemInput)
  const referenceSteps = fromReference(problem)

  if (referenceSteps.length >= CORA_WALKTHROUGH_MIN_STEPS) {
    return {
      domain: problem.domain,
      steps: referenceSteps,
      finalAnswer: problem.expectedAnswer ?? null,
      source: "reference",
      problemTitle: problem.title,
    }
  }

  try {
    return await generateAiWalkthrough(problem)
  } catch (err) {
    if (referenceSteps.length > 0) {
      return {
        domain: problem.domain,
        steps: referenceSteps,
        finalAnswer: problem.expectedAnswer ?? null,
        source: "reference",
        problemTitle: problem.title,
      }
    }
    throw err
  }
}

export { coraContextFromQuestion } from "@/lib/cora/question-context"
