/**
 * Heuristic assistance taxonomy + depth from workflow and message signals.
 * Stored as inferred metrics — not validated human labels.
 */

export const ASSISTANCE_TYPES = [
  "explanation",
  "hint",
  "worked_example",
  "answer_checking",
  "debugging",
  "concept_clarification",
  "problem_decomposition",
  "socratic_questioning",
  "study_planning",
  "flashcard_generation",
  "practice_generation",
  "assessment_feedback",
  "code_explanation",
  "code_debugging",
  "document_analysis",
  "search_retrieval",
  "direct_answer_request",
  "metacognitive_support",
  "other",
] as const

export type AssistanceType = (typeof ASSISTANCE_TYPES)[number]

export type AssistanceClassification = {
  assistanceType: AssistanceType
  assistanceDepth: 0 | 1 | 2 | 3 | 4 | 5
  classificationConfidence: number
}

const DEPTH_BY_TYPE: Partial<Record<AssistanceType, 0 | 1 | 2 | 3 | 4 | 5>> = {
  concept_clarification: 1,
  hint: 2,
  socratic_questioning: 2,
  problem_decomposition: 3,
  answer_checking: 3,
  explanation: 3,
  metacognitive_support: 3,
  debugging: 3,
  code_debugging: 3,
  worked_example: 4,
  direct_answer_request: 5,
  assessment_feedback: 4,
}

function clampConfidence(n: number): number {
  return Math.max(0.35, Math.min(0.95, Math.round(n * 100) / 100))
}

export function classifyAssistanceFromSignals(input: {
  workflowType?: string | null
  userMessage?: string | null
  learningGoal?: string | null
  toolNames?: string[]
  activeAssessment?: boolean
}): AssistanceClassification {
  const workflow = String(input.workflowType ?? "").trim().toLowerCase()
  const message = String(input.userMessage ?? "").trim().toLowerCase()
  const goal = String(input.learningGoal ?? "").trim().toLowerCase()
  const tools = (input.toolNames ?? []).map((t) => t.toLowerCase())

  let assistanceType: AssistanceType = "other"
  let confidence = 0.45

  if (/flash|card/.test(workflow) || goal.includes("flashcard")) {
    assistanceType = "flashcard_generation"
    confidence = 0.82
  } else if (/quiz|practice|homework|question/.test(workflow) || goal.includes("practice")) {
    assistanceType = "practice_generation"
    confidence = 0.78
  } else if (/grad|feedback|rubric/.test(workflow) || input.activeAssessment) {
    assistanceType = "assessment_feedback"
    confidence = 0.8
  } else if (/search|rag|retriev/.test(workflow) || tools.some((t) => t.includes("search") || t.includes("retriev"))) {
    assistanceType = "search_retrieval"
    confidence = 0.76
  } else if (/document|vision|extract|pdf/.test(workflow)) {
    assistanceType = "document_analysis"
    confidence = 0.8
  } else if (/debug|playground/.test(workflow) || /\bdebug\b/.test(message)) {
    assistanceType = "code_debugging"
    confidence = 0.74
  } else if (/code/.test(workflow) || /\bcode\b|\bcircuit\b/.test(message)) {
    assistanceType = "code_explanation"
    confidence = 0.7
  } else if (/study.?plan|planning/.test(workflow) || goal.includes("study_plan")) {
    assistanceType = "study_planning"
    confidence = 0.75
  } else if (/\bhint\b|\bnudge\b|\bclue\b/.test(message)) {
    assistanceType = "hint"
    confidence = 0.72
  } else if (/\bwork(ed)? example\b|\bstep.?by.?step solution\b|\bshow me how\b/.test(message)) {
    assistanceType = "worked_example"
    confidence = 0.78
  } else if (/\bgive me the answer\b|\bjust tell me\b|\bwhat is the answer\b|\bsolve this for me\b/.test(message)) {
    assistanceType = "direct_answer_request"
    confidence = 0.8
  } else if (/\bexplain\b|\bwhy\b|\bhow does\b|\bwhat does\b mean/.test(message)) {
    assistanceType = "explanation"
    confidence = 0.68
  } else if (/\bcheck my (work|answer)\b|\bis this (right|correct)\b/.test(message)) {
    assistanceType = "answer_checking"
    confidence = 0.72
  } else if (/\bbreak (it )?down\b|\bdecompose\b|\bsmaller steps\b/.test(message)) {
    assistanceType = "problem_decomposition"
    confidence = 0.7
  } else if (/\bconcept\b|\bdefinition\b|\bclarif/.test(message)) {
    assistanceType = "concept_clarification"
    confidence = 0.66
  } else if (/chat|tutor|agent|cora|ask/.test(workflow)) {
    assistanceType = "explanation"
    confidence = 0.55
  }

  const assistanceDepth = DEPTH_BY_TYPE[assistanceType] ?? (assistanceType === "other" ? 2 : 3)
  return {
    assistanceType,
    assistanceDepth,
    classificationConfidence: clampConfidence(confidence),
  }
}
