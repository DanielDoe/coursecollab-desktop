/**
 * Student worked-solution uploads: config, answer payload, and grading bonus.
 */

import {
  parseMultiPartStudentAnswer,
  parseSubquestions,
  getGradableSubquestions,
} from "@/lib/multi-part-question"
import {
  SOLUTION_UPLOAD_PART_KEY,
  usesStandardMultiPartGradingPolicy,
} from "@/lib/multi-part-grading-policy"

export interface SolutionUploadAttachment {
  url: string
  name: string
  mime: string
  uploaded_at?: string
}

export type MultiPartGradingPolicyConfig = {
  part_count?: number
  points_per_mcq_part?: number
  upload_points_multiplier?: number
  mcq_total_points?: number
  upload_total_points?: number
  total_points?: number
  normalize_mcq_scores?: boolean
  require_solution_upload?: boolean
  manual_grading_required?: boolean
  /** Unlock sub-parts one at a time after each step is answered correctly. */
  guided_sequential?: boolean
  guided_require_correct?: boolean
  /** Method checklist shown above guided steps. */
  method_summary?: string
}

export interface QuestionSolutionUploadConfig {
  enabled?: boolean
  /** Extra % of question max points when a file is attached (default 10). */
  bonus_percent?: number
  label?: string
  /** When set, auto-graded selection caps at this many points (multi-part homework). */
  selection_max_points?: number
  /** When set, uploaded work earns up to this many points pending instructor/AI review. */
  solution_max_points?: number
  /** Upload pool = multiplier × MCQ part count (course default 2). */
  upload_points_multiplier?: number
  /** Block submit until each attempted sub-part with upload enabled has a file attached. */
  require_solution_upload?: boolean
  /** When true, upload points require instructor rubric grading (standard engineering policy). */
  manual_grading_required?: boolean
  /** Unlock sub-parts sequentially (guided workflow). */
  guided_sequential?: boolean
  guided_require_correct?: boolean
  method_summary?: string
  grading_policy?: MultiPartGradingPolicyConfig
}

export interface SubquestionSolutionUploadConfig {
  enabled?: boolean
  bonus_percent?: number
}

export type SolutionUploadPartKey = string

export type SolutionUploadsMap = Record<SolutionUploadPartKey, SolutionUploadAttachment>

/** Wrapped single-question answer when uploads are used */
export type WrappedQuestionAnswer = {
  answer?: string | string[]
  solution_uploads?: SolutionUploadsMap
}

export const DEFAULT_SOLUTION_BONUS_PERCENT = 10
export const ROOT_SOLUTION_PART_KEY = "_"

export function parseQuestionSolutionUploadConfig(raw: unknown): QuestionSolutionUploadConfig {
  const base: QuestionSolutionUploadConfig = { enabled: false, bonus_percent: DEFAULT_SOLUTION_BONUS_PERCENT }
  if (raw == null || raw === "") return base
  try {
    const obj =
      typeof raw === "string" ? (JSON.parse(raw) as Record<string, unknown>) : (raw as Record<string, unknown>)
    if (!obj || typeof obj !== "object") return base
    const pct = Number(obj.bonus_percent)
    const sel = Number(obj.selection_max_points)
    const sol = Number(obj.solution_max_points)
    const uploadMult = Number(obj.upload_points_multiplier)
    const gp =
      obj.grading_policy && typeof obj.grading_policy === "object"
        ? (obj.grading_policy as MultiPartGradingPolicyConfig)
        : undefined
    return {
      enabled: obj.enabled === true,
      bonus_percent:
        Number.isFinite(pct) && pct >= 0 && pct <= 50 ? pct : DEFAULT_SOLUTION_BONUS_PERCENT,
      label: typeof obj.label === "string" && obj.label.trim() ? obj.label.trim() : undefined,
      selection_max_points: Number.isFinite(sel) && sel > 0 ? sel : undefined,
      solution_max_points: Number.isFinite(sol) && sol > 0 ? sol : undefined,
      upload_points_multiplier: Number.isFinite(uploadMult) && uploadMult > 0 ? uploadMult : undefined,
      require_solution_upload: obj.require_solution_upload === true,
      manual_grading_required: obj.manual_grading_required === true,
      guided_sequential: obj.guided_sequential === true || gp?.guided_sequential === true,
      guided_require_correct:
        obj.guided_require_correct !== false && gp?.guided_require_correct !== false,
      method_summary:
        typeof obj.method_summary === "string" && obj.method_summary.trim()
          ? obj.method_summary.trim()
          : typeof gp?.method_summary === "string" && gp.method_summary.trim()
            ? gp.method_summary.trim()
            : undefined,
      grading_policy: gp,
    }
  } catch {
    return base
  }
}

