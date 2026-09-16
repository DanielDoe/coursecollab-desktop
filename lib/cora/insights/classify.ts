import { inferCoraModule, inferCoraTopic } from "@/lib/cora/instructor-cora-insights"
import {
  type AssistanceLevel,
  type CoraInteractionCategory,
} from "@/lib/cora/insights/taxonomy"

const CATEGORY_RULES: Array<{ category: CoraInteractionCategory; re: RegExp }> = [
  { category: "answer_seeking", re: /\b(just (give|tell) me the answer|what('?s| is) the (correct )?answer|solve this for me)\b/i },
  { category: "debugging", re: /\b(debug|compiler error|stack trace|segfault|runtime error|error.?spot)\b/i },
  { category: "code_understanding", re: /\b(walk me through (this )?code|trace the execution|what does this (code|function) do)\b/i },
  { category: "circuit_analysis", re: /\b(circuit|kcl|kvl|op-?amp|thevenin|norton|nodal|mesh)\b/i },
  { category: "lecture_clarification", re: /\b(lecture|slide|today'?s class|professor said)\b/i },
  { category: "study_planning", re: /\b(study plan|exam prep|prepare for|flashcards?|notes?)\b/i },
  { category: "practice", re: /\b(practice (hub|problem|question)|homework practice)\b/i },
  { category: "assessment_help", re: /\b(quiz|exam|midterm|final|homework|assessment)\b/i },
  { category: "writing_explanation", re: /\b(explain (my|this) (essay|paragraph|write-?up)|lab report)\b/i },
  { category: "career_help", re: /\b(resume|internship|career|interview)\b/i },
  { category: "hint_guided", re: /\b(hint|nudge|stuck|how (do|should) i (start|approach))\b/i },
  { category: "concept_explanation", re: /\b(what (is|are)|explain|concept|mean(ing)? of)\b/i },
]

const MODULE_TO_CATEGORY: Record<string, CoraInteractionCategory> = {
  Assessments: "assessment_help",
  Flashcards: "study_planning",
  Notes: "study_planning",
  "Study Plan": "study_planning",
  Lectures: "lecture_clarification",
  "Practice Hub": "practice",
  Code: "code_understanding",
  Grades: "other",
}

const FEATURE_TO_CATEGORY: Record<string, CoraInteractionCategory> = {
  ask_cora: "assessment_help",
  flashcards: "study_planning",
  notes: "study_planning",
  lectures: "lecture_clarification",
  practice: "practice",
  quizzes: "assessment_help",
  "quiz-history": "assessment_help",
  code: "code_understanding",
  codebench: "debugging",
  code_debug: "debugging",
  code_help: "debugging",
  analytics: "code_understanding",
  study_plan: "study_planning",
  "study-plan": "study_planning",
  calendar: "study_planning",
}

export function classifyInteractionCategory(input: {
  text?: string | null
  topic?: string | null
  module?: string | null
  feature?: string | null
  assistanceCategory?: string | null
  answerSeeking?: boolean
  questionType?: string | null
}): CoraInteractionCategory {
  if (input.answerSeeking || input.assistanceCategory === "answer_seeking") return "answer_seeking"
  const feature = String(input.feature ?? "").toLowerCase()
  if (FEATURE_TO_CATEGORY[feature]) return FEATURE_TO_CATEGORY[feature]
  const qt = String(input.questionType ?? "").toLowerCase()
  if (qt.includes("circuit")) return "circuit_analysis"
  if (qt.includes("code")) return /debug|error/.test(String(input.text ?? "")) ? "debugging" : "code_understanding"
  const blob = `${input.text ?? ""} ${input.topic ?? ""} ${input.module ?? ""}`
  for (const rule of CATEGORY_RULES) {
    if (rule.re.test(blob)) return rule.category
  }
  const moduleLabel = inferCoraModule(blob, input.feature)
  if (MODULE_TO_CATEGORY[moduleLabel]) return MODULE_TO_CATEGORY[moduleLabel]
  if (input.assistanceCategory === "conceptual" || input.assistanceCategory === "concept_explanation") {
    return "concept_explanation"
  }
  if (input.assistanceCategory === "hint" || input.assistanceCategory === "debugging") {
    return input.assistanceCategory === "debugging" ? "debugging" : "hint_guided"
  }
  return "other"
}

export function classifyAssistanceLevel(input: {
  hintLevel?: number | null
  assistanceDepth?: number | null
  assistanceCategory?: string | null
  answerSeeking?: boolean
  noCora?: boolean
}): AssistanceLevel {
  if (input.noCora) return 0
  if (input.hintLevel != null && Number.isFinite(input.hintLevel)) {
    return clampLevel(Number(input.hintLevel))
  }
  if (input.assistanceDepth != null && Number.isFinite(input.assistanceDepth)) {
    return clampLevel(Number(input.assistanceDepth))
  }
  if (input.answerSeeking) return 5
  const cat = String(input.assistanceCategory ?? "")
  if (cat === "concept_explanation" || cat === "conceptual") return 1
  if (cat === "hint") return 2
  if (cat === "debugging" || cat === "guided") return 3
  return 2
}

export function classifyConcept(text?: string | null, storedTopic?: string | null): string {
  const topic = inferCoraTopic(String(text ?? ""), storedTopic)
  return topic && topic !== "Course help" ? topic : storedTopic?.trim() || "Course help"
}

const MISTAKE_RULES: Array<{ re: RegExp; label: string }> = [
  { re: /\boff[-\s]?by[-\s]?one\b|\bloop bound/, label: "Off-by-one loop condition" },
  { re: /\bmissing semicolon\b|\bexpected ';'\b/, label: "Missing semicolon" },
  { re: /\binteger division\b|\btruncat/, label: "Integer division misconception" },
  { re: /\bassignment vs comparison\b|\b= vs ==\b|\bused = instead/, label: "Assignment (=) vs comparison (==)" },
  { re: /\bformula rearrang|\bwrong formula|\bformula doesn'?t match|\bohm'?s law/, label: "Incorrect formula" },
  { re: /\bpolarity\b|\breversed (the )?diode/, label: "Wrong circuit polarity" },
  { re: /\bunit conversion\b|\bforgot to convert/, label: "Incorrect unit conversion" },
  { re: /\binner[-\s]?loop counter|reset(ting)? (the )?inner/, label: "Resetting inner-loop counters" },
  { re: /\bwhile vs for\b|\bfor loop vs while/, label: "Confusing while and for loop behavior" },
  { re: /\barray index|out of bounds|index error/, label: "Array indexing error" },
  { re: /\bdoesn'?t store|throws it away|never assign|unused (expression|result)|discarded/, label: "Computed value never stored" },
  { re: /\bprints the (original|input)|not the calculated/, label: "Prints input instead of the result" },
  { re: /\bforgot to (print|output|cout)|never (print|output|display)|missing (output|cout|print)/, label: "Forgot to print the result" },
  { re: /\buninitialized|used before (being )?set/, label: "Uninitialized variable" },
  { re: /\binfinite loop|loop never (ends|terminates)/, label: "Infinite loop" },
  { re: /\bnull pointer|segfault|dereference/, label: "Invalid pointer / crash" },
]

export function classifyMistake(text?: string | null, questionType?: string | null): string | null {
  const blob = `${text ?? ""} ${questionType ?? ""}`.toLowerCase()
  for (const rule of MISTAKE_RULES) {
    if (rule.re.test(blob)) return rule.label
  }
  return null
}

export function extractMistakeLabels(...parts: Array<string | null | undefined>): string[] {
  const blob = parts.filter(Boolean).join("\n")
  if (!blob.trim()) return []
  const found = new Set<string>()
  const lower = blob.toLowerCase()
  for (const rule of MISTAKE_RULES) {
    if (rule.re.test(lower)) found.add(rule.label)
  }
  return [...found]
}

export function extractMistakesFromCode(code?: string | null): string[] {
  const src = String(code ?? "")
  if (!src.trim()) return []
  const found = new Set<string>(extractMistakeLabels(src))
  for (const line of src.split("\n")) {
    const t = line.trim()
    if (/^[A-Za-z_]\w*(\s*[/*+\-]\s*[^;]+);$/.test(t) && !t.includes("=") && !/^(cout|cin|cerr|return)\b/.test(t)) {
      found.add("Computed value never stored")
    }
  }
  const assigned = [...src.matchAll(/\b([A-Za-z_]\w*)\s*=\s*[^;]+;/g)]
    .map((m) => m[1])
    .filter((name) => !["cin", "cout", "cerr"].includes(name))
  const lastAssigned = assigned.at(-1)
  if (
    lastAssigned &&
    /\breturn\s+0\s*;/.test(src) &&
    !new RegExp(`\\bcout\\b[\\s\\S]*\\b${lastAssigned}\\b`).test(src)
  ) {
    found.add("Forgot to print the result")
  }
  if (/\bint\b/.test(src) && /\/\s*[1-9]\d*(?!\s*\.)/.test(src) && !/\bdouble\b|\bfloat\b/.test(src)) {
    found.add("Integer division misconception")
  }
  return [...found]
}

function clampLevel(n: number): AssistanceLevel {
  if (n <= 0) return 0
  if (n >= 5) return 5
  return Math.round(n) as AssistanceLevel
}
