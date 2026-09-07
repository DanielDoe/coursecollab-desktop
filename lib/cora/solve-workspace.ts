import { inferCoraDomain } from "@/lib/cora/infer-domain"
import type { CoraDomain, CoraProblemSource } from "@/lib/cora/types"

export type CoraSolveLearningMode =
  | "walkthrough"
  | "hint"
  | "check_work"
  | "challenge"
  | "worked_solution"

/** @deprecated Prefer worked_solution */
export type LegacySolveLearningMode = CoraSolveLearningMode | "full_solution"

export type CoraProblemSourceChip =
  | "homework"
  | "quiz"
  | "lecture"
  | "practice"
  | "exam"
  | "unknown"

export type CoraSolveVisualization =
  | "circuit"
  | "derivation"
  | "diagram"
  | "trace"
  | "chart"
  | "flow"
  | "structure"
  | "concept"

export type CoraSolveAssessmentState = "none" | "practice" | "review" | "active" | "completed"

export type CoraSolveIntegrity = {
  allowWorkedSolution: boolean
  assessmentState: CoraSolveAssessmentState
  reason?: string
}

export type CoraSolveAnalysis = {
  domain: CoraDomain
  domainLabel: string
  topic: string
  concepts: string[]
  difficulty: "Introductory" | "Intermediate" | "Advanced"
  estimatedMinutes: number
  prerequisites: Array<{ id: string; label: string; met: boolean }>
  learningGoal: string
  known: Array<{ symbol: string; value?: string }>
  unknown: Array<{ symbol: string }>
  formulas: Array<{ id: string; label: string; active?: boolean }>
  visualization: CoraSolveVisualization
  /** Subtle provenance line, e.g. "Practice Hub" */
  sourceLabel: string
  courseLabel?: string
  integrity: CoraSolveIntegrity
}

const DOMAIN_LABEL: Record<CoraDomain, string> = {
  circuit: "Circuit Analysis",
  coding: "Programming",
  math: "Mathematics",
  generic: "General Problem Solving",
}

const LEARNING_MODE_KEY = "coraSolveLearningMode"

export const CORA_SOLVE_LEARNING_MODES: Array<{
  id: CoraSolveLearningMode
  title: string
  description: string
  default?: boolean
}> = [
  {
    id: "walkthrough",
    title: "Walk Me Through",
    description: "Cora guides each step and checks understanding.",
    default: true,
  },
  {
    id: "hint",
    title: "Hint Mode",
    description: "Progressive hints without revealing the solution.",
  },
  {
    id: "check_work",
    title: "Check My Work",
    description: "You submit your approach; Cora verifies and explains gaps.",
  },
  {
    id: "challenge",
    title: "Challenge Mode",
    description: "Cora asks questions and provides minimal assistance.",
  },
  {
    id: "worked_solution",
    title: "Worked Solution",
    description: "Structured instructional walkthrough of the full solution.",
  },
]

/** @deprecated Manual source chips removed from UI — kept for type compat. */
export const CORA_SOLVE_SOURCE_CHIPS: Array<{ id: CoraProblemSourceChip; label: string }> = [
  { id: "homework", label: "Homework" },
  { id: "quiz", label: "Quiz" },
  { id: "lecture", label: "Lecture" },
  { id: "practice", label: "Practice" },
  { id: "exam", label: "Exam" },
  { id: "unknown", label: "Unknown" },
]

export const VISUALIZATION_LABEL: Record<CoraSolveVisualization, string> = {
  circuit: "Annotated circuit",
  derivation: "Animated derivation",
  diagram: "Interactive diagram",
  trace: "Execution trace",
  chart: "Chart / distribution",
  flow: "Logic flow",
  structure: "Equation / structure",
  concept: "Conceptual map",
}

export function learningModeToCoraMode(mode: CoraSolveLearningMode): "guided" | "explain" {
  return mode === "worked_solution" ? "explain" : "guided"
}

