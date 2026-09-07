import type { CircuitQuestionSpec, CircuitSubQuestionSpec } from "@/lib/engineering-circuit-types"
import type { VerificationResult } from "@/lib/local-answer-verification"

export interface ParsedCircuitStudentAnswer {
  version?: number
  finalAnswer?: string
  unit?: string
  steps?: string
  uploadName?: string
  uploadMime?: string
  uploadDataUrl?: string
  fills?: Record<string, string>
  parts?: Record<string, { finalAnswer?: string; unit?: string; steps?: string }>
}

export function parseCircuitStudentAnswer(studentAnswer: unknown): ParsedCircuitStudentAnswer {
  if (studentAnswer == null) return {}
  if (typeof studentAnswer === "object" && !Array.isArray(studentAnswer)) {
    return studentAnswer as ParsedCircuitStudentAnswer
  }
  const s = String(studentAnswer).trim()
  if (!s) return {}
  try {
    return JSON.parse(s) as ParsedCircuitStudentAnswer
  } catch {
    return { finalAnswer: s }
  }
}

function normalizeWhitespace(s: string): string {
  return s.trim().replace(/\s+/g, "")
}

export function normalizeUnit(u: string | undefined): string {
  return normalizeWhitespace(String(u ?? "").toLowerCase().replace(/μ/g, "u"))
}

function stripUnitVariants(u: string): string {
  return u.replace(/\s/g, "").replace(/°/g, "deg").replace(/omega/g, "Ω")
}

export function acceptedUnitMatches(
  studentUnit: string,
  expectedUnit: string | undefined,
  accepted: string[] | null | undefined,
): boolean {
  const su = stripUnitVariants(normalizeUnit(studentUnit))
  if (!su) return false
  const exp = stripUnitVariants(normalizeUnit(expectedUnit ?? ""))
  const list = [...(accepted || []).map((x) => stripUnitVariants(normalizeUnit(x)))]
  if (exp && (su === exp || list.includes(su))) return true
  if (exp && su === exp) return true
  if (list.some((x) => x && (su === x || su.includes(x) || x.includes(su)))) return true
  return false
}

function parseNumericLoose(raw: string | undefined): number | null {
  if (raw == null) return null
  const cleaned = String(raw)
    .replace(/,/g, "")
    .replace(/[^\d.-eEjJ+]/gi, "") // strip units mistakenly pasted in number field
    .replace(/^[jJ]|i$/i, "")
  const m = cleaned.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/i)
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) ? n : null
}

export function numericMatch(expectedStr: string, studentStr: string, tolerance?: number | null): boolean {
  const a = parseNumericLoose(studentStr)
  const b = parseNumericLoose(expectedStr)
  if (a == null || b == null) {
    const sn = normalizeWhitespace(String(studentStr).toLowerCase())
    const en = normalizeWhitespace(String(expectedStr).toLowerCase())
    return sn.length > 0 && sn === en
  }
  const tol =
    tolerance != null && Number.isFinite(Number(tolerance))
      ? Math.abs(Number(tolerance))
      : Math.max(1e-6 * Math.abs(b), 1e-9)
  return Math.abs(a - b) <= tol + 1e-12 * Math.abs(b)
}

/** circuit_numeric */
export function verifyCircuitNumeric(
  studentAnswer: unknown,
  spec: CircuitQuestionSpec,
): VerificationResult {
  const p = parseCircuitStudentAnswer(studentAnswer)
  const expFinal = String(spec.expectedAnswer ?? "").trim()
  if (!expFinal) {
    return {
      isCorrect: false,
      score: 0,
      feedback: "Instructor must set expectedAnswer on this circuit question.",
      requiresAI: true,
    }
  }
  const studentFinal = String(p.finalAnswer ?? "").trim()
  if ((spec.requireFinalAnswer !== false) && !studentFinal) {
    return {
      isCorrect: false,
      score: 0,
      feedback: "Enter your final numerical answer.",
      requiresAI: false,
    }
  }
  const numericOk =
    parseNumericLoose(studentFinal) != null && parseNumericLoose(expFinal) != null
      ? numericMatch(expFinal, studentFinal, spec.tolerance)
      : normalizeWhitespace(studentFinal.toLowerCase()) === normalizeWhitespace(expFinal.toLowerCase())
  const numOk = !!expFinal && numericOk
  let unitOk = true
  if (spec.requireUnits && (spec.expectedUnit || (spec.acceptedUnits && spec.acceptedUnits.length))) {
    unitOk = acceptedUnitMatches(p.unit ?? "", spec.expectedUnit ?? "", spec.acceptedUnits)
    if (!(p.unit ?? "").trim()) {
      unitOk = false
    }
  }
  const isCorrect = numOk && unitOk
  return {
    isCorrect,
    score: isCorrect ? 100 : numOk ? 55 : 0,
    feedback: isCorrect
      ? "✅ Correct value (within tolerance)."
      : !numOk
        ? `❌ Value out of tolerance. Expected ≈ ${expFinal}.`
        : "⚠️ Check your units.",
    requiresAI: false,
  }
}

