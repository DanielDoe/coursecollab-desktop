/**
 * Generic multi-part questions: one shared stem/media, sub-parts (MCQ, select_all, …) graded independently.
 */

import {
  scoreSelectAllQuestion,
} from "@/lib/select-all-scoring"
import { repairLatexDamagedByJsonEscapes } from "@/lib/math-markdown"

function repairOptionText(text: string): string {
  return repairLatexDamagedByJsonEscapes(text)
}

export type MultiPartSubOption = { id: string; text: string }

export type MultiPartSolutionUpload = {
  url: string
  name: string
  mime: string
  uploaded_at?: string
}

export type MultiPartSubQuestion = {
  id: string
  type: "mcq" | "select_all" | string
  points?: number
  prompt: string
  options: MultiPartSubOption[] | string[]
  correct_answer?: string
  correct_answers?: string[]
  explanation?: string
  /** Method reminder shown in guided sequential mode (e.g. "Rewrite sine as cosine first."). */
  step_hint?: string
  allow_solution_upload?: boolean
  solution_bonus_percent?: number
  solution_upload?: { enabled?: boolean; bonus_percent?: number }
}

export type MultiPartStudentAnswer = {
  version: 1
  parts: Record<string, string | string[]>
  solution_uploads?: Record<string, MultiPartSolutionUpload>
  /** Part ids verified correct in guided sequential mode. */
  guided_verified?: string[]
}

const LETTERS = ["A", "B", "C", "D", "E", "F"] as const

/** MCQ / select_all parts only — excludes pseudo file_upload rows. */
export function getGradableSubquestions(raw: unknown): MultiPartSubQuestion[] {
  return parseSubquestions(raw).filter((sq) => {
    const t = sq.type.toLowerCase()
    return t !== "file_upload" && t !== "solution_upload"
  })
}

export function parseSubquestions(raw: unknown): MultiPartSubQuestion[] {
  if (raw == null || raw === "") return []
  let arr: unknown = raw
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(arr)) return []
  return arr
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const o = item as Record<string, unknown>
      const id = String(o.id ?? "").trim()
      const prompt = repairLatexDamagedByJsonEscapes(String(o.prompt ?? "").trim())
      if (!id || !prompt) return null
      let options: MultiPartSubOption[] = []
      if (Array.isArray(o.options)) {
        options = o.options.map((opt, idx) => {
          if (typeof opt === "string") {
            return { id: LETTERS[idx] ?? String(idx + 1), text: repairOptionText(opt) }
          }
          if (opt && typeof opt === "object") {
            const oo = opt as Record<string, unknown>
            return {
              id: String(oo.id ?? LETTERS[idx] ?? idx + 1).trim(),
              text: repairOptionText(String(oo.text ?? oo.option_text ?? "").trim()),
            }
          }
          return { id: LETTERS[idx] ?? String(idx + 1), text: repairOptionText(String(opt)) }
        })
      } else if (o.options && typeof o.options === "object") {
        const rec = o.options as Record<string, unknown>
        options = Object.keys(rec)
          .sort()
          .map((key) => ({
            id: key.trim().toUpperCase(),
            text: repairOptionText(String(rec[key] ?? "").trim()),
          }))
      }
      return {
        id,
        type: String(o.type ?? "mcq").toLowerCase(),
        points: typeof o.points === "number" ? o.points : Number(o.points) || 1,
        prompt,
        options,
        correct_answer:
          typeof o.correct_answer === "string" ? o.correct_answer.trim() : undefined,
        correct_answers: Array.isArray(o.correct_answers)
          ? o.correct_answers.map((x) => String(x).trim())
          : undefined,
        explanation: typeof o.explanation === "string" ? o.explanation : undefined,
        step_hint:
          typeof o.step_hint === "string" && o.step_hint.trim() ? o.step_hint.trim() : undefined,
        allow_solution_upload: o.allow_solution_upload === true,
        solution_bonus_percent:
          typeof o.solution_bonus_percent === "number" ? o.solution_bonus_percent : undefined,
        solution_upload:
          o.solution_upload && typeof o.solution_upload === "object"
            ? (o.solution_upload as MultiPartSubQuestion["solution_upload"])
            : undefined,
      } satisfies MultiPartSubQuestion
    })
    .filter((x): x is MultiPartSubQuestion => x != null)
}

export function emptyMultiPartAnswer(subquestions: MultiPartSubQuestion[]): MultiPartStudentAnswer {
  const parts: Record<string, string | string[]> = {}
  for (const sq of subquestions) {
    parts[sq.id] = sq.type === "select_all" ? [] : ""
  }
  return { version: 1, parts }
}

