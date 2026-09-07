import { generateQuestionsFromPdfBuffer } from "@/lib/question-bank-ai-from-pdf"
import {
  defaultPdfGenerationRequest,
  type DraftQuestionBankItem,
  type QuestionBankPdfGenerationRequest,
} from "@/lib/question-bank-ai-from-pdf-types"
import { generateQuestionDraftsFromPrompt } from "@/lib/cora/faculty-cora-generate-questions"
import { callVisionModelWithFallback } from "@/lib/ai-vision-chat"
import { resolveAiModel } from "@/lib/resolve-ai-model"
import { extractJsonObject, normalizeDraftFromRaw } from "@/lib/question-bank-draft-normalize"

export type FacultyCoraIngestIntent = "extract_questions" | "extract_content" | "analyze_assessment"

function isPdf(name: string, mime: string) {
  return mime === "application/pdf" || name.toLowerCase().endsWith(".pdf")
}

function isImage(mime: string) {
  return mime.startsWith("image/")
}

function buildSpec(prompt?: string, rawSpec?: Partial<QuestionBankPdfGenerationRequest>) {
  const base = defaultPdfGenerationRequest((rawSpec?.questionType as never) || "mcq")
  return {
    ...base,
    ...rawSpec,
    topic: String(rawSpec?.topic ?? prompt?.trim().slice(0, 120) ?? "Uploaded document").trim() || "Uploaded document",
    additionalInstructions: String(rawSpec?.additionalInstructions ?? prompt ?? ""),
    questionCount: Math.min(15, Math.max(1, Number(rawSpec?.questionCount ?? base.questionCount))),
  } satisfies QuestionBankPdfGenerationRequest
}

async function generateFromImageBuffer(
  buffer: Buffer,
  mime: string,
  spec: QuestionBankPdfGenerationRequest,
): Promise<{ drafts: DraftQuestionBankItem[]; modelUsed: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error("OpenAI API key is not configured")

  const dataUrl = `data:${mime || "image/png"};base64,${buffer.toString("base64")}`
  const { modelId } = resolveAiModel({ task: "document_vision", skipEscalation: true })
  const system = [
    "You are an expert course instructor extracting assessment questions from an uploaded image.",
    `Generate exactly ${spec.questionCount} ${spec.questionType} question(s) for topic "${spec.topic}".`,
    "Return ONLY valid JSON: {\"questions\":[{...}]}.",
    "Each question needs question_text, options, correct_answer, hint, explanation, source_note.",
  ].join("\n")

  const { text, modelUsed } = await callVisionModelWithFallback(apiKey, modelId, system, [
    {
      type: "text",
      text: [
        `Create ${spec.questionCount} question(s) from this figure.`,
        spec.additionalInstructions ? `Instructor notes: ${spec.additionalInstructions}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
    { type: "image_url", image_url: { url: dataUrl } },
  ])

  const parsed = extractJsonObject(text) as { questions?: unknown[] }
  const rows = Array.isArray(parsed?.questions) ? parsed.questions : []
  const drafts = rows
    .map((row) =>
      normalizeDraftFromRaw(row as Record<string, unknown>, {
        questionType: spec.questionType,
        difficulty: spec.difficulty,
        topic: spec.topic,
        includeHint: spec.includeHint,
        includeExplanation: spec.includeExplanation,
      }),
    )
    .filter((q) => q.question_text.length > 0)

  if (!drafts.length) throw new Error("AI returned no questions from image")
  return { drafts, modelUsed }
}

export async function ingestFacultyCoraDocument(input: {
  file: File
  intent: FacultyCoraIngestIntent
  prompt?: string
  spec?: Partial<QuestionBankPdfGenerationRequest>
}): Promise<{
  drafts: DraftQuestionBankItem[]
  extractedText?: string
  message: string
  meta?: Record<string, unknown>
}> {
  const { file, intent, prompt } = input
  const name = file.name || "upload"
  const mime = (file.type || "").toLowerCase()
  const bytes = Buffer.from(await file.arrayBuffer())
  const spec = buildSpec(prompt, input.spec)

  if (intent !== "extract_questions") {
    if (isPdf(name, mime) || isImage(mime)) {
      const questionResult = await ingestFacultyCoraDocument({
        ...input,
        intent: "extract_questions",
      })
      return {
        drafts: questionResult.drafts,
        extractedText: questionResult.drafts.map((d) => d.question_text).join("\n\n"),
        message:
          intent === "analyze_assessment"
            ? "Document analyzed into draft questions for review."
            : "Extracted content as draft questions you can review or paste into chat.",
        meta: questionResult.meta,
      }
    }
    throw new Error("Upload a PDF or image to extract content.")
  }

  if (isPdf(name, mime)) {
    const result = await generateQuestionsFromPdfBuffer(bytes, spec)
    return {
      drafts: result.questions,
      message: `Extracted ${result.questions.length} questions from PDF (${result.pageCount} pages).`,
      meta: { modelUsed: result.modelUsed, pageCount: result.pageCount, source: "pdf" },
    }
  }

  if (isImage(mime)) {
    const result = await generateFromImageBuffer(bytes, mime || "image/png", spec)
    return {
      drafts: result.drafts,
      message: `Extracted ${result.drafts.length} questions from ${name}.`,
      meta: { modelUsed: result.modelUsed, source: "image" },
    }
  }

  // Fallback: treat filename + prompt as generation intent (Word uploads etc.)
  const fallback = await generateQuestionDraftsFromPrompt({
    prompt:
      prompt?.trim() ||
      `Generate assessment questions inspired by the uploaded file named "${name}". Prefer conceptual coverage suitable for this course.`,
    count: spec.questionCount,
    defaultTopic: spec.topic,
    questionType: spec.questionType,
    difficulty: spec.difficulty,
  })

  return {
    drafts: fallback.drafts,
    message: `Generated ${fallback.drafts.length} draft questions from your prompt (direct document parsing is limited for this file type).`,
    meta: { source: "prompt-fallback", fileName: name },
  }
}