function normalizeLearningMode(raw: string | null): CoraSolveLearningMode {
  if (raw === "full_solution") return "worked_solution"
  if (
    raw === "walkthrough" ||
    raw === "hint" ||
    raw === "check_work" ||
    raw === "challenge" ||
    raw === "worked_solution"
  ) {
    return raw
  }
  return "walkthrough"
}

export function loadSolveLearningMode(studentId?: string | number | null): CoraSolveLearningMode {
  if (typeof window === "undefined") return "walkthrough"
  try {
    const key = studentId != null ? `${LEARNING_MODE_KEY}:${studentId}` : LEARNING_MODE_KEY
    return normalizeLearningMode(localStorage.getItem(key))
  } catch {
    return "walkthrough"
  }
}

export function saveSolveLearningMode(
  mode: CoraSolveLearningMode,
  studentId?: string | number | null,
): void {
  if (typeof window === "undefined") return
  try {
    const key = studentId != null ? `${LEARNING_MODE_KEY}:${studentId}` : LEARNING_MODE_KEY
    localStorage.setItem(key, mode)
  } catch {
    /* ignore */
  }
}

export function integrityForSource(input: {
  source?: CoraProblemSource | CoraProblemSourceChip | "custom" | null
  assessmentState?: CoraSolveAssessmentState
}): CoraSolveIntegrity {
  const state = input.assessmentState ?? "none"
  if (state === "active") {
    return {
      allowWorkedSolution: false,
      assessmentState: state,
      reason: "Full solutions are hidden during active assessments.",
    }
  }
  const src = input.source
  if (src === "exam" || src === "quiz") {
    if (state === "completed" || state === "review") {
      return { allowWorkedSolution: true, assessmentState: state }
    }
    return {
      allowWorkedSolution: false,
      assessmentState: state === "none" ? "active" : state,
      reason: "Worked Solution is unavailable for protected assessments.",
    }
  }
  return { allowWorkedSolution: true, assessmentState: state === "none" ? "practice" : state }
}

export function sourceLabelFor(
  source?: CoraProblemSource | CoraProblemSourceChip | null,
): string {
  switch (source) {
    case "practice_hub":
    case "practice":
      return "Practice Hub"
    case "lecture_workspace":
    case "lecture_practice":
    case "lecture":
      return "Lectures"
    case "quiz":
      return "Quizzes"
    case "homework":
      return "Homework"
    case "exam":
      return "Exam"
    case "codebench":
      return "CodeBench"
    case "classroom_points":
      return "Classroom Points"
    case "question_bank":
      return "Question Bank"
    default:
      return "Your upload"
  }
}

function detectTopic(domain: CoraDomain, text: string): string {
  const t = text.toLowerCase()
  if (domain === "circuit") {
    if (/\bmesh\b/.test(t)) return "Mesh Analysis"
    if (/\bnodal|node voltage\b/.test(t)) return "Nodal Analysis"
    if (/\bthevenin\b/.test(t)) return "Thévenin Equivalent"
    if (/\bnorton\b/.test(t)) return "Norton Equivalent"
    if (/\btransient|rc|rl\b/.test(t)) return "First-Order Transients"
    if (/\bpower factor|complex power|ac power\b/.test(t)) return "AC Power"
    if (/\bphasor|impedance|ac\b/.test(t)) return "AC / Phasor Analysis"
    if (/\bop.?amp\b/.test(t)) return "Op-Amp Circuits"
    return "Circuit Fundamentals"
  }
  if (domain === "coding") {
    if (/\brecursion\b/.test(t)) return "Recursion"
    if (/\bpointer|memory\b/.test(t)) return "Memory & Pointers"
    if (/\bloop|array\b/.test(t)) return "Loops & Arrays"
    if (/\bdebug\b/.test(t)) return "Debugging"
    return "Programming Problem"
  }
  if (domain === "math") {
    if (/\bintegral\b/.test(t)) return "Integration"
    if (/\bderivative|differenti\b/.test(t)) return "Differentiation"
    if (/\bmatrix|gaussian\b/.test(t)) return "Linear Algebra"
    return "Problem Solving"
  }
  return "Concept Application"
}

