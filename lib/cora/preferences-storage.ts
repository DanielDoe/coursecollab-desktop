import type { CoraStudentContextPayload } from "@/lib/cora/fetch-student-context"
import type { CoraLearningGoal } from "@/lib/cora/learning-goals"

export type CoraExplanationFormat = "visual" | "worked_examples" | "conceptual" | "practice_first"

export type CoraExplanationLevel = "quick" | "guided" | "deep"

export type CoraTechnicalLevel = "introductory" | "intermediate" | "advanced"

export type CoraDefaultBehavior = "guide" | "explain" | "practice"

export type CoraTeachingPrefs = {
  stepByStep: boolean
  visualExplanations: boolean
  realWorldExamples: boolean
  checkUnderstanding: boolean
  showFormulas: boolean
  codeWhenRelevant: boolean
  hintsBeforeSolutions: boolean
}

export type CoraLearningMemory = {
  "remember-gaps": boolean
  "detect-confusion": boolean
  "remember-strengths": boolean
  "use-course-progress": boolean
  "remember-preferences": boolean
}

export type CoraTutorPreferences = {
  defaultBehavior: CoraDefaultBehavior
  explanationFormats: CoraExplanationFormat[]
  explanationLevel: CoraExplanationLevel
  technicalLevel: CoraTechnicalLevel
  teaching: CoraTeachingPrefs
  memory: CoraLearningMemory
  clearedMemoryIds: string[]
  /** Opt-in: share summarized Cora activity with the course instructor. Default off. */
  shareWithInstructor: boolean
}

export const DEFAULT_LEARNING_MEMORY: CoraLearningMemory = {
  "remember-gaps": true,
  "detect-confusion": true,
  "remember-strengths": true,
  "use-course-progress": true,
  "remember-preferences": true,
}

export const DEFAULT_TUTOR_PREFERENCES: CoraTutorPreferences = {
  defaultBehavior: "guide",
  explanationFormats: ["visual", "conceptual"],
  explanationLevel: "guided",
  technicalLevel: "intermediate",
  teaching: {
    stepByStep: true,
    visualExplanations: true,
    realWorldExamples: true,
    checkUnderstanding: true,
    showFormulas: true,
    codeWhenRelevant: true,
    hintsBeforeSolutions: true,
  },
  memory: { ...DEFAULT_LEARNING_MEMORY },
  clearedMemoryIds: [],
  shareWithInstructor: false,
}

const STORAGE_KEY_PREFIX = "coraTutorPreferences:"
const LEGACY_MEMORY_PREFIX = "coraLearningMemory:"
const LEGACY_STYLE_PREFIX = "learningPrefs_"

function storageKey(studentId: string) {
  return `${STORAGE_KEY_PREFIX}${studentId}`
}

export function defaultBehaviorToLearningGoal(behavior: CoraDefaultBehavior): CoraLearningGoal {
  if (behavior === "explain") return "understand"
  if (behavior === "practice") return "review"
  return "solve_together"
}

function migrateLegacyStyle(raw: Record<string, unknown>): Partial<CoraTutorPreferences> {
  const style = raw.preferredStyle
  const formats: CoraExplanationFormat[] = []
  if (style === "visual") formats.push("visual")
  else if (style === "kinesthetic") formats.push("practice_first", "worked_examples")
  else if (style === "reading") formats.push("conceptual")
  else if (style === "auditory") formats.push("conceptual")
  else formats.push("visual", "conceptual")

  const depth = raw.explanationDepth
  const explanationLevel: CoraExplanationLevel =
    depth === "brief" ? "quick" : depth === "comprehensive" ? "deep" : "guided"

  const techNum = Number(raw.technicalLevel) || 3
  const technicalLevel: CoraTechnicalLevel =
    techNum <= 2 ? "introductory" : techNum >= 4 ? "advanced" : "intermediate"

  return {
    explanationFormats: formats,
    explanationLevel,
    technicalLevel,
    teaching: {
      stepByStep: Boolean(raw.stepByStepBreakdown ?? true),
      visualExplanations: Boolean(raw.visualDiagrams ?? true),
      realWorldExamples: Boolean(raw.realWorldAnalogies ?? true),
      checkUnderstanding: true,
      showFormulas: true,
      codeWhenRelevant: Boolean(raw.codeExamples ?? true),
      hintsBeforeSolutions: true,
    },
  }
}

