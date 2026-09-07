/**
 * Assessment Section Utilities
 *
 * Groups questions into sections (e.g., Section I: MCQ/Select All, Section II: Code Write)
 * and supports configurable section weights for scoring.
 */

export type SectionTimerMode = "per_question" | "section_timer"

/** all = every question in the section counts (default); student_pick = only student-selected questions count */
export type SectionScoringMode = "all" | "student_pick"

export interface SectionQuestionTimers {
  mcq?: number
  true_false?: number
  select_all?: number
  [key: string]: number | undefined
}

export interface SectionConfig {
  title: string
  question_types: string[]
  weight_percent: number
  /** Optional: when set with question_order_end, sections are assigned by position (1-based question_order) */
  question_order_start?: number
  /** Optional: when set with question_order_start, sections are assigned by position (1-based question_order) */
  question_order_end?: number
  /** per_question = anti-cheat objective mode; section_timer = pooled time for circuit / multi-part */
  timer_mode?: SectionTimerMode
  /** Total seconds for section_timer sections (default 1800 = 30 min) */
  total_time_seconds?: number
  /**
   * When set on the first section, the entire assessment uses one pooled countdown
   * (seconds) shared across all section_timer sections — no per-question timers.
   */
  exam_shared_timer_seconds?: number
  /** Per-type limits when timer_mode is per_question */
  timers?: SectionQuestionTimers
  /** When false, students cannot navigate to earlier questions in this section */
  allow_backtracking?: boolean
  /** When true, expired timers auto-submit locked answers */
  auto_submit_on_expire?: boolean
  /**
   * When section_scoring_mode is student_pick, how many questions the student selects for grading.
   * Section score uses only those questions (e.g. 8/8 not 8/20).
   */
  questions_required?: number
  /** Default all — existing assessments unchanged when omitted */
  section_scoring_mode?: SectionScoringMode
}

export interface QuestionSection {
  sectionIndex: number
  title: string
  weightPercent: number
  startIndex: number
  endIndex: number
  questionIndices: number[]
}

/** Default section config when none is provided */
export const DEFAULT_SECTION_CONFIG: SectionConfig[] = [
  {
    title: "Section I",
    question_types: ["mcq", "true_false", "select_all", "fill_blank", "multiple_choice"],
    weight_percent: 20,
  },
  {
    title: "Section II",
    question_types: ["code_write", "code_problem", "debug_code", "code_debug", "code_explain"],
    weight_percent: 40,
  },
  {
    title: "Section III",
    question_types: ["code_write_plot"],
    weight_percent: 40,
  },
]

/** Final exam template: Section I 20%, II 40%, III 40% (matches Spring 2026 finals / mock weighting) */
export const DEFAULT_FINAL_SECTION_CONFIG: SectionConfig[] = [
  {
    title: "Section I",
    question_types: [
      "mcq",
      "true_false",
      "select_all",
      "fill_blank",
      "multiple_choice",
      "code_output",
      "trace_output",
    ],
    weight_percent: 20,
  },
  {
    title: "Section II",
    question_types: ["code_write", "code_problem", "debug_code", "code_debug", "code_explain"],
    weight_percent: 40,
  },
  {
    title: "Section III",
    question_types: ["code_write_plot", "code_write"],
    weight_percent: 40,
  },
]

/**
 * Parsed `quizzes.section_config` from DB (jsonb array or legacy JSON string).
 * Returns null when unset or empty — treat as unsectionized (flat list) for shuffling.
 */
export function parseAssessmentSectionConfig(
  raw: SectionConfig[] | string | null | undefined
): SectionConfig[] | null {
  if (raw == null) return null
  if (Array.isArray(raw)) {
    return raw.length > 0 ? raw : null
  }
  if (typeof raw === "string") {
    const t = raw.trim()
    if (!t || t === "[]") return null
    try {
      const p = JSON.parse(t) as unknown
      if (!Array.isArray(p) || p.length === 0) return null
      return p as SectionConfig[]
    } catch {
      return null
    }
  }
  return null
}

/** Question types allowed in a “MATLAB / external tools” position band (tabs, copy/paste, screenshots). */
const EXTERNAL_TOOLS_SECTION_TYPES = new Set(["code_write", "code_write_plot"])

/**
 * When section_config uses question_order bands and a band only lists MATLAB-style
 * types (`code_write`, `code_write_plot`), students need relaxed anti-cheat for that band.
 */