export function subquestionAllowsSolutionUpload(sq: {
  allow_solution_upload?: boolean
  solution_upload?: SubquestionSolutionUploadConfig
}): boolean {
  if (sq.allow_solution_upload === true) return true
  return sq.solution_upload?.enabled === true
}

export function subquestionBonusPercent(sq: {
  solution_upload?: SubquestionSolutionUploadConfig
  solution_bonus_percent?: number
}): number {
  const fromNested = sq.solution_upload?.bonus_percent
  if (typeof fromNested === "number" && Number.isFinite(fromNested)) {
    return Math.min(50, Math.max(0, fromNested))
  }
  if (typeof sq.solution_bonus_percent === "number" && Number.isFinite(sq.solution_bonus_percent)) {
    return Math.min(50, Math.max(0, sq.solution_bonus_percent))
  }
  return DEFAULT_SOLUTION_BONUS_PERCENT
}

export function unwrapStudentAnswerForGrading(
  studentAnswer: unknown,
  questionType?: string,
): { gradable: unknown; solutionUploads: SolutionUploadsMap } {
  if (studentAnswer == null || studentAnswer === "") {
    return { gradable: studentAnswer, solutionUploads: {} }
  }

  let parsed: unknown = studentAnswer
  if (typeof studentAnswer === "string") {
    const t = studentAnswer.trim()
    if (!t.startsWith("{")) {
      return { gradable: studentAnswer, solutionUploads: {} }
    }
    try {
      parsed = JSON.parse(t)
    } catch {
      return { gradable: studentAnswer, solutionUploads: {} }
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return { gradable: studentAnswer, solutionUploads: {} }
  }

  const o = parsed as Record<string, unknown>
  const uploads = parseSolutionUploadsMap(o.solution_uploads)

  if (o.version === 1 && o.parts && typeof o.parts === "object") {
    return { gradable: parsed, solutionUploads: uploads }
  }

  if ("parts" in o && "version" in o) {
    return { gradable: parsed, solutionUploads: uploads }
  }

  if ("answer" in o) {
    return { gradable: o.answer, solutionUploads: uploads }
  }

  const qt = (questionType || "").toLowerCase()
  if (qt === "multi_part") {
    return { gradable: parsed, solutionUploads: uploads }
  }

  return { gradable: studentAnswer, solutionUploads: uploads }
}

export function parseSolutionUploadsMap(raw: unknown): SolutionUploadsMap {
  if (!raw || typeof raw !== "object") return {}
  const out: SolutionUploadsMap = {}
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== "object") continue
    const v = val as Record<string, unknown>
    const url = typeof v.url === "string" ? v.url.trim() : ""
    if (!url) continue
    out[key] = {
      url,
      name: typeof v.name === "string" ? v.name : "attachment",
      mime: typeof v.mime === "string" ? v.mime : "application/octet-stream",
      uploaded_at: typeof v.uploaded_at === "string" ? v.uploaded_at : undefined,
    }
  }
  return out
}

/** Keys like `solution_upload`, `solution_upload_2`, `solution_upload_3` for multiple pages. */
export function isSolutionUploadKeyForPart(key: string, partKey: string): boolean {
  if (key === partKey) return true
  const suffix = key.slice(partKey.length)
  return suffix.startsWith("_") && /^\d+$/.test(suffix.slice(1))
}

export function getSolutionUploadAttachmentsForPart(
  uploads: SolutionUploadsMap | undefined,
  partKey: string,
): SolutionUploadAttachment[] {
  if (!uploads) return []
  return Object.entries(uploads)
    .filter(([k, v]) => isSolutionUploadKeyForPart(k, partKey) && v?.url?.trim())
    .sort(([keyA], [keyB]) => {
      if (keyA === partKey) return -1
      if (keyB === partKey) return 1
      const idx = (k: string) => {
        if (k === partKey) return 1
        const m = k.match(/_(\d+)$/)
        return m ? parseInt(m[1], 10) : 1
      }
      return idx(keyA) - idx(keyB)
    })
    .map(([, v]) => v)
}

export function nextSolutionUploadSlotKey(uploads: SolutionUploadsMap, partKey: string): string {
  const count = getSolutionUploadAttachmentsForPart(uploads, partKey).length
  if (count === 0) return partKey
  return `${partKey}_${count + 1}`
}

export function setSolutionUploadAttachmentsForPart(
  uploads: SolutionUploadsMap,
  partKey: string,
  attachments: SolutionUploadAttachment[],
): SolutionUploadsMap {
  const next = { ...uploads }
  for (const key of Object.keys(next)) {
    if (isSolutionUploadKeyForPart(key, partKey)) delete next[key]
  }
  attachments.forEach((att, index) => {
    const key = index === 0 ? partKey : `${partKey}_${index + 1}`
    next[key] = att
  })
  return next
}

