import { isCodeAnswerCorrupt } from "@/lib/code-answer-validation"
import { isLikelyUnmodifiedStarterCode } from "@/lib/code-template-detection"
import { isKnownInitialTemplate } from "@/lib/typing-replay"

/** Empty answer or only built-in starter / boilerplate — not substantive work for PND / review. */
function isNonSubstantiveCodeSubmission(code: string | null | undefined): boolean {
  const raw = String(code ?? "").trim()
  if (raw.length === 0) return true
  return isKnownInitialTemplate(raw) || isLikelyUnmodifiedStarterCode(raw)
}

const CODE_QT = [
  "code_write",
  "code_problem",
  "debug_code",
  "code_explain",
  "code_write_plot",
  "code_debug",
] as const

/**
 * Longest non-corrupt code candidate from saved answer (same idea as bulk re-evaluate).
 * Used to detect unmodified Trailblazer / legacy editor templates — not "student-written" for PND.
 */
function extractPrimaryCodeString(q: {
  question_type?: string
  answer_data?: unknown
  selected_answer?: unknown
  code?: string | null
}): string | null {
  const qt = (q.question_type || "").toLowerCase()
  if (!CODE_QT.some((t) => qt.includes(t))) return null
  const candidates: string[] = []
  if (q.selected_answer != null && String(q.selected_answer).trim()) {
    candidates.push(String(q.selected_answer))
  }
  if (q.answer_data) {
    try {
      const ad = typeof q.answer_data === "string" ? JSON.parse(q.answer_data) : q.answer_data
      if (ad?.code && typeof ad.code === "string" && ad.code.trim()) {
        candidates.push(ad.code)
      }
    } catch {
      /* ignore */
    }
  }
  const codeOrSel = (q.code ?? q.selected_answer) ?? ""
  if (typeof codeOrSel === "string" && codeOrSel.trim() && codeOrSel.trim() !== "[object Object]") {
    candidates.push(codeOrSel)
  }
  const valid = candidates.filter((c) => !isCodeAnswerCorrupt(c))
  if (valid.length === 0) return null
  return valid.reduce((a, b) => (a.length >= b.length ? a : b))
}

/**
 * True when the student actually submitted something worth reviewing (non-empty answer).
 * Empty / skipped questions return false — zero points are justified, no PND / no review queue.
 * Unmodified default editor templates (Trailblazer C++, MATLAB defaults, legacy hello-world) count as no substantive work.
 */
export function hasStudentAnswerContent(q: {
  question_type?: string
  answer_data?: unknown
  selected_answer?: unknown
  code?: string | null
}): boolean {
  const qt = (q.question_type || "").toLowerCase()
  const isCode = CODE_QT.some((t) => qt.includes(t))

  if (isCode) {
    const primaryCode = extractPrimaryCodeString(q)
    if (primaryCode && isNonSubstantiveCodeSubmission(primaryCode)) {
      return false
    }

    if (q.answer_data) {
      try {
        const ad = typeof q.answer_data === "string" ? JSON.parse(q.answer_data) : q.answer_data
        // Typing replay alone must not count as "content" if final code is still the default template
        // (otherwise PND% / flagged stays on for Q3/Q6-style template submissions).
        if (ad?.typing_replay?.events?.length) {
          const finalCode =
            typeof ad?.code === "string" && ad.code.trim() ? ad.code : primaryCode ?? ""
          if (isNonSubstantiveCodeSubmission(finalCode)) return false
          return true
        }
        if (ad?.code && typeof ad.code === "string" && ad.code.trim() && !isCodeAnswerCorrupt(ad.code)) {
          if (isNonSubstantiveCodeSubmission(ad.code)) return false
          return true
        }
      } catch {
        /* ignore */
      }
    }
    const codeOrSel = (q.code ?? q.selected_answer) ?? ""
    if (typeof codeOrSel === "object" && codeOrSel !== null) return false
    const s = typeof codeOrSel === "string" ? codeOrSel : String(codeOrSel)
    if (s.trim() === "[object Object]" || !s.trim()) {
      if (q.answer_data) {
        try {
          const ad = typeof q.answer_data === "string" ? JSON.parse(q.answer_data) : q.answer_data
          if (ad?.code && typeof ad.code === "string" && ad.code.trim() && !isCodeAnswerCorrupt(ad.code)) {
            if (isNonSubstantiveCodeSubmission(ad.code)) return false
            return true
          }
        } catch {
          /* ignore */
        }
      }
      return false
    }
    if (s.trim() && !isCodeAnswerCorrupt(s)) {
      if (isNonSubstantiveCodeSubmission(s)) return false
      return true
    }
    return false
  }

  if (q.selected_answer != null && String(q.selected_answer).trim() !== "") return true
  if (q.answer_data) {
    try {
      const ad = typeof q.answer_data === "string" ? JSON.parse(q.answer_data) : q.answer_data
      const raw = ad?.answer ?? ad?.selectedAnswer ?? ad?.selectedOptions ?? ad?.value
      if (raw != null) {
        const str = typeof raw === "string" ? raw : JSON.stringify(raw)
        if (str.trim() && str !== "[]" && str !== "null" && str !== "{}") return true
      }
    } catch {
      /* ignore */
    }
  }
  return false
}

/** Code question with real student content but 0 points → evaluation may have failed (PND candidate) */
export function hasCodeDataButZeroPoints(q: {
  question_type?: string
  points_earned?: number | null
  override_points?: number | null
  answer_data?: unknown
  selected_answer?: unknown
  code?: string | null
}): boolean {
  const qt = (q.question_type || "").toLowerCase()
  if (!CODE_QT.some((t) => qt.includes(t))) return false
  // Instructor override (any value) = resolved for that question — not “stuck at 0 pts” for PND.
  if (q.override_points != null && q.override_points !== undefined) return false
  if (Number(q.points_earned ?? 0) > 0) return false
  return hasStudentAnswerContent(q)
}