export function isQuestionOrderInExternalToolsPositionSection(
  questionOrder1Based: number,
  sectionConfig: SectionConfig[] | null | undefined,
): boolean {
  const cfg = parseAssessmentSectionConfig(sectionConfig)
  if (!cfg?.length) return false
  const positionBased = cfg.some(
    (c) => c.question_order_start != null && c.question_order_end != null,
  )
  if (!positionBased) return false
  for (const c of cfg) {
    const start = c.question_order_start
    const end = c.question_order_end
    if (start == null || end == null) continue
    if (questionOrder1Based < start || questionOrder1Based > end) continue
    const types = (c.question_types || []).map((t) => t.toLowerCase().trim())
    if (types.length === 0) return false
    return types.every((t) => EXTERNAL_TOOLS_SECTION_TYPES.has(t))
  }
  return false
}

/**
 * Multi-section layout (navigator groups + section headers) when section_config is set.
 * Homework and quiz use sections only when the instructor configured them (non-empty config).
 * Mid-semester and final exams always use sections when this helper is called with their type.
 * Flat list when section_config is absent (avoids DEFAULT_SECTION_CONFIG inventing sections).
 */
export function shouldUseAssessmentQuestionSections(
  assessmentType: string,
  sectionConfig?: SectionConfig[] | string | null,
): boolean {
  const t = (assessmentType || "").toLowerCase().trim()
  if (t === "homework" || t === "quiz") {
    return parseAssessmentSectionConfig(sectionConfig) != null
  }
  return (
    t === "mid_semester" ||
    t === "midsem" ||
    t === "final" ||
    t === "finals" ||
    t === "final_exam"
  )
}

/**
 * Normalize question type for section matching (case-insensitive)
 */
function normalizeQuestionType(type: string): string {
  return (type || "mcq").toLowerCase().trim()
}

/**
 * Determine which section a question type belongs to
 */
function getSectionIndexForQuestionType(
  questionType: string,
  config: SectionConfig[]
): number {
  const normalized = normalizeQuestionType(questionType)
  for (let i = 0; i < config.length; i++) {
    const types = config[i].question_types.map((t) => t.toLowerCase())
    if (types.includes(normalized)) return i
  }
  return 0
}

/**
 * Group questions into sections based on question_type or position (question_order).
 * When config has question_order_start/end, uses position-based assignment.
 * Returns sections with start/end indices for UI display.
 */
function resolveQuestionOrder1Based<T extends { question_order?: number }>(
  question: T,
  arrayIndex: number,
): number {
  const order = question.question_order
  return typeof order === "number" && order > 0 ? order : arrayIndex + 1
}

/** Short label for navigator (e.g. "Section I: Chapter 2 — …" → "Section I"). */
export function shortSectionNavigatorTitle(title: string): string {
  const t = (title || "").trim()
  if (!t) return "Section"
  const beforeColon = t.split(":")[0]?.trim()
  return beforeColon && beforeColon.length <= 32 ? beforeColon : t.slice(0, 28) + (t.length > 28 ? "…" : "")
}

export function groupQuestionsBySections<
  T extends { question_type?: string; question_order?: number },
>(
  questions: T[],
  sectionConfig?: SectionConfig[] | null
): QuestionSection[] {
  const parsed = parseAssessmentSectionConfig(sectionConfig)
  const config = parsed && parsed.length > 0 ? parsed : DEFAULT_SECTION_CONFIG

  const usePositionBased = config.some(
    (c) =>
      c.question_order_start != null &&
      c.question_order_end != null
  )

  const sections: QuestionSection[] = []
  const sectionMap = new Map<number, { indices: number[] }>()

  const sortedConfig = usePositionBased
    ? [...config]
        .filter((c) => c.question_order_start != null && c.question_order_end != null)
        .sort((a, b) => (a.question_order_start ?? 0) - (b.question_order_start ?? 0))
    : []

  const configForSection = usePositionBased && sortedConfig.length > 0 ? sortedConfig : config

  if (usePositionBased && sortedConfig.length > 0) {
    questions.forEach((q, idx) => {
      const questionOrder = resolveQuestionOrder1Based(q, idx)
      const sectionIdx = sortedConfig.findIndex(
        (c) =>
          questionOrder >= (c.question_order_start ?? 0) &&
          questionOrder <= (c.question_order_end ?? 0)
      )
      // Out-of-band rows (e.g. spare circuit problems at order 900+) must not default to
      // section 0 — that applies Section I timer/backtracking rules to Section II content.
      const resolvedIdx =
        sectionIdx >= 0
          ? sectionIdx
          : getSectionIndexForQuestionType(q.question_type || "mcq", configForSection)
      if (!sectionMap.has(resolvedIdx)) {
        sectionMap.set(resolvedIdx, { indices: [] })
      }
      sectionMap.get(resolvedIdx)!.indices.push(idx)
    })
  } else {
    questions.forEach((q, idx) => {
      const sectionIdx = getSectionIndexForQuestionType(q.question_type || "mcq", config)
      if (!sectionMap.has(sectionIdx)) {
        sectionMap.set(sectionIdx, { indices: [] })
      }
      sectionMap.get(sectionIdx)!.indices.push(idx)
    })
  }

  const sortedSectionIndices = Array.from(sectionMap.keys()).sort((a, b) => a - b)
  for (const sectionIdx of sortedSectionIndices) {
    const { indices } = sectionMap.get(sectionIdx)!
    const cfg = configForSection[sectionIdx] || config[0]
    sections.push({
      sectionIndex: sectionIdx,
      title: cfg.title,
      weightPercent: cfg.weight_percent,
      startIndex: indices[0]!,
      endIndex: indices[indices.length - 1]!,
      questionIndices: indices,
    })
  }

  return sections
}

