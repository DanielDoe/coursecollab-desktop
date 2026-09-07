import OpenAI from "openai"
import { createWithFallback } from "@/lib/openai-with-fallback"
import { generateQuestionDraftFromDescription } from "@/lib/question-bank-ai-describe-draft"
import type { DraftQuestionBankItem } from "@/lib/question-bank-ai-from-pdf-types"
import type { QuestionBankAiDifficulty } from "@/lib/question-bank-ai-generation-spec"
import { QUESTION_BANK_TYPES } from "@/lib/question-bank-type-config"

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null

const SUPPORTED_TYPES = new Set(QUESTION_BANK_TYPES.map((t) => t.id))
const TYPE_UNION = QUESTION_BANK_TYPES.map((t) => t.id).join("|")

export type GenerateQuestionsFromPromptInput = {
  prompt: string
  count?: number
  defaultTopic?: string
  questionType?: string
  difficulty?: QuestionBankAiDifficulty
  /** Explicit mix e.g. [{ type: "mcq", count: 6 }, …] */
  typeMix?: Array<{ type: string; count: number }>
}

export type GenerateQuestionsResult = {
  drafts: DraftQuestionBankItem[]
  parsed: {
    topic: string
    questionType: string
    difficulty: QuestionBankAiDifficulty
    count: number
    typeMix: Array<{ type: string; count: number }>
  }
}

function clampCount(n: number): number {
  return Math.max(1, Math.min(20, Math.floor(n)))
}

function normalizeType(raw: string): string {
  const t = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
  if (t === "multiple_choice" || t === "multiplechoice" || t === "mc" || t === "multiple_choice_question") {
    return "mcq"
  }
  if (t === "truefalse" || t === "t_f" || t === "tf" || t === "true_or_false") return "true_false"
  if (t === "select_all_that_apply" || t === "multi_select" || t === "multiselect" || t === "sata") {
    return "select_all"
  }
  if (t === "fill_in_the_blank" || t === "fib") return "fill_blank"
  if (t === "circuit" || t === "circuit_submit") return "circuit_submission"
  if (t === "trace" || t === "trace_code") return "trace_output"
  if (t === "debug" || t === "debug_the_code") return "debug_code"
  if (t === "coding" || t === "code") return "code_problem"
  if (t === "write_code") return "code_write"
  if (t === "plot" || t === "code_plot") return "code_write_plot"
  if (t === "explain_code") return "code_explain"
  return t
}

/** Heuristic mix from natural language ("6 multiple-choice, 3 true/false, 3 select-all"). */
export function extractTypeMixFromPrompt(prompt: string): Array<{ type: string; count: number }> {
  const mix: Array<{ type: string; count: number }> = []
  const patterns: Array<{ re: RegExp; type: string }> = [
    { re: /(\d+)\s*(?:x\s*)?(?:multiple[-\s]?choice|mcqs?|mcq)\b/gi, type: "mcq" },
    { re: /(\d+)\s*(?:x\s*)?(?:true\s*\/\s*false|true\s*[- ]\s*false|t\s*\/\s*f)\b/gi, type: "true_false" },
    {
      re: /(\d+)\s*(?:x\s*)?(?:select[-\s]?all(?:\s*that\s*apply)?|multi[-\s]?select|sata)\b/gi,
      type: "select_all",
    },
    { re: /(\d+)\s*(?:x\s*)?(?:fill[-\s]?in[-\s]?the[-\s]?blank|fill[-\s]?blank)\b/gi, type: "fill_blank" },
    { re: /(\d+)\s*(?:x\s*)?(?:code[-\s]?problems?|coding)\b/gi, type: "code_problem" },
    { re: /(\d+)\s*(?:x\s*)?(?:multi[-\s]?part|multipart)\b/gi, type: "multi_part" },
    { re: /(\d+)\s*(?:x\s*)?(?:trace(?:[-\s]?output)?|tracing)\b/gi, type: "trace_output" },
    { re: /(\d+)\s*(?:x\s*)?(?:debug(?:[-\s]?code)?)\b/gi, type: "debug_code" },
    { re: /(\d+)\s*(?:x\s*)?(?:code[-\s]?write[-\s]?plot|plot)\b/gi, type: "code_write_plot" },
    { re: /(\d+)\s*(?:x\s*)?(?:code[-\s]?write|write[-\s]?code)\b/gi, type: "code_write" },
    { re: /(\d+)\s*(?:x\s*)?(?:code[-\s]?explain|explain[-\s]?code)\b/gi, type: "code_explain" },
    { re: /(\d+)\s*(?:x\s*)?(?:circuit(?:[-\s]?submission)?)\b/gi, type: "circuit_submission" },
  ]
  for (const { re, type } of patterns) {
    for (const m of prompt.matchAll(re)) {
      const n = Number(m[1])
      if (Number.isFinite(n) && n > 0) mix.push({ type, count: clampCount(n) })
    }
  }
  // Collapse duplicates by type
  const byType = new Map<string, number>()
  for (const item of mix) {
    byType.set(item.type, (byType.get(item.type) ?? 0) + item.count)
  }
  return [...byType.entries()].map(([type, count]) => ({ type, count: clampCount(count) }))
}

