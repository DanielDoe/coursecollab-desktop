import OpenAI from "openai"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import {
  normalizeCustomTypeId,
  type CustomQuestionTypeDraft,
  type CustomQuestionTypeSchema,
} from "@/lib/custom-question-types"
import type { QuestionBankTypeCategory } from "@/lib/question-bank-type-config"

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("AI did not return valid JSON")
    return JSON.parse(match[0])
  }
}

const SYSTEM = `You design reusable question-type templates for a course question bank.

Return ONLY valid JSON with this shape:
{
  "typeId": "custom_snake_case_id",
  "label": "Human-readable name",
  "description": "One sentence for instructors",
  "category": "choice" | "coding" | "structured",
  "requiresOptions": boolean,
  "usesCodeEditor": boolean,
  "usesGradingGuidelines": boolean,
  "schema": {
    "fields": [
      { "key": "snake_case", "label": "Field label", "kind": "text|textarea|options|code|rubric|media|boolean", "required": true|false, "description": "optional" }
    ]
  },
  "aiQuestionPrompt": "Instructions for later AI question generation using this template"
}

Rules:
- typeId MUST start with custom_ and use lowercase snake_case.
- Map instructor intent to existing platform capabilities: options, code editor, rubric/grading guidelines, media.
- schema.fields describe what instructors fill when authoring a question of this type (3–8 fields).
- Prefer requiresOptions for MCQ-like types; usesCodeEditor for programming; usesGradingGuidelines for open-ended AI-graded types.
- aiQuestionPrompt should tell future AI how to write questions matching this template.`

export async function generateCustomQuestionTypeFromDescription(
  description: string,
  suggestedName?: string,
): Promise<CustomQuestionTypeDraft> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OpenAI API key is not configured")

  const openai = new OpenAI({ apiKey })
  const user = [
    suggestedName?.trim() ? `Suggested name: ${suggestedName.trim()}` : null,
    "Instructor description of the new question type:",
    description.trim(),
  ]
    .filter(Boolean)
    .join("\n\n")

  const { content } = await createForFeature(openai, "question_generation", {
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  })

  const raw = extractJsonObject(content ?? "") as Record<string, unknown>
  const schemaRaw = raw.schema as CustomQuestionTypeSchema | undefined
  const fields = Array.isArray(schemaRaw?.fields) ? schemaRaw.fields : []

  const typeId = normalizeCustomTypeId(String(raw.typeId ?? suggestedName ?? "custom_type"))
  const category = String(raw.category ?? "structured") as QuestionBankTypeCategory

  return {
    typeId,
    label: String(raw.label ?? suggestedName ?? "Custom type").trim(),
    description: String(raw.description ?? description).trim(),
    category: ["choice", "coding", "structured"].includes(category) ? category : "structured",
    requiresOptions: raw.requiresOptions === true,
    usesCodeEditor: raw.usesCodeEditor === true,
    usesGradingGuidelines: raw.usesGradingGuidelines === true,
    schema: { fields },
    aiQuestionPrompt: String(raw.aiQuestionPrompt ?? "").trim(),
  }
}
