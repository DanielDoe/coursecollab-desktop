import { getQuestionBankTypeMeta } from "@/lib/question-bank-type-config"
import { callVisionModelWithFallback } from "@/lib/ai-vision-chat"
import { renderPdfBufferToVisionDataUrls } from "@/lib/pdf-vision-renderer"
import { resolveAiModel } from "@/lib/resolve-ai-model"
import {
  type DraftQuestionBankItem,
  type QuestionBankPdfGenerationRequest,
  PDF_GENERATION_SUPPORTED_TYPES,
} from "@/lib/question-bank-ai-from-pdf-types"
import { extractJsonObject, normalizeDraftFromRaw } from "@/lib/question-bank-draft-normalize"

function buildSystemPrompt(req: QuestionBankPdfGenerationRequest): string {
  const meta = getQuestionBankTypeMeta(req.questionType)
  const typeRules: string[] = [
    `Generate exactly ${req.questionCount} questions of type "${req.questionType}" (${meta?.label ?? req.questionType}).`,
    `Difficulty: ${req.difficulty}. Topic tag: ${req.topic.trim()}.`,
    "Base every question on facts, diagrams, formulas, or examples visible in the uploaded slide PDF.",
    "Do not invent content that is not supported by the slides.",
    "Return ONLY valid JSON — no markdown fences.",
  ]

  if (meta?.requiresOptions && req.questionType !== "true_false") {
    typeRules.push(
      `Each question must have exactly ${req.optionCount} options as a JSON string array.`,
      req.questionType === "select_all"
        ? 'correct_answer must be a JSON array of letters e.g. ["A","C"].'
        : 'correct_answer must be a single letter "A"–"E".',
    )
  }

  if (req.questionType === "true_false") {
    typeRules.push('options must be ["True","False"]. correct_answer is "A" or "B".')
  }

  if (req.questionType === "fill_blank") {
    typeRules.push(
      "Use blanks like ___ in question_text. options may list acceptable short answers.",
      'correct_answer is the primary acceptable answer string or letter.',
    )
  }

  if (req.questionType === "multi_part") {
    typeRules.push(
      `Each question has a shared stem and ${req.subPartCount} subquestions in subquestions array.`,
      "Parent options = []. Parent correct_answer = null.",
      'Each subquestion: { "id": "a", "question_text", "question_type", "options", "correct_answer" }.',
    )
  }

  if (meta?.usesGradingGuidelines) {
    typeRules.push(
      `Use ${req.programmingLanguage} when code is shown in slides.`,
      "Include answer_guidelines array (rubric bullets) for each question.",
    )
  }

  if (!req.includeHint) typeRules.push("Set hint to null for all questions.")
  if (!req.includeExplanation) typeRules.push("Set explanation to null for all questions.")

  return [
    "You are an expert course instructor building exam questions from lecture slide PDFs.",
    ...typeRules,
    "",
    "Output schema:",
    `{
  "questions": [
    {
      "question_text": "string (HTML allowed: <p>, <strong>, <sub>, <sup>)",
      "options": ["string", ...],
      "correct_answer": "A" | ["A","B"] | "answer text",
      "hint": "string | null",
      "explanation": "string | null",
      "answer_guidelines": ["string", ...],
      "sample_answer": "string | null",
      "subquestions": [...] | null,
      "source_note": "short note: which slide/page idea this came from"
    }
  ]
}`,
  ].join("\n")
}

function buildUserPrompt(req: QuestionBankPdfGenerationRequest, pageCount: number): string {
  const extra = req.additionalInstructions.trim()
  return [
    `The attached images are ${pageCount} page(s) from a lecture slide deck.`,
    `Create ${req.questionCount} ${req.questionType} question(s) for topic "${req.topic.trim()}".`,
    extra ? `Instructor notes: ${extra}` : "",
    "Respond with the JSON object only.",
  ]
    .filter(Boolean)
    .join("\n\n")
}

export async function generateQuestionsFromPdfBuffer(
  pdfBuffer: Buffer,
  req: QuestionBankPdfGenerationRequest,
): Promise<{ questions: DraftQuestionBankItem[]; modelUsed: string; pageCount: number }> {
  if (!PDF_GENERATION_SUPPORTED_TYPES.includes(req.questionType)) {
    throw new Error("Unsupported question type for PDF generation")
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error("OpenAI API key is not configured")

  const pageImages = await renderPdfBufferToVisionDataUrls(pdfBuffer, req.maxPdfPages)
  if (pageImages.length === 0) {
    throw new Error("Could not read any pages from the PDF")
  }

  const { modelId } = resolveAiModel({ task: "document_vision", skipEscalation: true })
  const userParts = [
    { type: "text" as const, text: buildUserPrompt(req, pageImages.length) },
    ...pageImages.map((url) => ({
      type: "image_url" as const,
      image_url: { url },
    })),
  ]

  const { text, modelUsed } = await callVisionModelWithFallback(
    apiKey,
    modelId,
    buildSystemPrompt(req),
    userParts,
  )

  const parsed = extractJsonObject(text) as { questions?: unknown[] }
  const rows = Array.isArray(parsed?.questions) ? parsed.questions : []
  if (rows.length === 0) throw new Error("AI returned no questions")

  const questions = rows
    .slice(0, req.questionCount)
    .map((row) =>
      normalizeDraftFromRaw(row as Record<string, unknown>, {
        questionType: req.questionType,
        difficulty: req.difficulty,
        topic: req.topic,
        includeHint: req.includeHint,
        includeExplanation: req.includeExplanation,
      }),
    )
    .filter((q) => q.question_text.length > 0)

  if (questions.length === 0) throw new Error("No valid questions after normalization")

  return { questions, modelUsed, pageCount: pageImages.length }
}
