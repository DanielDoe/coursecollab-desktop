/**
 * Engineering / Circuits II question family — metadata and circuit_spec JSON shape.
 */

export const CIRCUIT_QUESTION_TYPES = [
  "circuit_numeric",
  "circuit_worked_solution",
  /** @deprecated Prefer MCQ/numeric/etc. with optional `question_media` diagram attachment */
  "circuit_diagram_analysis",
  "circuit_multi_part",
  "circuit_fill_equation",
  "circuit_transfer_function",
  "circuit_phasor_power",
  "circuit_transient_response",
  "circuit_upload_work",
  "circuit_submission",
] as const

export type CircuitQuestionTypeSlug = (typeof CIRCUIT_QUESTION_TYPES)[number]

export interface GivenValueRow {
  label: string
  symbol?: string
  value?: string
  unit?: string
}

export interface CircuitSubQuestionSpec {
  id: string
  label?: string
  /** numeric: tol match; equation_slot: match fills[slotId]; open: needs AI/manual */
  gradeMode?: "numeric" | "equation_slot" | "open"
  expectedAnswer?: string
  expectedUnit?: string
  acceptedUnits?: string[]
  tolerance?: number
  equationSlot?: string
  prompt?: string
  /** Weight within multi-part question (defaults to equal split) */
  weight?: number
}

export interface CircuitQuestionSpec {
  circuitDiagramUrl?: string | null
  circuitDiagramAltText?: string | null
  givenValues?: GivenValueRow[]
  expectedAnswer?: string | null
  expectedUnit?: string | null
  acceptedUnits?: string[] | null
  /** Absolute tolerance for numeric compare (ignored if absent — then exact-ish match on rounded values) */
  tolerance?: number | null
  solutionRubric?: string | null
  sampleSolution?: string | null
  allowWorkUpload?: boolean
  requireFinalAnswer?: boolean
  requireUnits?: boolean
  subQuestions?: CircuitSubQuestionSpec[]
  /** Keys = slot ids; student fills in `fills` on submission */
  equationExpected?: Record<string, string>
}

export const CIRCUIT_MANUAL_UPLOAD_TYPES = ["circuit_upload_work", "circuit_submission"] as const

export function isCircuitManualUploadType(questionType: string | null | undefined): boolean {
  if (!questionType) return false
  return (CIRCUIT_MANUAL_UPLOAD_TYPES as readonly string[]).includes(questionType.toLowerCase())
}

export function isCircuitQuestionType(questionType: string | null | undefined): boolean {
  if (!questionType) return false
  const t = questionType.toLowerCase()
  return (CIRCUIT_QUESTION_TYPES as readonly string[]).includes(t)
}

export function defaultCircuitQuestionSpec(): CircuitQuestionSpec {
  return {
    givenValues: [],
    acceptedUnits: [],
    tolerance: null,
    allowWorkUpload: false,
    requireFinalAnswer: true,
    requireUnits: false,
    subQuestions: [],
    equationExpected: {},
  }
}

export function parseCircuitSpec(raw: unknown): CircuitQuestionSpec {
  const base = defaultCircuitQuestionSpec()
  if (raw == null || raw === "") return base
  try {
    const obj =
      typeof raw === "string"
        ? (JSON.parse(raw) as Record<string, unknown>)
        : (raw as Record<string, unknown>)
    if (!obj || typeof obj !== "object") return base
    return {
      ...base,
      ...obj,
      givenValues: Array.isArray(obj.givenValues)
        ? (obj.givenValues as GivenValueRow[])
        : base.givenValues,
      acceptedUnits: Array.isArray(obj.acceptedUnits)
        ? (obj.acceptedUnits as string[])
        : obj.acceptedUnits == null
          ? base.acceptedUnits
          : [],
      subQuestions: Array.isArray(obj.subQuestions)
        ? (obj.subQuestions as CircuitSubQuestionSpec[])
        : base.subQuestions,
      equationExpected:
        obj.equationExpected && typeof obj.equationExpected === "object"
          ? (obj.equationExpected as Record<string, string>)
          : {},
    }
  } catch {
    return base
  }
}