function mergeSolutionUploads(
  ...maps: Array<Record<string, MultiPartSolutionUpload> | undefined>
): Record<string, MultiPartSolutionUpload> | undefined {
  const merged: Record<string, MultiPartSolutionUpload> = {}
  for (const map of maps) {
    if (!map) continue
    for (const [key, val] of Object.entries(map)) {
      if (val?.url?.trim()) merged[key] = val
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined
}

export function parseMultiPartStudentAnswer(
  raw: unknown,
  subquestions: MultiPartSubQuestion[],
): MultiPartStudentAnswer {
  const base = emptyMultiPartAnswer(subquestions)
  if (raw == null || raw === "") return base
  try {
    const parsed =
      typeof raw === "string" ? (JSON.parse(raw) as Record<string, unknown>) : (raw as Record<string, unknown>)
    if (parsed?.version === 1 && parsed.parts && typeof parsed.parts === "object") {
      const uploads =
        parsed.solution_uploads && typeof parsed.solution_uploads === "object"
          ? (parsed.solution_uploads as Record<string, MultiPartSolutionUpload>)
          : undefined
      const guidedVerified = Array.isArray(parsed.guided_verified)
        ? parsed.guided_verified.map(String).filter(Boolean)
        : undefined
      return {
        version: 1,
        parts: { ...base.parts, ...(parsed.parts as Record<string, string | string[]>) },
        ...(uploads && Object.keys(uploads).length > 0 ? { solution_uploads: uploads } : {}),
        ...(guidedVerified && guidedVerified.length > 0 ? { guided_verified: guidedVerified } : {}),
      }
    }
    if (typeof parsed === "object" && !parsed.parts) {
      return { version: 1, parts: { ...base.parts, ...(parsed as Record<string, string | string[]>) } }
    }
  } catch {
    /* ignore */
  }
  return base
}

/** Merge selected_answer + answer_data so solution uploads survive API normalization. */
export function resolveMultiPartStudentAnswerForDisplay(
  selectedAnswer: unknown,
  answerData: unknown,
  subquestions: MultiPartSubQuestion[],
): MultiPartStudentAnswer {
  const fromSelected = parseMultiPartStudentAnswer(selectedAnswer, subquestions)
  const extraUploads: Array<Record<string, MultiPartSolutionUpload> | undefined> = [
    fromSelected.solution_uploads,
  ]

  let ad: Record<string, unknown> | null = null
  if (answerData != null) {
    if (typeof answerData === "string") {
      try {
        ad = JSON.parse(answerData) as Record<string, unknown>
      } catch {
        ad = null
      }
    } else if (typeof answerData === "object") {
      ad = answerData as Record<string, unknown>
    }
  }

  let fromAnswerData = fromSelected
  if (ad) {
    if (ad.parts || ad.version === 1 || ad.solution_uploads) {
      fromAnswerData = parseMultiPartStudentAnswer(ad, subquestions)
      extraUploads.push(fromAnswerData.solution_uploads)
    }
    if (ad.solution_uploads && typeof ad.solution_uploads === "object") {
      extraUploads.push(ad.solution_uploads as Record<string, MultiPartSolutionUpload>)
    }
    if (ad.answer != null) {
      const fromNested = parseMultiPartStudentAnswer(ad.answer, subquestions)
      extraUploads.push(fromNested.solution_uploads)
      const hasNestedParts = Object.values(fromNested.parts).some((v) =>
        Array.isArray(v) ? v.length > 0 : String(v ?? "").trim() !== "",
      )
      if (hasNestedParts) {
        fromAnswerData = {
          version: 1,
          parts: { ...fromSelected.parts, ...fromNested.parts },
          solution_uploads: mergeSolutionUploads(...extraUploads),
        }
      }
    }
  }

  const uploads = mergeSolutionUploads(...extraUploads)
  return {
    version: 1,
    parts: { ...fromAnswerData.parts, ...fromSelected.parts },
    ...(uploads ? { solution_uploads: uploads } : {}),
  }
}

export function gradeSubPart(
  sq: MultiPartSubQuestion,
  submitted: string | string[] | undefined,
): { fraction: number; isFullyCorrect: boolean } {
  const type = sq.type.toLowerCase()
  if (type === "select_all") {
    const correct = (sq.correct_answers ?? []).map((x) => x.toUpperCase())
    const sub = Array.isArray(submitted)
      ? submitted.map((x) => String(x).trim().toUpperCase())
      : []
    const scored = scoreSelectAllQuestion(sub, correct, 1)
    return { fraction: scored.fraction, isFullyCorrect: scored.isFullyCorrect }
  }
  const correct = (sq.correct_answer ?? "").toUpperCase()
  const sub = String(submitted ?? "")
    .trim()
    .toUpperCase()
  const ok = correct.length > 0 && sub === correct
  return { fraction: ok ? 1 : 0, isFullyCorrect: ok }
}

export function evaluateMultiPartQuestion(
  question: { subquestions?: unknown },
  studentAnswer: unknown,
): {
  isCorrect: boolean
  points: number
  feedback: string | null
} {
  const subs = getGradableSubquestions(question.subquestions)
  if (subs.length === 0) {
    return { isCorrect: false, points: 0, feedback: "Multi-part question has no sub-questions configured." }
  }

  const parsed = parseMultiPartStudentAnswer(studentAnswer, subs)
  let earned = 0
  let total = 0
  let allFull = true

  for (const sq of subs) {
    const weight = sq.points && sq.points > 0 ? sq.points : 1
    total += weight
    const { fraction, isFullyCorrect } = gradeSubPart(sq, parsed.parts[sq.id])
    earned += weight * fraction
    if (!isFullyCorrect) allFull = false
  }

  const points = total > 0 ? Math.round((earned / total) * 10000) / 100 : 0
  return {
    isCorrect: allFull && earned >= total - 1e-9,
    points,
    feedback: null,
  }
}

export function subquestionOptionLabels(sq: MultiPartSubQuestion): { letter: string; text: string }[] {
  return sq.options.map((opt, i) => {
    if (typeof opt === "string") {
      return { letter: LETTERS[i] ?? String(i + 1), text: opt }
    }
    return { letter: opt.id || LETTERS[i] || String(i + 1), text: opt.text }
  })
}

/** Form state for instructor sub-question editor */
export type EditableSubPartOption = {
  letter: string
  text: string
  isCorrect: boolean
}

export type EditableSubPart = {
  id: string
  type: "mcq" | "select_all"
  points: number
  prompt: string
  options: EditableSubPartOption[]
  explanation: string
  allow_solution_upload: boolean
  solution_bonus_percent: number
}

export function subquestionsToEditable(raw: unknown): EditableSubPart[] {
  return parseSubquestions(raw).map((sq) => {
    const labels = subquestionOptionLabels(sq)
    const correctSet = new Set(
      sq.type === "select_all"
        ? (sq.correct_answers ?? []).map((x) => x.toUpperCase())
        : sq.correct_answer
          ? [sq.correct_answer.toUpperCase()]
          : [],
    )
    return {
      id: sq.id,
      type: sq.type === "select_all" ? "select_all" : "mcq",
      points: sq.points && sq.points > 0 ? sq.points : 1,
      prompt: sq.prompt,
      options: labels.map(({ letter, text }) => ({
        letter,
        text,
        isCorrect: correctSet.has(letter.toUpperCase()),
      })),
      explanation: sq.explanation ?? "",
      allow_solution_upload: sq.allow_solution_upload === true || sq.solution_upload?.enabled === true,
      solution_bonus_percent:
        sq.solution_bonus_percent ?? sq.solution_upload?.bonus_percent ?? 10,
    }
  })
}

export function editableSubquestionsToPayload(parts: EditableSubPart[]): MultiPartSubQuestion[] {
  return parts.map((part) => {
    const filled = part.options.filter((o) => o.text.trim())
    const options = filled.map((o) => ({ id: o.letter.toUpperCase(), text: o.text.trim() }))
    const base = {
      id: part.id.trim(),
      type: part.type,
      points: part.points > 0 ? part.points : 1,
      prompt: part.prompt.trim(),
      options,
      explanation: part.explanation.trim() || undefined,
      ...(part.allow_solution_upload
        ? {
            allow_solution_upload: true,
            solution_bonus_percent: part.solution_bonus_percent,
          }
        : {}),
    }
    if (part.type === "select_all") {
      return {
        ...base,
        correct_answers: filled.filter((o) => o.isCorrect).map((o) => o.letter.toUpperCase()),
      }
    }
    const correct = filled.find((o) => o.isCorrect)
    return { ...base, correct_answer: correct?.letter.toUpperCase() ?? "A" }
  })
}

export function validateEditableSubquestions(parts: EditableSubPart[]): string | null {
  if (parts.length === 0) return "Add at least one sub-question."
  for (const part of parts) {
    if (!part.id.trim()) return "Each sub-question needs a part label (e.g. a, b)."
    if (!part.prompt.trim()) return `Part ${part.id}: prompt is required.`
    const filled = part.options.filter((o) => o.text.trim())
    if (filled.length < 2) return `Part ${part.id}: at least two answer choices are required.`
    const correct = filled.filter((o) => o.isCorrect)
    if (correct.length === 0) return `Part ${part.id}: mark at least one correct answer.`
    if (part.type === "mcq" && correct.length > 1) return `Part ${part.id}: only one correct answer for multiple choice.`
  }
  return null
}

export function defaultEditableSubPart(id: string): EditableSubPart {
  return {
    id,
    type: "mcq",
    points: 1,
    prompt: "",
    options: [
      { letter: "A", text: "", isCorrect: false },
      { letter: "B", text: "", isCorrect: false },
      { letter: "C", text: "", isCorrect: false },
      { letter: "D", text: "", isCorrect: false },
    ],
    explanation: "",
    allow_solution_upload: false,
    solution_bonus_percent: 10,
  }
}
