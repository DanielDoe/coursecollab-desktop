/** Helpers for instructor question bank preview (options + correct answer display). */

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const

export function normalizeBankOptions(raw: unknown): string[] {
  if (raw == null || raw === "") return []
  let arr: unknown = raw
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw)
    } catch {
      return [raw.trim()].filter(Boolean)
    }
  }
  if (!Array.isArray(arr)) return []
  return arr
    .map((opt) => {
      if (typeof opt === "string") return opt.trim()
      if (opt && typeof opt === "object") {
        const o = opt as Record<string, unknown>
        return String(o.text ?? o.option_text ?? o.label ?? "").trim()
      }
      return String(opt).trim()
    })
    .filter((t) => t.length > 0)
}

function parseCorrectAnswerRaw(raw: unknown): string | string[] | null {
  if (raw == null || raw === "") return null
  if (Array.isArray(raw)) return raw.map((x) => String(x))
  if (typeof raw === "string") {
    const t = raw.trim()
    try {
      const p = JSON.parse(t)
      if (typeof p === "string") return p.trim()
      if (Array.isArray(p)) return p.map((x) => String(x))
    } catch {
      return t
    }
    return t
  }
  return String(raw)
}

export function isBankOptionCorrect(
  optionIndex: number,
  correctAnswer: unknown,
  options: string[],
): boolean {
  const letter = OPTION_LETTERS[optionIndex] ?? String(optionIndex + 1)
  return isQuizMcqOptionCorrect(letter, options[optionIndex] ?? "", correctAnswer)
}

/** Quiz / bank UI: correct when stored answer is a letter or matching option text. */
export function isQuizMcqOptionCorrect(
  optionLetter: string,
  optionText: string,
  correctAnswer: unknown,
): boolean {
  const parsed = parseCorrectAnswerRaw(correctAnswer)
  if (parsed == null) return false

  const letter = optionLetter.trim().toUpperCase()
  const text = optionText.trim()

  if (Array.isArray(parsed)) {
    return parsed.some((ans) => {
      const a = ans.trim()
      const upper = a.toUpperCase()
      return upper === letter || a === text
    })
  }

  const upper = parsed.trim().toUpperCase()
  if (/^[A-F]$/.test(upper)) return upper === letter
  return parsed.trim() === text
}

export function optionLetter(index: number): string {
  return OPTION_LETTERS[index] ?? `${index + 1}`
}

/** Map stored bank `options` + `correct_answer` into edit-form rows. */
export function bankQuestionOptionsToEditable(
  rawOptions: unknown,
  correctAnswer: unknown,
): Array<{ option_text: string; is_correct: boolean; option_order: number }> {
  const texts = normalizeBankOptions(rawOptions)
  return texts.map((option_text, index) => ({
    option_text,
    is_correct: isBankOptionCorrect(index, correctAnswer, texts),
    option_order: index + 1,
  }))
}

export function formatQuestionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    true_false: "True / False",
    mcq: "Multiple Choice",
    select_all: "Select All That Apply",
    fill_blank: "Fill in the Blank",
    code_problem: "Code Problem",
    code_write: "Code Write",
    code_explain: "Code Explain",
    code_output: "Code Output",
    code_debug: "Code Debug",
    fill_code: "Fill in Code",
    trace_output: "Trace Output",
    trace_logic: "Trace Logic",
    scenario_match: "Scenario Match",
    circuit_numeric: "Circuit Numeric",
    circuit_worked_solution: "Circuit Worked Solution",
    circuit_diagram_analysis: "Circuit Diagram Analysis",
    circuit_upload_work: "Upload Written Work",
    circuit_submission: "Circuit Submission",
    multi_part: "Multi-Part",
  }
  const key = type?.toLowerCase() ?? ""
  return labels[key] ?? type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}
