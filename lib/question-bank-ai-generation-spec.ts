import type { QuestionBankTypeId } from "@/lib/question-bank-type-config"
import {
  resolveQuestionBankTypeMeta,
  type CustomQuestionTypeDraft,
} from "@/lib/custom-question-types"
import { buildAiSqlGenerationSystemPrompt } from "@/lib/question-bank-sql-templates"

export type QuestionBankAiDifficulty = "easy" | "medium" | "hard"
export type QuestionBankAiEvaluationMode = "auto" | "manual"

/** Instructor-selected values — sent verbatim to AI for SQL generation. */
export type QuestionBankAiGenerationSpec = {
  questionType: QuestionBankTypeId | string
  difficulty: QuestionBankAiDifficulty
  topic: string
  evaluationMode: QuestionBankAiEvaluationMode
  includeHint: boolean
  includeExplanation: boolean
  /** MCQ / select_all / fill_blank (ignored for true_false). */
  optionCount: number
  /** C++, Python, etc. for coding types. */
  programmingLanguage: string
  /** multi_part only */
  subPartCount: number
  /** Main stem / problem statement */
  contentDescription: string
  /** Choice types: options text + which are correct */
  optionsDescription: string
  /** Coding types: rubric bullets or grading notes */
  rubricDescription: string
  /** multi_part: outline of sub-questions */
  subPartsDescription: string
}

export function defaultAiGenerationSpec(
  questionType: QuestionBankTypeId | string,
  customTypes: CustomQuestionTypeDraft[] = [],
): QuestionBankAiGenerationSpec {
  const meta = resolveQuestionBankTypeMeta(questionType, customTypes)
  return {
    questionType,
    difficulty: "medium",
    topic: "",
    evaluationMode: meta?.usesGradingGuidelines ? "auto" : "auto",
    includeHint: true,
    includeExplanation: true,
    optionCount: questionType === "true_false" ? 2 : 4,
    programmingLanguage: "C++",
    subPartCount: 3,
    contentDescription: "",
    optionsDescription: "",
    rubricDescription: "",
    subPartsDescription: "",
  }
}

export function validateAiGenerationSpec(
  spec: QuestionBankAiGenerationSpec,
  customTypes: CustomQuestionTypeDraft[] = [],
): string | null {
  if (!spec.topic.trim()) {
    return "Topic is required before generating SQL."
  }
  if (!spec.contentDescription.trim()) {
    return "Describe the question stem or problem statement."
  }

  const meta = resolveQuestionBankTypeMeta(spec.questionType, customTypes)
  if (meta?.requiresOptions && spec.questionType !== "true_false") {
    if (spec.optionCount < 2 || spec.optionCount > 8) {
      return "Option count must be between 2 and 8."
    }
    if (!spec.optionsDescription.trim()) {
      return "Describe the answer options and which option(s) are correct."
    }
  }

  if (spec.questionType === "true_false" && !spec.optionsDescription.trim()) {
    return "Indicate whether the correct answer is True or False (or describe the statement)."
  }

  if (meta?.usesGradingGuidelines && !spec.rubricDescription.trim()) {
    return "Add grading rubric notes or criteria for AI-graded questions."
  }

  if (spec.questionType === "multi_part") {
    if (spec.subPartCount < 2 || spec.subPartCount > 10) {
      return "Sub-part count must be between 2 and 10."
    }
    if (!spec.subPartsDescription.trim()) {
      return "Outline the sub-questions (parts a, b, c, …)."
    }
  }

  return null
}

export function buildStructuredAiGenerationPayload(
  spec: QuestionBankAiGenerationSpec,
  customTypes: CustomQuestionTypeDraft[] = [],
) {
  const meta = resolveQuestionBankTypeMeta(spec.questionType, customTypes)
  return {
    fixed: {
      question_type: spec.questionType,
      question_type_label: meta?.label ?? spec.questionType,
      difficulty: spec.difficulty,
      topic: spec.topic.trim(),
      evaluation_mode: spec.evaluationMode,
      course_id_placeholder: "{{COURSE_ID}}",
      include_hint: spec.includeHint,
      include_explanation: spec.includeExplanation,
      option_count: spec.questionType === "true_false" ? 2 : spec.optionCount,
      programming_language: spec.programmingLanguage.trim() || "C++",
      sub_part_count: spec.subPartCount,
    },
    content: {
      question_stem_or_problem: spec.contentDescription.trim(),
      options_and_correct_answer: spec.optionsDescription.trim() || null,
      rubric_and_grading_notes: spec.rubricDescription.trim() || null,
      sub_parts_outline: spec.subPartsDescription.trim() || null,
    },
  }
}

