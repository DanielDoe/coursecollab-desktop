/**
 * ECE 2202 assessment templates: sectionized homework / quiz / exam shells.
 */

import type { SectionConfig } from "@/lib/assessment-sections"
import {
  buildStandardSolutionUploadConfig,
  maxPointsForMultiPartQuestion,
  DEFAULT_UPLOAD_POINTS_MULTIPLIER,
} from "@/lib/multi-part-grading-policy"

export const ECE2202_SECTION_I_COUNT = 12
export const ECE2202_SECTION_II_MULTIPART_COUNT = 2

export const ECE2202_HOMEWORK_SECTION_CONFIG: SectionConfig[] = [
  {
    title: "Section I: Concept Review",
    question_types: ["mcq", "true_false", "select_all", "fill_blank", "multiple_choice"],
    weight_percent: 20,
    question_order_start: 1,
    question_order_end: ECE2202_SECTION_I_COUNT,
  },
  {
    title: "Section II: Circuit Problems",
    question_types: ["multi_part"],
    weight_percent: 80,
    question_order_start: ECE2202_SECTION_I_COUNT + 1,
    question_order_end: ECE2202_SECTION_I_COUNT + ECE2202_SECTION_II_MULTIPART_COUNT,
  },
]

export const PLACEHOLDER_SECTION_I_TEXT =
  "[Template] Section I question — replace by importing from the question bank."

export const PLACEHOLDER_SECTION_II_TEXT =
  "[Template] Section II multi-part problem — replace by importing from the question bank."

const PLACEHOLDER_MCQ_OPTIONS = {
  option_a: "Option A (placeholder)",
  option_b: "Option B (placeholder)",
  option_c: "Option C (placeholder)",
  option_d: "Option D (placeholder)",
  option_e: "",
  correct_answer: "A",
}

/** Minimal single-part multi_part shell until bank questions are linked. */
export function placeholderMultiPartSubquestionsJson(): string {
  return JSON.stringify([
    {
      id: "a",
      type: "mcq",
      points: 1,
      prompt: "[Template] Replace this sub-part from the question bank.",
      options: [
        { id: "A", text: "Placeholder A" },
        { id: "B", text: "Placeholder B" },
        { id: "C", text: "Placeholder C" },
        { id: "D", text: "Placeholder D" },
      ],
      correct_answer: "A",
    },
  ])
}

export function placeholderSectionIQuestion(order: number) {
  return {
    question_text: `${PLACEHOLDER_SECTION_I_TEXT} (slot ${order})`,
    question_type: "mcq",
    question_order: order,
    time_limit: 50,
    max_points: 1,
    points: 1,
    ...PLACEHOLDER_MCQ_OPTIONS,
  }
}

export function placeholderSectionIiQuestion(order: number, uploadMultiplier = DEFAULT_UPLOAD_POINTS_MULTIPLIER) {
  const subquestionsRaw = placeholderMultiPartSubquestionsJson()
  const partCount = 1
  const maxPoints = maxPointsForMultiPartQuestion(JSON.parse(subquestionsRaw), uploadMultiplier)
  const solutionConfig = buildStandardSolutionUploadConfig({
    uploadPointsMultiplier: uploadMultiplier,
    partCount,
  })
  return {
    question_text: `${PLACEHOLDER_SECTION_II_TEXT} (slot ${order - ECE2202_SECTION_I_COUNT})`,
    question_type: "multi_part",
    question_order: order,
    time_limit: 300,
    max_points: maxPoints,
    points: maxPoints,
    subquestions: subquestionsRaw,
    solution_upload_config: solutionConfig,
    option_a: "",
    option_b: "",
    option_c: "",
    option_d: "",
    option_e: "",
    correct_answer: "",
  }
}

export function buildEce2202TemplateQuestions(uploadMultiplier = DEFAULT_UPLOAD_POINTS_MULTIPLIER) {
  const out: Array<ReturnType<typeof placeholderSectionIQuestion> | ReturnType<typeof placeholderSectionIiQuestion>> =
    []
  for (let i = 1; i <= ECE2202_SECTION_I_COUNT; i++) {
    out.push(placeholderSectionIQuestion(i))
  }
  for (let i = 1; i <= ECE2202_SECTION_II_MULTIPART_COUNT; i++) {
    out.push(placeholderSectionIiQuestion(ECE2202_SECTION_I_COUNT + i, uploadMultiplier))
  }
  return out
}

export type Ece2202TemplateSpec = {
  title: string
  assessment_type: "homework" | "quiz" | "mid_semester" | "final"
  description: string
}

export const ECE2202_HOMEWORK_TEMPLATES: Ece2202TemplateSpec[] = [3, 4, 5, 6, 7, 8].map((n) => ({
  title: `ECE 2202 - Homework ${n}`,
  assessment_type: "homework" as const,
  description: `Homework ${n} template (Section I 20% + Section II 80%). Load questions from the question bank. TA/BETA preview only.`,
}))

export const ECE2202_QUIZ_TEMPLATES: Ece2202TemplateSpec[] = [
  {
    title: "ECE 2202 - Quiz 1",
    assessment_type: "quiz",
    description:
      "Quiz 1 template (Section I 20% + Section II 80%). Load questions from the question bank. TA/BETA preview only.",
  },
  {
    title: "ECE 2202 - Quiz 2",
    assessment_type: "quiz",
    description:
      "Quiz 2 template (Section I 20% + Section II 80%). Load questions from the question bank. TA/BETA preview only.",
  },
  {
    title: "ECE 2202 - Mid-Semester Exam",
    assessment_type: "mid_semester",
    description:
      "Mid-semester exam template (Section I 20% + Section II 80%). Load questions from the question bank. TA/BETA preview only.",
  },
  {
    title: "ECE 2202 - Final Exam",
    assessment_type: "final",
    description:
      "Final exam template (Section I 20% + Section II 80%). Load questions from the question bank. TA/BETA preview only.",
  },
]
