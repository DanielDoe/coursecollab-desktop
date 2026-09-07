import type { QuestionBankTypeId } from "@/lib/question-bank-type-config"
import type { QuestionBankAiDifficulty } from "@/lib/question-bank-ai-generation-spec"

/** Instructor form values for slide/PDF → question generation. */
export type QuestionBankPdfGenerationRequest = {
  questionType: QuestionBankTypeId
  topic: string
  difficulty: QuestionBankAiDifficulty
  questionCount: number
  optionCount: number
  includeHint: boolean
  includeExplanation: boolean
  programmingLanguage: string
  subPartCount: number
  maxPdfPages: number
  additionalInstructions: string
}

/** Draft item returned to the client for preview/edit before DB insert. */
export type DraftQuestionBankItem = {
  draftId: string
  question_text: string
  question_type: QuestionBankTypeId
  difficulty: QuestionBankAiDifficulty
  topic: string
  options: string[]
  correct_answer: string | string[]
  hint: string | null
  explanation: string | null
  evaluation_mode: "auto" | "manual"
  answer_guidelines: string[]
  sample_answer: string | null
  subquestions: unknown[] | null
  source_note: string | null
}

export const PDF_GENERATION_SUPPORTED_TYPES: QuestionBankTypeId[] = [
  "mcq",
  "true_false",
  "select_all",
  "fill_blank",
  "multi_part",
  "code_problem",
  "trace_output",
  "code_explain",
]

export function defaultPdfGenerationRequest(
  questionType: QuestionBankTypeId = "mcq",
): QuestionBankPdfGenerationRequest {
  return {
    questionType,
    topic: "",
    difficulty: "medium",
    questionCount: 5,
    optionCount: questionType === "true_false" ? 2 : 4,
    includeHint: true,
    includeExplanation: true,
    programmingLanguage: "C++",
    subPartCount: 3,
    maxPdfPages: 8,
    additionalInstructions: "",
  }
}

export function validatePdfGenerationRequest(req: QuestionBankPdfGenerationRequest): string | null {
  if (!req.topic.trim()) return "Topic is required."
  if (req.topic.length > 120) return "Topic is too long."
  if (!PDF_GENERATION_SUPPORTED_TYPES.includes(req.questionType)) {
    return "This question type is not supported for PDF generation yet."
  }
  if (req.questionCount < 1 || req.questionCount > 15) {
    return "Generate between 1 and 15 questions per run."
  }
  if (req.maxPdfPages < 1 || req.maxPdfPages > 12) {
    return "PDF page limit must be between 1 and 12."
  }
  if (req.additionalInstructions.length > 2000) {
    return "Additional instructions are too long."
  }
  return null
}