/** circuit_fill_equation — keyed slots in equationExpected */
export function verifyCircuitFillEquation(
  studentAnswer: unknown,
  spec: CircuitQuestionSpec,
): VerificationResult {
  const p = parseCircuitStudentAnswer(studentAnswer)
  const expected = spec.equationExpected ?? {}
  const keys = Object.keys(expected)
  if (keys.length === 0) {
    return {
      isCorrect: false,
      score: 0,
      feedback: "Instructor must configure equation slots (equationExpected).",
      requiresAI: true,
    }
  }
  let correct = 0
  const fills = p.fills ?? {}
  for (const k of keys) {
    const want = normalizeWhitespace(String(expected[k] ?? "").toLowerCase())
    const got = normalizeWhitespace(String(fills[k] ?? "").toLowerCase())
    if (want && got && (got === want || got.includes(want) || want.includes(got))) correct++
    else if (want && numericMatch(want, got, spec.tolerance)) correct++
  }
  const pct = keys.length ? (correct / keys.length) * 100 : 0
  const isCorrect = pct >= 99.9
  return {
    isCorrect,
    score: Math.round(pct),
    feedback: isCorrect ? "✅ All equation slots matched." : `Equation slots score: ${Math.round(pct)}%.`,
    requiresAI: false,
  }
}

function subWeight(sq: CircuitSubQuestionSpec[], i: number): number {
  const w = sq[i]?.weight
  if (typeof w === "number" && Number.isFinite(w) && w > 0) return w
  return 1
}

/** circuit_multi_part — all numeric-gradeable parts verified locally; any `open` defers to AI */
export function verifyCircuitMultiPart(
  studentAnswer: unknown,
  spec: CircuitQuestionSpec,
): VerificationResult {
  const subs = spec.subQuestions ?? []
  if (!subs.length) {
    return {
      isCorrect: false,
      score: 0,
      feedback: "Add subQuestions in circuit_spec for multi-part items.",
      requiresAI: true,
    }
  }
  const pAns = parseCircuitStudentAnswer(studentAnswer)
  const parts = pAns.parts ?? {}
  const topFills = pAns.fills ?? {}
  let needsAi = false
  let scoreNum = 0
  let weightSum = 0
  const notes: string[] = []

  for (let i = 0; i < subs.length; i++) {
    const s = subs[i]
    const w = subWeight(subs, i)
    weightSum += w
    const mode = (s.gradeMode || "numeric").toLowerCase()
    const pane = parts[s.id] || {}
    if (mode === "open") {
      needsAi = true
      notes.push(`${s.label || s.id}: open-ended (needs review/AI)`)
      continue
    }
    if (mode === "equation_slot" && s.equationSlot && spec.equationExpected) {
      const want = spec.equationExpected[s.equationSlot]
      const gotRaw = pane.finalAnswer ?? topFills[s.equationSlot] ?? ""
      const got = String(gotRaw ?? "").trim()
      const wantN = normalizeWhitespace(String(want ?? "").toLowerCase())
      const gotN = normalizeWhitespace(got.toLowerCase())
      const ok = Boolean(wantN && gotN && (gotN === wantN || numericMatch(wantN, gotN, s.tolerance ?? spec.tolerance)))
      scoreNum += ok ? w : 0
      notes.push(`${s.label || s.id}: ${ok ? "ok" : "mismatch"}`)
      continue
    }
    /* numeric sub-part */
    const exp = String(s.expectedAnswer ?? "").trim()
    const st = String(pane.finalAnswer ?? "").trim()
    const numOk = exp ? numericMatch(exp, st, s.tolerance ?? spec.tolerance) : false
    let unitOk = true
    if (spec.requireUnits || (s.expectedUnit ?? "").length || (s.acceptedUnits ?? [])?.length) {
      unitOk =
        !!(pane.unit ?? "").trim() &&
        acceptedUnitMatches(
          pane.unit ?? "",
          (s.expectedUnit ?? spec.expectedUnit) ?? undefined,
          s.acceptedUnits ?? spec.acceptedUnits ?? undefined,
        )
    }
    const ok = numOk && unitOk
    scoreNum += ok ? w : 0
    notes.push(`${s.label || s.id}: ${ok ? "ok" : "check value/units"}`)
  }

  if (needsAi) {
    return {
      isCorrect: false,
      score: weightSum ? Math.round((scoreNum / weightSum) * 100) : 0,
      feedback: `${notes.join(" · ")} — open-ended parts require additional grading.`,
      requiresAI: true,
    }
  }

  const score = weightSum ? Math.round((scoreNum / weightSum) * 100) : 0
  return {
    isCorrect: score >= 99,
    score,
    feedback:
      score >= 99
        ? "✅ All parts correct."
        : `Partial score ${score}% — ${notes.join(" · ")}`,
    requiresAI: false,
  }
}