export function loadCoraTutorPreferences(studentId: string | undefined | null): CoraTutorPreferences {
  if (typeof window === "undefined" || !studentId) return { ...DEFAULT_TUTOR_PREFERENCES, memory: { ...DEFAULT_LEARNING_MEMORY }, teaching: { ...DEFAULT_TUTOR_PREFERENCES.teaching }, explanationFormats: [...DEFAULT_TUTOR_PREFERENCES.explanationFormats], clearedMemoryIds: [] }

  try {
    const raw = localStorage.getItem(storageKey(studentId))
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CoraTutorPreferences>
      return mergeTutorPreferences(parsed)
    }

    // Migrate legacy stores
    let legacyMemory: Partial<CoraLearningMemory> = {}
    const memRaw = localStorage.getItem(`${LEGACY_MEMORY_PREFIX}${studentId}`)
    if (memRaw) legacyMemory = JSON.parse(memRaw) as Partial<CoraLearningMemory>

    let legacyStyle: Partial<CoraTutorPreferences> = {}
    const styleRaw = localStorage.getItem(`${LEGACY_STYLE_PREFIX}${studentId}`)
    if (styleRaw) legacyStyle = migrateLegacyStyle(JSON.parse(styleRaw) as Record<string, unknown>)

    const migrated = mergeTutorPreferences({
      ...legacyStyle,
      memory: { ...DEFAULT_LEARNING_MEMORY, ...legacyMemory },
    })
    saveCoraTutorPreferences(studentId, migrated)
    return migrated
  } catch {
    return {
      ...DEFAULT_TUTOR_PREFERENCES,
      memory: { ...DEFAULT_LEARNING_MEMORY },
      teaching: { ...DEFAULT_TUTOR_PREFERENCES.teaching },
      explanationFormats: [...DEFAULT_TUTOR_PREFERENCES.explanationFormats],
      clearedMemoryIds: [],
    }
  }
}

function mergeTutorPreferences(partial: Partial<CoraTutorPreferences>): CoraTutorPreferences {
  return {
    defaultBehavior: partial.defaultBehavior ?? DEFAULT_TUTOR_PREFERENCES.defaultBehavior,
    explanationFormats:
      partial.explanationFormats?.length
        ? partial.explanationFormats
        : [...DEFAULT_TUTOR_PREFERENCES.explanationFormats],
    explanationLevel: partial.explanationLevel ?? DEFAULT_TUTOR_PREFERENCES.explanationLevel,
    technicalLevel: partial.technicalLevel ?? DEFAULT_TUTOR_PREFERENCES.technicalLevel,
    teaching: { ...DEFAULT_TUTOR_PREFERENCES.teaching, ...partial.teaching },
    memory: { ...DEFAULT_LEARNING_MEMORY, ...partial.memory },
    clearedMemoryIds: Array.isArray(partial.clearedMemoryIds) ? partial.clearedMemoryIds : [],
    shareWithInstructor: partial.shareWithInstructor === true,
  }
}

export function saveCoraTutorPreferences(
  studentId: string | undefined | null,
  prefs: CoraTutorPreferences,
): void {
  if (typeof window === "undefined" || !studentId) return
  try {
    localStorage.setItem(storageKey(studentId), JSON.stringify(prefs))
    // Keep legacy memory key in sync for older callers
    localStorage.setItem(`${LEGACY_MEMORY_PREFIX}${studentId}`, JSON.stringify(prefs.memory))
  } catch {
    /* non-fatal */
  }
}

/** @deprecated use loadCoraTutorPreferences — kept for dashboard/drawer compatibility */
export function loadCoraLearningMemory(studentId: string | undefined | null): CoraLearningMemory {
  return loadCoraTutorPreferences(studentId).memory
}

/** @deprecated use saveCoraTutorPreferences */
export function saveCoraLearningMemory(
  studentId: string | undefined | null,
  prefs: CoraLearningMemory,
): void {
  if (typeof window === "undefined" || !studentId) return
  const full = loadCoraTutorPreferences(studentId)
  saveCoraTutorPreferences(studentId, { ...full, memory: { ...DEFAULT_LEARNING_MEMORY, ...prefs } })
}

export type CoraMemoryFact = {
  id: string
  label: string
}