export function hasSolutionUploadForPart(uploads: SolutionUploadsMap | undefined, partKey: string): boolean {
  return getSolutionUploadAttachmentsForPart(uploads, partKey).length > 0
}

export function questionSolutionUploadEnabled(question: {
  solution_upload_config?: unknown
  question_type?: string
}): boolean {
  return parseQuestionSolutionUploadConfig(question.solution_upload_config).enabled === true
}

/**
 * Add bonus points (capped at maxPoints) when student attached worked solutions.
 */
export function computeSolutionUploadBonusEarned(
  question: {
    question_type?: string
    solution_upload_config?: unknown
    subquestions?: unknown
    max_points?: number
    points?: number
  },
  studentAnswer: unknown,
  maxPoints: number,
  basePointsEarned: number,
): { bonusEarned: number; requiresReview: boolean; uploads: SolutionUploadsMap } {
  const max = Math.max(0, maxPoints)
  const base = Math.max(0, basePointsEarned)
  const { gradable, solutionUploads } = unwrapStudentAnswerForGrading(
    studentAnswer,
    question.question_type,
  )
  const uploads = solutionUploads
  if (Object.keys(uploads).length === 0) {
    return { bonusEarned: 0, requiresReview: false, uploads }
  }

  const qt = (question.question_type || "").toLowerCase()
  let bonus = 0

  if (qt === "multi_part") {
    const cfg = parseQuestionSolutionUploadConfig(question.solution_upload_config)
    if (usesStandardMultiPartGradingPolicy(question.solution_upload_config, question.question_type)) {
      const hasUpload = hasSolutionUploadForPart(uploads, SOLUTION_UPLOAD_PART_KEY)
      return {
        bonusEarned: 0,
        requiresReview: hasUpload && cfg.manual_grading_required !== false,
        uploads,
      }
    }
    const subs = getGradableSubquestions(question.subquestions)
    const parsed = parseMultiPartStudentAnswer(gradable, subs)
    let totalWeight = 0
    for (const sq of subs) totalWeight += sq.points && sq.points > 0 ? sq.points : 1
    if (totalWeight <= 0) totalWeight = subs.length || 1

    const solutionMax =
      cfg.solution_max_points != null && cfg.solution_max_points > 0
        ? cfg.solution_max_points
        : null

    let uploadEligible = 0
    let uploadPresent = 0

    for (const sq of subs) {
      if (!subquestionAllowsSolutionUpload(sq)) continue
      const partAnswer = parsed.parts[sq.id]
      const attempted =
        sq.type === "select_all"
          ? Array.isArray(partAnswer) && partAnswer.length > 0
          : String(partAnswer ?? "").trim().length > 0
      if (!attempted) continue
      uploadEligible++
      if (!hasSolutionUploadForPart(uploads, sq.id)) continue
      uploadPresent++
      if (solutionMax == null) {
        const weight = sq.points && sq.points > 0 ? sq.points : 1
        const pct = subquestionBonusPercent(sq)
        bonus += (weight / totalWeight) * max * (pct / 100)
      }
    }

    if (solutionMax != null && uploadPresent > 0 && uploadEligible > 0) {
      bonus += (uploadPresent / uploadEligible) * solutionMax
    }
  } else {
    const cfg = parseQuestionSolutionUploadConfig(question.solution_upload_config)
    if (cfg.enabled && hasSolutionUploadForPart(uploads, ROOT_SOLUTION_PART_KEY)) {
      const gradableStr =
        typeof gradable === "string"
          ? gradable.trim()
          : Array.isArray(gradable)
            ? gradable.join(",")
            : gradable != null
              ? JSON.stringify(gradable)
              : ""
      if (gradableStr.length > 0) {
        const pct = cfg.bonus_percent ?? DEFAULT_SOLUTION_BONUS_PERCENT
        bonus += max * (pct / 100)
      }
    }
  }

  bonus = Math.round(bonus * 100) / 100
  const capped = Math.min(max, base + bonus)
  bonus = Math.max(0, capped - base)

  return {
    bonusEarned: bonus,
    requiresReview: bonus > 0,
    uploads,
  }
}

/** Multi-part item that offers optional worked-solution upload (standard engineering homework). */
export function multiPartOffersSolutionUpload(question: {
  question_type?: string
  solution_upload_config?: unknown
  subquestions?: unknown
}): boolean {
  if ((question.question_type || "").toLowerCase() !== "multi_part") return false
  if (usesStandardMultiPartGradingPolicy(question.solution_upload_config, "multi_part")) {
    return true
  }
  const cfg = parseQuestionSolutionUploadConfig(question.solution_upload_config)
  if (cfg.enabled) return true
  return getGradableSubquestions(question.subquestions).some((sq) => subquestionAllowsSolutionUpload(sq))
}