function detectConcepts(domain: CoraDomain, topic: string, text: string): string[] {
  const t = text.toLowerCase()
  if (domain === "circuit") {
    const concepts: string[] = []
    if (/complex power|s\s*=/.test(t)) concepts.push("Complex Power")
    if (/power factor|pf\b|cos\s*θ/.test(t)) concepts.push("Power Factor")
    if (/phasor/.test(t)) concepts.push("Phasors")
    if (/impedance|jω|j\\?omega/.test(t)) concepts.push("Impedance")
    if (/rms/.test(t)) concepts.push("RMS")
    if (/mesh/.test(t)) concepts.push("Mesh Currents")
    if (/nodal|kcl/.test(t)) concepts.push("Nodal Analysis")
    if (concepts.length === 0) concepts.push(topic)
    return concepts.slice(0, 4)
  }
  if (domain === "coding") {
    return [topic, "Edge cases", "Complexity"].slice(0, 3)
  }
  if (domain === "math") {
    return [topic, "Setup", "Verification"].slice(0, 3)
  }
  return [topic]
}

function detectDifficulty(text: string): CoraSolveAnalysis["difficulty"] {
  const len = text.trim().length
  const multiPart = /\(a\)|\(b\)|part\s*[12]|multi.?part/i.test(text)
  if (len > 900 || multiPart || /\bprove|derive|optimize\b/i.test(text)) return "Advanced"
  if (len > 280 || /\bfind|determine|calculate|show that\b/i.test(text)) return "Intermediate"
  return "Introductory"
}

function estimateMinutes(difficulty: CoraSolveAnalysis["difficulty"], domain: CoraDomain): number {
  const base = difficulty === "Introductory" ? 5 : difficulty === "Intermediate" ? 8 : 14
  return domain === "coding" ? base + 2 : base
}

function visualizationFor(domain: CoraDomain, text: string): CoraSolveVisualization {
  const t = text.toLowerCase()
  if (domain === "circuit") return "circuit"
  if (domain === "coding") return "trace"
  if (domain === "math") {
    if (/\bprove|derive|show that\b/.test(t)) return "derivation"
    return "derivation"
  }
  if (/\bprobability|distribution|histogram|regress\b/.test(t)) return "chart"
  if (/\blogic|boolean|truth table|fsm\b/.test(t)) return "flow"
  if (/\bchem|molecule|stoich|react\b/.test(t)) return "structure"
  if (/\bforce|velocity|momentum|physics\b/.test(t)) return "diagram"
  return "concept"
}

function extractKnownUnknown(text: string): Pick<CoraSolveAnalysis, "known" | "unknown"> {
  const known: CoraSolveAnalysis["known"] = []
  const unknown: CoraSolveAnalysis["unknown"] = []
  const valuePairs = text.matchAll(
    /\b([VIRRPL][a-z0-9_]{0,3}|Vs|Ix|Iy|Vab|ω)\s*[=≈]\s*([0-9]+(?:\.[0-9]+)?\s*(?:V|A|Ω|ohm|W|rad\/s|Hz)?)/gi,
  )
  for (const m of valuePairs) {
    known.push({ symbol: m[1]!, value: m[2]!.trim() })
    if (known.length >= 6) break
  }
  const ask = text.matchAll(/\b(?:find|determine|solve for|calculate)\s+([A-Za-z][A-Za-z0-9_]{0,4})\b/gi)
  for (const m of ask) {
    const sym = m[1]!
    if (!unknown.some((u) => u.symbol === sym) && !known.some((k) => k.symbol === sym)) {
      unknown.push({ symbol: sym })
    }
    if (unknown.length >= 5) break
  }
  if (unknown.length === 0 && /\bI[xy]\b/.test(text)) unknown.push({ symbol: "Ix" })
  if (unknown.length === 0 && /\bV[a-z]{1,2}\b/.test(text) && known.length > 0) {
    unknown.push({ symbol: "V?" })
  }
  return { known, unknown }
}