function expandTypeSlots(
  typeMix: Array<{ type: string; count: number }>,
  fallbackType: string,
  total: number,
): string[] {
  const slots: string[] = []
  for (const item of typeMix) {
    const t = normalizeType(item.type)
    if (!SUPPORTED_TYPES.has(t)) continue
    for (let i = 0; i < clampCount(item.count); i += 1) slots.push(t)
  }
  if (slots.length === 0) {
    const t = SUPPORTED_TYPES.has(normalizeType(fallbackType))
      ? normalizeType(fallbackType)
      : "mcq"
    return Array.from({ length: total }, () => t)
  }
  if (slots.length < total) {
    const pad = slots[slots.length - 1] || "mcq"
    while (slots.length < total) slots.push(pad)
  }
  return slots.slice(0, total)
}

async function parseGenerationIntent(
  prompt: string,
  defaultTopic: string,
): Promise<{
  topic: string
  questionType: string
  difficulty: QuestionBankAiDifficulty
  count: number
  descriptions: string[]
  typeMix: Array<{ type: string; count: number }>
}> {
  const heuristicMix = extractTypeMixFromPrompt(prompt)
  const heuristicCount = heuristicMix.reduce((s, x) => s + x.count, 0)

  if (!openai) {
    const topic = defaultTopic || "General"
    const count = clampCount(heuristicCount || 1)
    return {
      topic,
      questionType: heuristicMix[0]?.type || "mcq",
      difficulty: "medium",
      count,
      descriptions: Array.from({ length: count }, (_, i) => `${prompt.slice(0, 400)} (item ${i + 1})`),
      typeMix: heuristicMix.length ? heuristicMix : [{ type: "mcq", count }],
    }
  }

  const { content } = await createWithFallback(openai, {
    model: process.env.OPENAI_DEFAULT_MODEL,
    messages: [
      {
        role: "system",
        content:
          "Extract question generation parameters from an instructor request. Return JSON only: " +
          `{"topic":"string","questionType":"${TYPE_UNION}","difficulty":"easy|medium|hard","count":1-20,` +
          `"typeMix":[{"type":"${TYPE_UNION}","count":number}],` +
          '"descriptions":["one distinct question brief per item"]}. ' +
          "When the instructor specifies a mix (e.g. 6 MCQ, 3 true/false, 3 select-all, 2 code_write, 1 circuit_submission), put that in typeMix and set count to the sum. " +
          "Use the full Question Bank type union including trace_output, debug_code, code_write, code_write_plot, code_explain, and circuit_submission. " +
          "descriptions length must equal count. Prefer intermediate difficulty when asked.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 1600,
  })

  try {
    const raw = JSON.parse(String(content ?? "{}")) as {
      topic?: string
      questionType?: string
      difficulty?: string
      count?: number
      descriptions?: string[]
      typeMix?: Array<{ type?: string; count?: number }>
    }
    let typeMix =
      Array.isArray(raw.typeMix) && raw.typeMix.length
        ? raw.typeMix
            .map((x) => ({
              type: normalizeType(String(x.type ?? "mcq")),
              count: clampCount(Number(x.count ?? 0)),
            }))
            .filter((x) => SUPPORTED_TYPES.has(x.type) && x.count > 0)
        : heuristicMix

    const mixSum = typeMix.reduce((s, x) => s + x.count, 0)
    const count = clampCount(
      mixSum || Number(raw.count ?? heuristicCount ?? 1) || 1,
    )
    if (!typeMix.length) {
      typeMix = [{ type: normalizeType(String(raw.questionType ?? "mcq")), count }]
    }

    const descriptions =
      Array.isArray(raw.descriptions) && raw.descriptions.length
        ? raw.descriptions.slice(0, count).map((d) => String(d))
        : []
    while (descriptions.length < count) {
      descriptions.push(`${prompt.slice(0, 220)} (variant ${descriptions.length + 1})`)
    }
    const difficulty = (["easy", "medium", "hard"].includes(String(raw.difficulty))
      ? raw.difficulty
      : "medium") as QuestionBankAiDifficulty
    return {
      topic: String(raw.topic ?? defaultTopic ?? "General").trim() || "General",
      questionType: normalizeType(String(raw.questionType ?? typeMix[0]?.type ?? "mcq")),
      difficulty,
      count,
      descriptions,
      typeMix,
    }
  } catch {
    const count = clampCount(heuristicCount || 1)
    return {
      topic: defaultTopic || "General",
      questionType: heuristicMix[0]?.type || "mcq",
      difficulty: "medium",
      count,
      descriptions: Array.from({ length: count }, (_, i) => `${prompt.slice(0, 400)} (item ${i + 1})`),
      typeMix: heuristicMix.length ? heuristicMix : [{ type: "mcq", count }],
    }
  }
}

export async function generateQuestionDraftsFromPrompt(
  input: GenerateQuestionsFromPromptInput,
): Promise<GenerateQuestionsResult> {
  const parsed = await parseGenerationIntent(input.prompt, input.defaultTopic ?? "")
  const typeMix =
    input.typeMix?.length
      ? input.typeMix.map((x) => ({ type: normalizeType(x.type), count: clampCount(x.count) }))
      : parsed.typeMix
  const mixSum = typeMix.reduce((s, x) => s + x.count, 0)
  const count =
    input.count != null ? clampCount(input.count) : clampCount(mixSum || parsed.count)
  const topic = input.defaultTopic?.trim() || parsed.topic
  const fallbackType = input.questionType?.trim() || parsed.questionType
  const difficulty = input.difficulty ?? parsed.difficulty

  const typeSlots = expandTypeSlots(typeMix, fallbackType, count)
  const descriptions = parsed.descriptions.slice(0, count)
  while (descriptions.length < count) {
    descriptions.push(`${input.prompt.slice(0, 220)} (variant ${descriptions.length + 1})`)
  }

  const drafts: DraftQuestionBankItem[] = new Array(count)

  const concurrency = Math.min(4, count)
  let nextIndex = 0
  async function worker() {
    while (nextIndex < count) {
      const i = nextIndex
      nextIndex += 1
      const questionType = typeSlots[i] || "mcq"
      const draft = await generateQuestionDraftFromDescription(
        {
          questionType,
          description: `${descriptions[i]}\n\nRequired type: ${questionType}. Keep this item distinct from others in the set.`,
          correctAnswer: "See generated question",
          topic,
          difficulty,
          includeHint: true,
          includeExplanation: true,
        },
        [],
      )
      drafts[i] = {
        ...draft,
        question_type: questionType as DraftQuestionBankItem["question_type"],
        draftId: draft.draftId || `cora-${Date.now()}-${i}`,
        source_note: "Generated by Cora teaching copilot",
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  const typeSummary = typeSlots.reduce<Record<string, number>>((acc, t) => {
    acc[t] = (acc[t] ?? 0) + 1
    return acc
  }, {})

  return {
    drafts: drafts.filter(Boolean),
    parsed: {
      topic,
      questionType: Object.entries(typeSummary)
        .map(([t, n]) => `${n} ${t}`)
        .join(" · "),
      difficulty,
      count: drafts.filter(Boolean).length,
      typeMix: Object.entries(typeSummary).map(([type, c]) => ({ type, count: c })),
    },
  }
}

export function shouldSuggestQuestionGeneration(message: string, capabilityId?: string): boolean {
  if (capabilityId !== "create" && capabilityId !== "improve") return false
  return /\b(generate|create|draft|write|make|add|build|improve)\b.{0,40}\b(question|quiz|homework|exam|assessment|bank)/i.test(
    message,
  )
}

export function shouldSuggestAutomation(message: string, capabilityId?: string): boolean {
  if (capabilityId !== "automate") return false
  return /\b(schedule|automate|every week|after lecture|recurring|remind)/i.test(message)
}