export function formatStructuredAiUserPrompt(
  spec: QuestionBankAiGenerationSpec,
  customTypes: CustomQuestionTypeDraft[] = [],
): string {
  const payload = buildStructuredAiGenerationPayload(spec, customTypes)
  const meta = resolveQuestionBankTypeMeta(spec.questionType, customTypes)
  const custom = customTypes.find((t) => t.typeId === spec.questionType)

  const mandatory = [
    `Use question_type = '${payload.fixed.question_type}' exactly.`,
    `Use difficulty = '${payload.fixed.difficulty}' exactly.`,
    `Use topic = ${JSON.stringify(payload.fixed.topic)} exactly (not NULL).`,
    `Use course_id = ${payload.fixed.course_id_placeholder} exactly.`,
    `Use evaluation_mode = '${payload.fixed.evaluation_mode}' for this row.`,
  ]

  if (meta?.requiresOptions) {
    mandatory.push(
      `Build exactly ${payload.fixed.option_count} options in the options JSON array (letters A, B, C… map to array order).`,
    )
    if (spec.questionType === "true_false") {
      mandatory.push(`options must be ["True","False"] and correct_answer '"A"' or '"B"'.`)
    }
  }

  if (spec.includeHint) {
    mandatory.push("Include a non-empty hint column when appropriate.")
  } else {
    mandatory.push("Set hint to NULL.")
  }

  if (spec.includeExplanation) {
    mandatory.push("Include a non-empty explanation column.")
  } else {
    mandatory.push("Set explanation to NULL.")
  }

  if (meta?.usesGradingGuidelines) {
    mandatory.push(
      `Mention ${payload.fixed.programming_language} in the question text if relevant.`,
      "Populate answer_guidelines as a JSON array of rubric strings from rubric_and_grading_notes.",
    )
  }

  if (spec.questionType === "multi_part") {
    mandatory.push(
      `Create ${payload.fixed.sub_part_count} entries in subquestions JSON from sub_parts_outline.`,
      "Parent row options = '[]'::jsonb, correct_answer = NULL.",
    )
  }

  return [
    "=== MANDATORY SQL FIELD VALUES (do not invent different difficulty, topic, or type) ===",
    ...mandatory.map((m) => `- ${m}`),
    ...(custom?.aiQuestionPrompt
      ? ["", "=== CUSTOM TYPE TEMPLATE ===", custom.aiQuestionPrompt]
      : []),
    "",
    "=== STRUCTURED INPUT (JSON) ===",
    JSON.stringify(payload, null, 2),
    "",
    "=== TASK ===",
    "Generate one PostgreSQL INSERT INTO question_bank that satisfies every mandatory rule and reflects the structured content. Output SQL only.",
  ].join("\n")
}

export function buildAiSqlGenerationSystemPromptForSpec(
  spec: QuestionBankAiGenerationSpec,
  customTypes: CustomQuestionTypeDraft[] = [],
): string {
  const base = buildAiSqlGenerationSystemPrompt(spec.questionType)
  const custom = customTypes.find((t) => t.typeId === spec.questionType)
  return `${base}

The instructor has already chosen type, difficulty, topic, and other settings in a form.
You must copy those fixed values into the INSERT — never substitute different difficulty/topic/type.
Fill in question_text, options, correct_answer, hint, explanation, and type-specific columns from the structured JSON content section.
Only include answer_guidelines, sample_answer, or subquestions when the template for this question_type uses them.
JSONB columns must use single-quoted JSON with ::jsonb — never dollar-quoting for JSON arrays/objects.${custom?.schema.fields.length ? `\n\nAuthoring fields for this custom type:\n${custom.schema.fields.map((f) => `- ${f.label} (${f.kind})${f.description ? `: ${f.description}` : ""}`).join("\n")}` : ""}`
}
