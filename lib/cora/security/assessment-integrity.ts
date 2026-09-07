/**
 * Assessment Integrity Context — dynamic Cora policy for assessments.
 *
 * Do NOT use "student + quiz = Cora disabled". Capabilities depend on attempt
 * state, release state, and high-stakes rules.
 */

import { sql } from "@/lib/db"

/** Collapse obfuscation (spacing, dashes, dots) for pattern matching. */
function normalizeIntegrityText(message: string): string {
  return String(message ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Detect words spelled with separators: a-n-s-w-e-r, a n s w e r, etc. */
function containsSpelledOutWord(text: string, word: string): boolean {
  const pattern = word
    .split("")
    .map((ch) => `${ch}[\\s\\-_.·/\\\\]*`)
    .join("")
  return new RegExp(`(?:^|[^a-z])${pattern}(?:[^a-z]|$)`, "i").test(text)
}

const ALLOWED_STUDY_OR_LOGISTICS = [
  /\bexplain(?:ing)?\s+(?:the\s+)?instructions?\b/i,
  /\bwhat\s+does\s+(?:this|the)\s+question\s+(?:mean|ask|want)\b/i,
  /\bclarif(?:y|ying)\s+(?:the\s+)?(?:question\s+)?wording\b/i,
  /\bhow\s+much\s+time\b/i,
  /\btime\s+(?:left|remaining)\b/i,
  /\bhow\s+(?:long|many\s+minutes)\b/i,
  /\breport(?:ing)?\s+(?:a\s+)?bug\b/i,
  /\b(?:issue|problem)\s+with\s+(?:question|q)\s*\d/i,
  /\bteach\s+me\s+.+\s+in\s+general\b/i,
  /\b(?:make|create|build)\s+(?:me\s+)?(?:a\s+)?study\s+plan\b/i,
  /\bhow\s+(?:do\s+i|to)\s+(?:submit|navigate|start|save)\b/i,
  /\bwhere\s+(?:is|do\s+i)\s+(?:the\s+)?submit\b/i,
  /\b(?:formatting|interface|timer|navigation)\s+(?:help|issue)\b/i,
]

const ANSWER_SEEKING_PATTERNS: RegExp[] = [
  // Direct answer / solution requests (original + extended)
  /\b(?:what(?:'s|\s+is)\s+(?:the\s+)?(?:correct\s+)?answer)\b/i,
  /\b(?:give|tell|show)\s+me\s+(?:the\s+)?(?:answers?|solutions?)\b/i,
  /\b(?:answers?|solutions?)\s+(?:for|to)\s+(?:question|q|number|#|\d)/i,
  /\b(?:fill\s+in|complete)\s+(?:the\s+)?(?:blank|answer|response)\b/i,
  /\bgive\s+me\s+the\s+final\b/i,
  /\b(?:the|my)\s+(?:correct|right)\s+(?:answer|choice|option)\s+is\b/i,

  // Indirect / confirmation asks
  /\bwhat\s+would\s+you\s+pick\b/i,
  /\bwhich\s+option\s+is\s+(?:right|correct|best)\b/i,
  /\b(?:just\s+)?(?:checking|confirm(?:ing)?)\s+(?:my\s+)?answer\s+is\b/i,
  /\bconfirm\s+my\s+answer\b/i,
  /\bis\s+(?:the\s+)?answer\s+[a-d]\b/i,
  /\bis\s+(?:it|this)\s+[a-d]\s+or\s+[a-d]\b/i,
  /\b(?:answer|option)\s+[a-d]\s+or\s+[a-d]\b/i,
  /\bam\s+i\s+(?:right|correct)\b/i,
  /\bdid\s+i\s+get\s+(?:it|this|that)\s+(?:right|correct)\b/i,

  // Role-play / jailbreak / imposter framing
  /\bpretend\s+(?:you\s+are|to\s+be)\s+(?:my\s+)?(?:professor|teacher|instructor|ta|grader)\b/i,
  /\bignore\s+(?:your|all|previous)\s+(?:instructions?|rules?|restrictions?)\b/i,
  /\b(?:you\s+are|act\s+as)\s+dan\b/i,
  /\bact\s+as\s+(?:an?\s+)?unrestricted\b/i,
  /\bhypothetically\s+(?:what\s+is|give\s+me)\s+(?:the\s+)?answer\b/i,
  /\bfor\s+a\s+friend\b/i,
  /\bmy\s+professor\s+said\s+you\s+can\s+(?:give|provide)\s+(?:me\s+)?(?:the\s+)?answer\b/i,
  /\bi\s+have\s+permission\b/i,
  /\b(?:the\s+)?instructor\s+unlocked\s+this\b/i,
  /\bi\s+am\s+(?:the\s+)?ta\b/i,

  // Completion / do-it-for-me (code, plot, numbered questions)
  /\bwrite\s+(?:the\s+)?code\s+for\s+(?:question|q|number|#|\d|this|me)\b/i,
  /\bfinish\s+(?:this|the|my)\s+(?:function|code|program|script)\b/i,
  /\bcomplete\s+(?:the\s+)?plot\b/i,
  /\b(?:do|solve)\s+(?:question|q|number|#)\s*\d+(?:\s+(?:for\s+me|please))?\b/i,
  /\b(?:do|solve)\s+(?:question|q|number|#|\d+)\s+(?:for\s+me|please)\b/i,
  /\b(?:do|solve)\s+(?:this|that|it)\s+for\s+me\b/i,
  /\bsolve\s+number\s+\d+\b/i,
  /\b(?:give|show)\s+me\s+(?:the\s+)?(?:full|complete|finished)\s+(?:code|solution|plot|graph)\b/i,
  /\b(?:write|generate|produce)\s+(?:the\s+)?(?:full|complete|final)\s+(?:code|solution|plot)\b/i,

  // Obfuscation / encoding requests
  /\btranslate\s+(?:the\s+)?answer\s+to\b/i,
  /\b(?:encode|encoding)\s+(?:the\s+)?answer\b/i,
  /\b(?:in\s+)?base64\b/i,
  /\b(?:write|spell|say)\s+(?:it|the\s+answer)\s+backwards\b/i,
  /\bbackwards\b.*\banswer\b/i,

  // Broad answer/solution phrasing (scoped by surrounding context checks below)
  /\b(?:what|give|tell|show)\s+me\s+.{0,24}\b(?:answers?|solutions?)\b/i,
  /\bsolve\s+(?:question|q|number|#|\d+|this\s+problem|the\s+problem)\b/i,
  /\b(?:give|provide|show)\s+me\s+.{0,20}\bsolution\b/i,

  // Indirect bypass: "don't give the answer, just produce it"
  /\bjust\s+(?:give|write|show)\s+(?:me\s+)?(?:the\s+)?code\b/i,
  /\bdon'?t\s+tell\s+me\s+the\s+answer\b/i,
  /\bwrite\s+code\s+that\s+produces\s+(?:it|the\s+answer)\b/i,
  /\bwhich\s+option\s+would\s+you\s+choose\b/i,
  /\bis\s+my\s+answer\s+[a-d]\s+correct\b/i,
  /\bfinish\s+the\s+last\s+(?:two\s+)?lines?\b/i,
  /\bshow\s+me\s+an\s+example\s+exactly\s+like\s+this\b/i,
  /\bwhat\s+output\s+should\s+my\s+program\s+produce\b/i,
  /\bgive\s+me\s+the\s+circuit\b/i,
  /\bso\s+i\s+can\s+compare\s+mine\b/i,
]

/** Heuristic: user is asking for direct answers / solutions (vs study strategy). */
export function looksLikeAnswerSeekingRequest(message: string): boolean {
  const raw = String(message ?? "").trim()
  if (!raw) return false

  const normalized = normalizeIntegrityText(raw)

  for (const pattern of ALLOWED_STUDY_OR_LOGISTICS) {
    if (pattern.test(raw) || pattern.test(normalized)) return false
  }

  for (const pattern of ANSWER_SEEKING_PATTERNS) {
    if (pattern.test(raw) || pattern.test(normalized)) return true
  }

  if (
    containsSpelledOutWord(raw, "answer") ||
    containsSpelledOutWord(normalized.replace(/\s/g, ""), "answer")
  ) {
    return true
  }

  // Broad "solve" only when tied to an assessment artifact, not general learning
  if (
    /\bsolve\b/i.test(raw) &&
    !/\bin\s+general\b/i.test(raw) &&
    !/\bhow\s+to\s+solve\b/i.test(raw) &&
    (/\b(?:question|q|number|#|\d|problem|quiz|exam|homework|assignment|plot|code)\b/i.test(raw) ||
      /\bfor\s+me\b/i.test(raw))
  ) {
    return true
  }

  return false
}

export type AssessmentCoraPolicy = "open" | "restricted" | "review" | "unavailable"

export type AssessmentIntegrityCapability =
  | "explain_instructions"
  | "clarify_question_wording"
  | "report_issue"
  | "navigate_start"
  | "review_attempt"
  | "explain_mistakes"
  | "teach_concepts"
  | "generate_similar_practice"
  | "create_flashcards"
  | "study_plan"

export type AssessmentIntegrityContext = {
  assessmentId: number | null
  attemptId: number | null
  title: string | null
  assessmentType: string | null
  state: "none" | "available" | "active" | "submitted" | "released"
  coraPolicy: AssessmentCoraPolicy
  answersReleased: boolean
  highStakes: boolean
  allowedCapabilities: AssessmentIntegrityCapability[]
  reason?: string
}

const HIGH_STAKES = new Set([
  "mid_semester",
  "midsem",
  "midterm",
  "final",
  "finals",
  "final_exam",
])

function isHighStakes(type: string | null | undefined): boolean {
  return HIGH_STAKES.has(String(type ?? "").trim().toLowerCase())
}

function restrictedCaps(): AssessmentIntegrityCapability[] {
  return ["explain_instructions", "clarify_question_wording", "report_issue"]
}

function reviewCaps(): AssessmentIntegrityCapability[] {
  return [
    "review_attempt",
    "explain_mistakes",
    "teach_concepts",
    "generate_similar_practice",
    "create_flashcards",
    "study_plan",
  ]
}

function openCaps(): AssessmentIntegrityCapability[] {
  return [
    "explain_instructions",
    "navigate_start",
    "teach_concepts",
    "generate_similar_practice",
    "create_flashcards",
    "study_plan",
  ]
}

/**
 * Resolve integrity context for the student — optional specific quiz, else
 * active attempt, else most recent completed attempt.
 */
export async function resolveAssessmentIntegrityContext(
  studentDbId: number,
  assessmentId?: number | null,
): Promise<AssessmentIntegrityContext> {
  if (!Number.isFinite(studentDbId) || studentDbId <= 0) {
    return {
      assessmentId: null,
      attemptId: null,
      title: null,
      assessmentType: null,
      state: "none",
      coraPolicy: "unavailable",
      answersReleased: false,
      highStakes: false,
      allowedCapabilities: ["teach_concepts", "study_plan"],
    }
  }

  try {
    // Active unfinished attempt (any assessment type)
    const activeRows = (await sql`
      SELECT qa.id AS attempt_id, q.id AS quiz_id, q.title, q.assessment_type
      FROM quiz_attempts qa
      INNER JOIN quizzes q ON q.id = qa.quiz_id
      WHERE qa.student_id = ${studentDbId}
        AND qa.completed_at IS NULL
        AND qa.deleted_at IS NULL
        AND (${assessmentId ?? null}::int IS NULL OR q.id = ${assessmentId ?? null})
      ORDER BY qa.started_at DESC NULLS LAST
      LIMIT 1
    `) as {
      attempt_id: number
      quiz_id: number
      title: string | null
      assessment_type: string | null
    }[]

    const active = activeRows[0]
    if (active) {
      const highStakes = isHighStakes(active.assessment_type)
      return {
        assessmentId: Number(active.quiz_id),
        attemptId: Number(active.attempt_id),
        title: active.title,
        assessmentType: active.assessment_type,
        state: "active",
        coraPolicy: "restricted",
        answersReleased: false,
        highStakes,
        allowedCapabilities: restrictedCaps(),
        reason: highStakes
          ? "Active high-stakes attempt — Cora will not provide answers. You may ask about instructions or report issues."
          : "Active assessment attempt — answer-giving is restricted until you submit.",
      }
    }

    // Released / completed attempt
    const doneRows = (await sql`
      SELECT
        qa.id AS attempt_id,
        q.id AS quiz_id,
        q.title,
        q.assessment_type,
        qa.completed_at,
        qa.score,
        qa.total_questions,
        qa.results_finalized_at
      FROM quiz_attempts qa
      INNER JOIN quizzes q ON q.id = qa.quiz_id
      WHERE qa.student_id = ${studentDbId}
        AND qa.completed_at IS NOT NULL
        AND qa.deleted_at IS NULL
        AND (${assessmentId ?? null}::int IS NULL OR q.id = ${assessmentId ?? null})
      ORDER BY qa.completed_at DESC NULLS LAST
      LIMIT 1
    `) as {
      attempt_id: number
      quiz_id: number
      title: string | null
      assessment_type: string | null
      completed_at: string | null
      score: number | null
      total_questions: number | null
      results_finalized_at: string | null
    }[]

    const done = doneRows[0]
    if (done) {
      const answersReleased = done.results_finalized_at != null
      if (answersReleased) {
        return {
          assessmentId: Number(done.quiz_id),
          attemptId: Number(done.attempt_id),
          title: done.title,
          assessmentType: done.assessment_type,
          state: "released",
          coraPolicy: "review",
          answersReleased: true,
          highStakes: isHighStakes(done.assessment_type),
          allowedCapabilities: reviewCaps(),
          reason: `Results released for "${done.title ?? "assessment"}". Cora can review mistakes and create practice.`,
        }
      }
      return {
        assessmentId: Number(done.quiz_id),
        attemptId: Number(done.attempt_id),
        title: done.title,
        assessmentType: done.assessment_type,
        state: "submitted",
        coraPolicy: "restricted",
        answersReleased: false,
        highStakes: isHighStakes(done.assessment_type),
        allowedCapabilities: ["explain_instructions", "report_issue", "study_plan"],
        reason: "Attempt submitted but results are not released yet.",
      }
    }

    return {
      assessmentId: assessmentId ?? null,
      attemptId: null,
      title: null,
      assessmentType: null,
      state: "available",
      coraPolicy: "open",
      answersReleased: false,
      highStakes: false,
      allowedCapabilities: openCaps(),
      reason: "No active or recent attempt in scope — general study help is available.",
    }
  } catch (err) {
    console.warn("[assessment-integrity] resolve failed:", err)
    return {
      assessmentId: null,
      attemptId: null,
      title: null,
      assessmentType: null,
      state: "none",
      coraPolicy: "open",
      answersReleased: false,
      highStakes: false,
      allowedCapabilities: openCaps(),
    }
  }
}

/** Whether an answer-seeking message should be refused under current integrity. */
export async function shouldRefuseAssessmentAnswers(
  studentDbId: number,
  message: string,
): Promise<{ refuse: boolean; context: AssessmentIntegrityContext; message?: string }> {
  const context = await resolveAssessmentIntegrityContext(studentDbId)
  if (context.coraPolicy !== "restricted" && context.coraPolicy !== "unavailable") {
    return { refuse: false, context }
  }
  // Only refuse answer-seeking (or unavailable). Instructions / logistics stay allowed under restricted.
  if (!looksLikeAnswerSeekingRequest(message)) {
    return { refuse: false, context }
  }
  return {
    refuse: true,
    context,
    message:
      context.reason ??
      "I can't provide assessment answers while this attempt is protected. After you submit and results release, I can review your work.",
  }
}

export function formatAssessmentIntegrityForPrompt(ctx: AssessmentIntegrityContext): string {
  return [
    `Assessment integrity: state=${ctx.state} policy=${ctx.coraPolicy} answersReleased=${ctx.answersReleased}`,
    ctx.title ? `Title: ${ctx.title}` : null,
    ctx.assessmentType ? `Type: ${ctx.assessmentType}` : null,
    `Allowed: ${ctx.allowedCapabilities.join(", ") || "none"}`,
    ctx.reason ? `Note: ${ctx.reason}` : null,
  ]
    .filter(Boolean)
    .join("\n")
}

/** Socratic-only contract appended to system prompts during active/restricted attempts. */
export function buildAssessmentSocraticPromptAppendix(ctx: AssessmentIntegrityContext): string {
  if (ctx.coraPolicy !== "restricted" || ctx.state !== "active") return ""
  return `

ACTIVE ASSESSMENT — SOCRATIC MODE (mandatory):
- The student has an in-progress assessment attempt. You are a guide, never an answer key.
- NEVER output complete solution code, final plots/graphs, or numeric results for graded parts.
- NEVER confirm or deny whether their current answer/choice/code is correct.
- Respond with 1–3 hints in escalating specificity: name the concept, ask a guiding question, point to relevant lecture topics, or identify the category of bug (e.g. "check your loop bounds") without writing the fixed line.
- Allowed: explain instructions, clarify wording, report issues, general concept teaching unrelated to specific question answers.
${formatAssessmentIntegrityForPrompt(ctx)}`
}

export function assessmentIntegrityAllows(
  ctx: AssessmentIntegrityContext,
  capability: AssessmentIntegrityCapability,
): boolean {
  return ctx.allowedCapabilities.includes(capability)
}

export function buildAssessmentIntegrityRefusal(ctx: AssessmentIntegrityContext): string {
  if (ctx.state === "active") {
    return (
      ctx.reason ??
      "I can't provide answers while this assessment is in progress. After you submit (and when results are released), I can review your attempt and help you study."
    )
  }
  if (ctx.state === "submitted" && !ctx.answersReleased) {
    return "Your attempt is submitted, but answers aren't released yet. I can help with logistics and a study plan — not solutions — until your instructor releases results."
  }
  return "That capability isn't available for this assessment right now."
}

export function gateMessageAgainstIntegrity(
  ctx: AssessmentIntegrityContext | null | undefined,
  message: string,
): string | null {
  if (!ctx) return null
  if (ctx.coraPolicy === "review" || ctx.coraPolicy === "open") return null
  if (ctx.coraPolicy === "restricted" && !looksLikeAnswerSeekingRequest(message) && !ctx.highStakes) {
    return null
  }
  if (ctx.coraPolicy === "restricted" || ctx.coraPolicy === "unavailable") {
    if (ctx.highStakes || looksLikeAnswerSeekingRequest(message)) {
      return buildAssessmentIntegrityRefusal(ctx)
    }
  }
  return null
}

/**
 * Contexts where full worked solutions are allowed regardless of other active attempts.
 *
 * SECURITY: every input here is client-claimed. When the student has an ACTIVE
 * attempt, callers MUST pair this with `textMatchesAssessmentQuestions` so a
 * spoofed lecture context can't smuggle live assessment questions into a
 * full-solve path.
 */
export function isLectureOrPracticeLearningContext(input: {
  lectureId?: number | null
  problemSource?: string | null
  classroomSubmissionId?: unknown
}): boolean {
  if (input.classroomSubmissionId) return true
  if (input.lectureId != null && Number.isFinite(Number(input.lectureId))) return true
  const src = String(input.problemSource ?? "").trim().toLowerCase()
  return (
    src === "lecture_workspace" ||
    src === "lecture_practice" ||
    src === "practice_hub" ||
    src === "practice" ||
    src === "codebench" ||
    src === "classroom_points"
  )
}

const OVERLAP_STOPWORDS = new Set([
  "that", "this", "with", "from", "have", "what", "when", "where", "which",
  "will", "would", "should", "could", "your", "their", "there", "then",
  "than", "them", "they", "each", "also", "must", "only", "such", "into",
  "does", "please", "following", "using", "used", "value", "values",
  "answer", "question", "questions", "write", "given", "find", "number",
])

/** Distinctive tokens for content-overlap comparison (pure, testable). */
export function overlapTokens(text: string): Set<string> {
  return new Set(
    String(text ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !OVERLAP_STOPWORDS.has(w)),
  )
}

/** Fraction of the reference's distinctive tokens that appear in the candidate (pure, testable). */
export function tokenCoverageRatio(referenceText: string, candidateText: string): number {
  const ref = overlapTokens(referenceText)
  if (ref.size === 0) return 0
  const cand = overlapTokens(candidateText)
  let hits = 0
  for (const tok of ref) if (cand.has(tok)) hits += 1
  return hits / ref.size
}

/** Minimum distinctive tokens a question needs before overlap matching is reliable. */
const MIN_MATCH_TOKENS = 6
/** Reference-token coverage at/above which we treat text as a reproduced question. */
const MATCH_COVERAGE_THRESHOLD = 0.6

/**
 * True when `text` substantially reproduces a question from the given assessment.
 * Used to detect live quiz questions pasted into full-solve contexts (spoofed
 * lecture workspace, practice hub, etc.) while an attempt is active.
 */
export async function textMatchesAssessmentQuestions(
  assessmentId: number,
  text: string,
): Promise<boolean> {
  if (!Number.isFinite(assessmentId) || assessmentId <= 0) return false
  const candidate = String(text ?? "")
  if (overlapTokens(candidate).size < MIN_MATCH_TOKENS) return false
  try {
    const rows = (await sql`
      SELECT
        NULLIF(TRIM(qq.question_text), '') AS quiz_text,
        qb.question_text AS bank_text
      FROM quiz_questions qq
      LEFT JOIN question_bank qb
        ON qb.id = qq.bank_question_id AND qb.deleted_at IS NULL
      WHERE qq.quiz_id = ${assessmentId}
    `) as { quiz_text: string | null; bank_text: string | null }[]

    for (const row of rows) {
      for (const questionText of [row.bank_text, row.quiz_text]) {
        if (!questionText) continue
        if (overlapTokens(questionText).size < MIN_MATCH_TOKENS) continue
        if (tokenCoverageRatio(questionText, candidate) >= MATCH_COVERAGE_THRESHOLD) {
          return true
        }
      }
    }
  } catch (err) {
    console.warn("[assessment-integrity] question content match failed:", err)
  }
  return false
}