/**
 * Get the section for a given question index
 */
export function getSectionForQuestionIndex(
  questionIndex: number,
  sections: QuestionSection[]
): QuestionSection | null {
  return sections.find(
    (s) => questionIndex >= s.startIndex && questionIndex <= s.endIndex
  ) || null
}

/**
 * Seeded random number generator (mulberry32) for deterministic shuffle.
 * Same seed produces same sequence.
 */
function seededRandom(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Fisher-Yates shuffle with seeded random. Mutates array in place.
 */
function shuffleArray<T>(arr: T[], random: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
}

/**
 * Shuffle questions for each attempt (seeded so resume keeps the same order).
 * - When the instructor set **section_config** (non-empty): Fisher–Yates **within each section** only;
 *   section order stays as configured.
 * - When **section_config** is missing, `[]`, or invalid: one global shuffle over all questions
 *   (typical quizzes/homework; fixes a prior behavior where DEFAULT_SECTION_CONFIG split by type
 *   and only shuffled within type buckets).
 */
export function shuffleQuestionsWithinSections<T extends { question_type?: string }>(
  questions: T[],
  sectionConfig: SectionConfig[] | string | null | undefined,
  seed: number
): T[] {
  if (questions.length === 0) return questions
  const random = seededRandom(seed)

  const normalized = parseAssessmentSectionConfig(sectionConfig)
  if (!normalized) {
    const copy = [...questions]
    shuffleArray(copy, random)
    return copy
  }

  const sections = groupQuestionsBySections(questions, normalized)
  if (sections.length === 0) {
    const copy = [...questions]
    shuffleArray(copy, random)
    return copy
  }

  const result: T[] = []
  for (const section of sections) {
    const sectionQuestions = section.questionIndices.map((i) => questions[i]!)
    shuffleArray(sectionQuestions, random)
    result.push(...sectionQuestions)
  }
  return result
}

/**
 * Calculate weighted score when section config is used.
 * Formula: SUM( (section_earned / section_max) * section_weight )
 * Each section contributes its weight. Sections with no questions contribute 0.
 */
export function calculateWeightedScore(
  sectionScores: Array<{ earned: number; max: number; weightPercent: number }>
): number {
  let total = 0
  for (const { earned, max, weightPercent } of sectionScores) {
    if (max > 0) {
      const cappedEarned = Math.min(Math.max(0, earned), max)
      total += (cappedEarned / max) * weightPercent
    }
  }
  return Math.min(100, Math.round(total * 100) / 100)
}

/**
 * When true, scores use {@link calculateWeightedScore}: each section contributes
 * `(earned / sectionMax) * weightPercent` and weights sum to 100%.
 * Raw `max_points` across all questions do **not** need to total 100 — the reported
 * score is already on a 0–100 scale.
 */
export function assessmentUsesSectionWeightedGrade(
  assessmentType: string,
  sectionConfig: SectionConfig[] | string | null | undefined,
): boolean {
  const t = (assessmentType || "").toLowerCase().trim()
  const sectionized =
    t === "mid_semester" ||
    t === "midsem" ||
    t === "final" ||
    t === "finals" ||
    t === "final_exam" ||
    t === "homework" ||
    t === "quiz"
  if (!sectionized) return false
  const parsed = parseAssessmentSectionConfig(sectionConfig)
  if (!parsed || parsed.length === 0) return false
  const totalWeight = parsed.reduce((s, x) => s + (Number(x.weight_percent) || 0), 0)
  return Math.abs(totalWeight - 100) < 0.01
}