export function deriveVisibleMemoryFacts(
  prefs: CoraTutorPreferences,
  ctx: CoraStudentContextPayload | null | undefined,
): CoraMemoryFact[] {
  const facts: CoraMemoryFact[] = []
  const levelLabel =
    prefs.explanationLevel === "quick"
      ? "quick"
      : prefs.explanationLevel === "deep"
        ? "deep"
        : "guided"
  facts.push({
    id: "pref-level",
    label: `You prefer ${levelLabel} explanations`,
  })
  if (prefs.explanationFormats.includes("visual")) {
    facts.push({ id: "pref-visual", label: "You usually prefer diagrams for hard topics" })
  }
  const focus = ctx?.strugglingTopics?.[0]
  if (focus && prefs.memory["remember-gaps"]) {
    facts.push({ id: `gap-${focus}`, label: `${focus} has been difficult recently` })
  }
  const strength = ctx?.strengths?.[0]
  if (strength && prefs.memory["remember-strengths"]) {
    facts.push({ id: `str-${strength}`, label: `You're stronger at ${strength}` })
  }
  const course = ctx?.account?.courseCode
  if (course && prefs.memory["use-course-progress"]) {
    facts.push({ id: "course", label: `You're working in ${course}` })
  }
  facts.push({
    id: "behavior",
    label:
      prefs.defaultBehavior === "guide"
        ? "Default: guide me through problems"
        : prefs.defaultBehavior === "explain"
          ? "Default: explain concepts"
          : "Default: practice with me",
  })

  return facts.filter((f) => !prefs.clearedMemoryIds.includes(f.id))
}

export function buildTutorPreferencesPrompt(
  prefs: CoraTutorPreferences | null | undefined,
  opts?: { domain?: string | null; hasCode?: boolean },
): string {
  if (!prefs) return ""

  const lines: string[] = ["", "TUTOR PEDAGOGY (honor these; stay context-aware):"]

  const behavior =
    prefs.defaultBehavior === "guide"
      ? "Default stance: GUIDE — ask questions, give hints, do not dump full answers unless asked."
      : prefs.defaultBehavior === "explain"
        ? "Default stance: EXPLAIN — clear teaching first; then invite practice."
        : "Default stance: PRACTICE — put a short attempt or check before long lectures."
  lines.push(`- ${behavior}`)

  const formats = prefs.explanationFormats
  if (formats.length) {
    const map: Record<CoraExplanationFormat, string> = {
      visual: "prefer diagrams, flows, annotated examples when helpful",
      worked_examples: "prefer worked examples",
      conceptual: "prefer intuition and plain language",
      practice_first: "prefer a short attempt before full explanation",
    }
    lines.push(`- Preferred formats (multi): ${formats.map((f) => map[f]).join("; ")}`)
  }

  const depth =
    prefs.explanationLevel === "quick"
      ? "Depth: QUICK — key idea first; expand only if asked."
      : prefs.explanationLevel === "deep"
        ? "Depth: DEEP — thorough explanation with supporting detail."
        : "Depth: GUIDED — enough to understand, then check."
  lines.push(`- ${depth}`)

  const tech =
    prefs.technicalLevel === "introductory"
      ? "Technical level: Introductory"
      : prefs.technicalLevel === "advanced"
        ? "Technical level: Advanced"
        : "Technical level: Intermediate"
  lines.push(`- ${tech}`)

  const t = prefs.teaching
  const teachingBits: string[] = []
  if (t.stepByStep) teachingBits.push("step-by-step when complexity warrants it")
  if (t.visualExplanations) teachingBits.push("visual explanations when they clarify (not filler)")
  if (t.realWorldExamples) teachingBits.push("real-world analogies when they help")
  if (t.checkUnderstanding) teachingBits.push("briefly check understanding")
  if (t.showFormulas) teachingBits.push("show formulas/equations when the subject needs them")
  if (t.codeWhenRelevant) {
    teachingBits.push(
      opts?.hasCode || opts?.domain === "coding"
        ? "include code examples (coding context)"
        : "include code examples ONLY when coding-relevant",
    )
  }
  if (t.hintsBeforeSolutions) {
    teachingBits.push("give hints before full solutions — teach, do not just answer homework")
  }
  if (teachingBits.length) lines.push(`- Teaching prefs: ${teachingBits.join("; ")}`)

  const m = prefs.memory
  if (m["remember-gaps"]) lines.push("- Memory: track and reference recurring gaps")
  if (m["detect-confusion"]) lines.push("- Memory: detect confusion and simplify/adapt")
  if (m["remember-strengths"]) lines.push("- Memory: avoid over-explaining mastered strengths")
  if (m["use-course-progress"]) lines.push("- Memory: use course lectures/practice/performance context")
  if (m["remember-preferences"]) lines.push("- Memory: keep these pedagogy prefs across the session")

  lines.push(
    "- Context rule: never force diagrams, code, or equations into unrelated subjects; apply prefs only when relevant.",
  )

  return lines.join("\n")
}
