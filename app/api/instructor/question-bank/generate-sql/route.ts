import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import { requireInstructorQuestionBankScope } from "@/lib/instructor-question-bank-scope"
import { getCustomQuestionTypeForCourse } from "@/lib/custom-question-types-server"
import { resolveQuestionBankTypeMeta } from "@/lib/custom-question-types"
import { getQuestionBankTypeMeta } from "@/lib/question-bank-type-config"
import {
  buildAiSqlGenerationSystemPromptForSpec,
  buildStructuredAiGenerationPayload,
  formatStructuredAiUserPrompt,
  validateAiGenerationSpec,
  type QuestionBankAiGenerationSpec,
  type QuestionBankAiDifficulty,
  type QuestionBankAiEvaluationMode,
} from "@/lib/question-bank-ai-generation-spec"
import { sanitizeAiGeneratedQuestionBankSql } from "@/lib/question-bank-ai-sql-sanitize"
import { getQuestionBankSqlTemplate } from "@/lib/question-bank-sql-templates"
import type { QuestionBankTypeId } from "@/lib/question-bank-type-config"

export const dynamic = "force-dynamic"

const DIFFICULTIES = new Set(["easy", "medium", "hard"])
const EVAL_MODES = new Set(["auto", "manual"])

function parseSpec(body: Record<string, unknown>): QuestionBankAiGenerationSpec | null {
  const questionType = String(body.questionType ?? "").trim().toLowerCase()
  if (!getQuestionBankTypeMeta(questionType) && !questionType.startsWith("custom_")) return null

  const difficulty = String(body.difficulty ?? "medium").trim().toLowerCase() as QuestionBankAiDifficulty
  if (!DIFFICULTIES.has(difficulty)) return null

  const evaluationMode = String(body.evaluationMode ?? "auto").trim().toLowerCase() as QuestionBankAiEvaluationMode
  if (!EVAL_MODES.has(evaluationMode)) return null

  return {
    questionType,
    difficulty,
    topic: String(body.topic ?? ""),
    evaluationMode,
    includeHint: body.includeHint !== false,
    includeExplanation: body.includeExplanation !== false,
    optionCount: Math.min(8, Math.max(2, Number(body.optionCount) || 4)),
    programmingLanguage: String(body.programmingLanguage ?? "C++"),
    subPartCount: Math.min(10, Math.max(2, Number(body.subPartCount) || 3)),
    contentDescription: String(body.contentDescription ?? ""),
    optionsDescription: String(body.optionsDescription ?? ""),
    rubricDescription: String(body.rubricDescription ?? ""),
    subPartsDescription: String(body.subPartsDescription ?? ""),
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorQuestionBankScope(request)
    if (!scope.ok) return scope.response

    const body = await request.json()
    const spec = parseSpec(body)
    if (!spec) {
      return NextResponse.json({ error: "Invalid or unsupported generation parameters" }, { status: 400 })
    }

    const customRow =
      spec.questionType.startsWith("custom_")
        ? await getCustomQuestionTypeForCourse(scope.course.id, spec.questionType)
        : null
    if (spec.questionType.startsWith("custom_") && !customRow) {
      return NextResponse.json({ error: "Unknown custom question type" }, { status: 400 })
    }

    const customTypes = customRow ? [customRow] : []
    if (!resolveQuestionBankTypeMeta(spec.questionType, customTypes)) {
      return NextResponse.json({ error: "Invalid or unsupported generation parameters" }, { status: 400 })
    }

    const validationError = validateAiGenerationSpec(spec, customTypes)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API key is not configured" }, { status: 503 })
    }

    const openai = new OpenAI({ apiKey })
    const system = buildAiSqlGenerationSystemPromptForSpec(spec, customTypes)
    const userPrompt = formatStructuredAiUserPrompt(spec, customTypes)

    const { content } = await createForFeature(openai, "question_generation", {

      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.25,
    })

    let sql = (content ?? "").trim()
    if (sql.startsWith("```")) {
      sql = sql.replace(/^```(?:sql)?\s*/i, "").replace(/\s*```$/i, "").trim()
    }
    sql = sanitizeAiGeneratedQuestionBankSql(sql)

    return NextResponse.json({
      sql,
      template: getQuestionBankSqlTemplate(spec.questionType),
      questionType: spec.questionType,
      spec: buildStructuredAiGenerationPayload(spec),
    })
  } catch (error) {
    console.error("[question-bank generate-sql]", error)
    return NextResponse.json({ error: "Failed to generate SQL" }, { status: 500 })
  }
}