/** When true, submit is blocked until uploads are attached (legacy / explicit instructor setting). */
export function multiPartRequiresSolutionUpload(question: {
  question_type?: string
  solution_upload_config?: unknown
}): boolean {
  if ((question.question_type || "").toLowerCase() !== "multi_part") return false
  const cfg = parseQuestionSolutionUploadConfig(question.solution_upload_config)
  if (cfg.require_solution_upload) return true
  const gp = cfg.grading_policy
  return gp?.require_solution_upload === true
}

/** @deprecated Prefer {@link multiPartOffersSolutionUpload} — name kept for existing imports. */
export function questionRequiresMultiPartSolutionUpload(question: {
  question_type?: string
  solution_upload_config?: unknown
  subquestions?: unknown
}): boolean {
  return multiPartOffersSolutionUpload(question)
}

function listMissingMultiPartSolutionUploadParts(
  subquestionsRaw: unknown,
  studentAnswer: unknown,
  configRaw: unknown,
): string[] {
  if (usesStandardMultiPartGradingPolicy(configRaw, "multi_part")) {
    const { gradable, solutionUploads } = unwrapStudentAnswerForGrading(studentAnswer, "multi_part")
    const parsed = parseMultiPartStudentAnswer(gradable, getGradableSubquestions(subquestionsRaw))
    const uploads =
      Object.keys(solutionUploads).length > 0
        ? solutionUploads
        : (parsed.solution_uploads ?? {})
    if (!hasSolutionUploadForPart(uploads, SOLUTION_UPLOAD_PART_KEY)) {
      return [SOLUTION_UPLOAD_PART_KEY]
    }
    return []
  }
  const subs = getGradableSubquestions(subquestionsRaw)
  const { gradable, solutionUploads } = unwrapStudentAnswerForGrading(studentAnswer, "multi_part")
  const parsed = parseMultiPartStudentAnswer(gradable, subs)
  const uploads = Object.keys(solutionUploads).length > 0 ? solutionUploads : parsed.solution_uploads ?? {}
  const missing: string[] = []
  for (const sq of subs) {
    if (!subquestionAllowsSolutionUpload(sq)) continue
    const partAnswer = parsed.parts[sq.id]
    const attempted =
      sq.type === "select_all"
        ? Array.isArray(partAnswer) && partAnswer.length > 0
        : String(partAnswer ?? "").trim().length > 0
    if (!attempted) continue
    if (!hasSolutionUploadForPart(uploads, sq.id)) missing.push(sq.id)
  }
  return missing
}

/** True when the student answer JSON includes at least one worked-solution attachment. */
export function multiPartStudentAnswerHasUpload(
  studentAnswer: unknown,
  configRaw: unknown,
): boolean {
  if (
    !multiPartOffersSolutionUpload({
      question_type: "multi_part",
      solution_upload_config: configRaw,
    })
  ) {
    return false
  }
  const { solutionUploads } = unwrapStudentAnswerForGrading(studentAnswer, "multi_part")
  return hasSolutionUploadForPart(solutionUploads, SOLUTION_UPLOAD_PART_KEY)
}

/** Missing upload slots when solution upload is offered but not yet attached. */
export function multiPartMissingOptionalSolutionUpload(
  subquestionsRaw: unknown,
  studentAnswer: unknown,
  configRaw: unknown,
): string[] {
  const offers = multiPartOffersSolutionUpload({
    question_type: "multi_part",
    solution_upload_config: configRaw,
    subquestions: subquestionsRaw,
  })
  if (!offers) return []
  return listMissingMultiPartSolutionUploadParts(subquestionsRaw, studentAnswer, configRaw)
}

/** Parts that need a worked-solution upload before submit (only when explicitly required). */
export function multiPartMissingSolutionUploads(
  subquestionsRaw: unknown,
  studentAnswer: unknown,
  configRaw: unknown,
): string[] {
  const cfg = parseQuestionSolutionUploadConfig(configRaw)
  const gp = cfg.grading_policy
  const required = cfg.require_solution_upload === true || gp?.require_solution_upload === true
  if (!required) return []
  return listMissingMultiPartSolutionUploadParts(subquestionsRaw, studentAnswer, configRaw)
}

export function solutionUploadConfigToJsonString(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw === "string") {
    const t = raw.trim()
    if (!t) return null
    try {
      JSON.parse(t)
      return t
    } catch {
      return null
    }
  }
  try {
    return JSON.stringify(raw)
  } catch {
    return null
  }
}
