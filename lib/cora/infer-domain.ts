import type { CoraDomain, CoraProblemContext } from "@/lib/cora/types"

const CODING_TYPES = new Set([
  "code_write",
  "code_write_plot",
  "code_output",
  "code_problem",
  "debug_code",
  "code_explain",
  "fill_code",
  "trace_output",
  "trace_logic",
])

const CIRCUIT_TYPES = new Set([
  "circuit_numeric",
  "circuit_worked_solution",
  "circuit_diagram_analysis",
  "circuit_multi_part",
  "circuit_fill_equation",
  "circuit_transfer_function",
  "circuit_phasor_power",
  "circuit_transient_response",
  "circuit_submission",
  "circuit_upload_work",
  "multi_part",
])

export function inferCoraDomain(input: {
  questionType?: string | null
  questionText?: string | null
  source?: CoraProblemContext["source"]
  courseCode?: string | null
}): CoraDomain {
  const type = String(input.questionType ?? "").toLowerCase()
  if (CODING_TYPES.has(type)) return "coding"
  if (CIRCUIT_TYPES.has(type)) return "circuit"

  const text = `${input.questionText ?? ""} ${input.courseCode ?? ""}`.toLowerCase()
  if (/\b(circuit|impedance|phasor|kirchhoff|thevenin|norton|mesh|nodal|voltage|current|ω|ohm)\b/.test(text)) {
    return "circuit"
  }
  if (/\b(c\+\+|python|java|compile|function|algorithm|loop|array|pointer|code|program)\b/.test(text)) {
    return "coding"
  }
  if (/\b(integral|derivative|matrix|equation|solve for|latex|\$\\)\b/.test(text)) {
    return "math"
  }
  if (input.source === "codebench") return "coding"
  if (input.source === "lecture_workspace") return "circuit"
  return "generic"
}