function prerequisitesFor(domain: CoraDomain, topic: string): CoraSolveAnalysis["prerequisites"] {
  if (domain === "circuit") {
    const mesh = /mesh/i.test(topic)
    return [
      { id: "kvl", label: "KVL", met: true },
      { id: "ohm", label: "Ohm's Law", met: true },
      { id: "lin", label: "Linear Equations", met: mesh || true },
      { id: "rms", label: "RMS values", met: /ac|power|phasor/i.test(topic) },
      { id: "phasor", label: "Phasors", met: /ac|power|phasor|impedance/i.test(topic) },
    ]
  }
  if (domain === "coding") {
    return [
      { id: "syntax", label: "Language Syntax", met: true },
      { id: "control", label: "Control Flow", met: true },
      { id: "debug", label: "Basic Debugging", met: true },
    ]
  }
  if (domain === "math") {
    return [
      { id: "algebra", label: "Algebra", met: true },
      { id: "functions", label: "Functions", met: true },
    ]
  }
  return [
    { id: "read", label: "Problem Reading", met: true },
    { id: "plan", label: "Solution Planning", met: true },
  ]
}

function formulasFor(domain: CoraDomain, topic: string): CoraSolveAnalysis["formulas"] {
  if (domain === "circuit") {
    return [
      { id: "ohm", label: "Ohm's Law", active: true },
      { id: "power", label: "Power", active: /power|P\b/i.test(topic) },
      { id: "mesh", label: "Mesh", active: /mesh/i.test(topic) },
      { id: "kvl", label: "Kirchhoff", active: true },
      { id: "thev", label: "Thévenin", active: /thévenin|thevenin/i.test(topic) },
    ]
  }
  if (domain === "coding") {
    return [
      { id: "complexity", label: "Time Complexity", active: true },
      { id: "invariants", label: "Loop Invariants", active: true },
      { id: "trace", label: "Execution Trace", active: true },
    ]
  }
  if (domain === "math") {
    return [
      { id: "identity", label: "Identities", active: true },
      { id: "transform", label: "Transforms", active: true },
    ]
  }
  return [{ id: "plan", label: "Problem → Plan → Check", active: true }]
}

function inferLearningGoal(topic: string, unknown: CoraSolveAnalysis["unknown"], text: string): string {
  if (unknown[0]?.symbol) return `Determine ${unknown[0].symbol}`
  const m = text.match(/\b(?:find|determine|calculate|solve for)\s+([^.?!\n]{3,60})/i)
  if (m?.[1]) return `Determine ${m[1].trim().replace(/\s+/g, " ")}`
  return `Understand ${topic}`
}

export type AnalyzeSolveOptions = {
  source?: CoraProblemSource | CoraProblemSourceChip | null
  assessmentState?: CoraSolveAssessmentState
  courseLabel?: string | null
  sourceLabel?: string | null
}

/** Instant client-side analysis while the student types/pastes. */
export function analyzeSolveProblem(
  text: string,
  options: AnalyzeSolveOptions = {},
): CoraSolveAnalysis | null {
  const trimmed = text.trim()
  if (trimmed.length < 12) return null

  const domain = inferCoraDomain({ questionText: trimmed })
  const topic = detectTopic(domain, trimmed)
  const difficulty = detectDifficulty(trimmed)
  const { known, unknown } = extractKnownUnknown(trimmed)
  const integrity = integrityForSource({
    source: options.source,
    assessmentState: options.assessmentState,
  })

  return {
    domain,
    domainLabel: DOMAIN_LABEL[domain],
    topic,
    concepts: detectConcepts(domain, topic, trimmed),
    difficulty,
    estimatedMinutes: estimateMinutes(difficulty, domain),
    prerequisites: prerequisitesFor(domain, topic),
    learningGoal: inferLearningGoal(topic, unknown, trimmed),
    known,
    unknown,
    formulas: formulasFor(domain, topic),
    visualization: visualizationFor(domain, trimmed),
    sourceLabel: options.sourceLabel ?? sourceLabelFor(options.source),
    courseLabel: options.courseLabel?.trim() || undefined,
    integrity,
  }
}
