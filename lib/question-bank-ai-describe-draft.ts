import OpenAI from "openai"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import { resolveQuestionBankTypeMeta, type CustomQuestionTypeDraft } from "@/lib/custom-question-types"
import type { QuestionBankTypeId } from "@/lib/question-bank-type-config"
import type { QuestionBankAiDifficulty } from "@/lib/question-bank-ai-generation-spec"
import type { DraftQuestionBankItem } from "@/lib/question-bank-ai-from-pdf-types"
import {
  extractJsonObject,
  normalizeDraftFromRaw,
  type DraftNormalizeContext,
} from "@/lib/question-bank-draft-normalize"

export type QuestionBankDescribeRequest = {
  questionType: QuestionBankTypeId | string
  description: string
  correctAnswer: string
  topic: string
  difficulty: QuestionBankAiDifficulty
  includeHint: boolean
  includeExplanation: boolean
}

export function validateDescribeRequest(
  req: QuestionBankDescribeRequest,
  customTypes: CustomQuestionTypeDraft[] = [],
): string | null {
  if (!req.description.trim()) return "Describe the question you want."
  if (!req.correctAnswer.trim()) return "Provide the correct answer you want."
  if (!req.topic.trim()) return "Topic is required."
  if (!resolveQuestionBankTypeMeta(req.questionType, customTypes)) return "Unsupported question type."
  return null
}

function buildSystemPrompt(
  questionType: string,
  meta: ReturnType<typeof resolveQuestionBankTypeMeta>,
  custom?: CustomQuestionTypeDraft,
): string {
  const rules = [
    `Build ONE ${questionType} question (${meta?.label ?? questionType}) as JSON only.`,
    "The instructor's description and correct answer are authoritative — shape the full question around them.",
    "Write a clear question stem suitable for an exam.",
    "Use HTML sparingly in question_text when needed: <p>, <strong>, <sub>, <sup>, <code>.",
    "",
    "Output schema:",
    `{
  "question": {
    "question_text": "string",
    "options": ["string", ...],
    "correct_answer": "A" | ["A","B"] | "answer text",
    "hint": "string | null",
    "explanation": "string | null",
    "answer_guidelines": ["string", ...],
    "sample_answer": "string | null",
    "subquestions": [...] | null
  }
}`,
  ]

  if (meta?.requiresOptions && questionType !== "true_false") {
    rules.splice(
      3,
      0,
      questionType === "select_all"
        ? "Include plausible distractors; correct_answer is an array of letters."
        : "Include plausible distractors; correct_answer is a single letter A–E matching options order.",
    )
  }
  if (questionType === "true_false") {
    rules.splice(3, 0, 'options must be ["True","False"]; correct_answer is "A" or "B".')
  }
  if (meta?.usesGradingGuidelines) {
    rules.splice(3, 0, "Include answer_guidelines rubric bullets and sample_answer when appropriate.")
  }
  if (questionType === "multi_part") {
    rules.splice(3, 0, "Use subquestions array with parts a, b, c; parent options = [].")
  }
  if (custom?.aiQuestionPrompt) {
    rules.push("", "Custom type template:", custom.aiQuestionPrompt)
  }

  return rules.join("\n")
}

export async function generateQuestionDraftFromDescription(
  req: QuestionBankDescribeRequest,
  customTypes: CustomQuestionTypeDraft[] = [],
): Promise<DraftQuestionBankItem> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OpenAI API key is not configured")

  const meta = resolveQuestionBankTypeMeta(req.questionType, customTypes)
  const custom = customTypes.find((t) => t.typeId === req.questionType)

  const ctx: DraftNormalizeContext = {
    questionType: req.questionType,
    difficulty: req.difficulty,
    topic: req.topic,
    includeHint: req.includeHint,
    includeExplanation: req.includeExplanation,
  }

  const openai = new OpenAI({ apiKey })
  const user = [
    `Topic: ${req.topic.trim()}`,
    `Difficulty: ${req.difficulty}`,
    "",
    "Describe the question:",
    req.description.trim(),
    "",
    "Correct answer (must be reflected in the generated question):",
    req.correctAnswer.trim(),
  ].join("\n")

  const { content } = await createForFeature(openai, "question_generation", {
    messages: [
      { role: "system", content: buildSystemPrompt(req.questionType, meta, custom) },
      { role: "user", content: user },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  })

  const parsed = extractJsonObject(content ?? "") as { question?: Record<string, unknown> }
  const raw = parsed?.question
  if (!raw || typeof raw !== "object") throw new Error("AI did not return a question object")

  const draft = normalizeDraftFromRaw(raw, ctx, customTypes)
  if (!draft.question_text.trim()) throw new Error("Generated question text was empty")
  return draft
}
