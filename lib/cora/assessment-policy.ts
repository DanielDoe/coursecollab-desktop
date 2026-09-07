/**
 * Central Ask Cora assessment integrity policy.
 *
 * All student assessment Ask Cora entry points MUST call
 * `CoraAssessmentPolicy.evaluate` (or the server resolver that wraps it).
 *
 * Critical rule: Cora may help the student learn how to reach the answer.
 * Cora must never give, complete, confirm, or generate the answer for them
 * while the assessment is protected.
 */

import { canStudentAskCora, normalizeAskCoraQuestionType } from "@/lib/cora/ask-cora-eligibility"
import { looksLikeAnswerSeekingRequest } from "@/lib/cora/security/assessment-integrity"

export type CoraAssessmentMode = "DISABLED" | "GUIDED_ONLY" | "REVIEW" | "OPEN"

export type InstructorCoraPolicy =
  | "disabled"
  | "guided_only"
  | "review_after_release"
  | "open"

export type CoraAssistanceKind =
  | "explain_concepts"
  | "clarify_terminology"
  | "guiding_questions"
  | "hints"
  | "formulas_without_substitution"
  | "identify_conceptual_mistakes"
  | "next_reasoning_step"
  | "explain_compiler_errors"
  | "point_to_course_material"
  | "explain_syntax"
  | "identify_bug_category"
  | "generic_pseudocode"
  | "circuit_concepts_and_laws"
  | "review_released_solution"

export type CoraAssistanceCategory =
  | "conceptual_hint"
  | "debugging"
  | "syntax"
  | "circuit_guidance"
  | "answer_seeking"
  | "logistics"
  | "review"

export type CoraAttemptStateSnapshot = {
  assessmentType: string | null
  questionType: string | null
  submitted: boolean
  graded: boolean
  assessmentActive: boolean
  assessmentClosed: boolean
  attemptsRemaining: number | null
  solutionsReleased: boolean
  instructorPolicy: InstructorCoraPolicy
  questionAnswered: boolean
}

export type CoraAssessmentPolicyInput = {
  studentId?: number | null
  courseId?: number | null
  assessmentType?: string | null
  questionType?: string | null
  subquestionTypes?: Array<string | null | undefined>
  source?: string | null
  submitted?: boolean
  graded?: boolean
  questionAnswered?: boolean
  assessmentActive?: boolean
  assessmentClosed?: boolean
  attemptsRemaining?: number | null
  solutionsReleased?: boolean
  instructorPolicy?: InstructorCoraPolicy | null
  message?: string | null
}

export type CoraAssessmentPolicyResult = {
  mode: CoraAssessmentMode
  canRevealAnswer: boolean
  canConfirmAnswer: boolean
  canGenerateSolutionCode: boolean
  canUseHiddenSolutionContext: boolean
  allowedAssistance: CoraAssistanceKind[]
  deniedAssistance: string[]
  questionEligible: boolean
  answerSeeking: boolean
  assistanceCategory: CoraAssistanceCategory
  attemptState: CoraAttemptStateSnapshot
  reason: string
  refusalMessage: string | null
}

const GUIDED_ASSISTANCE: CoraAssistanceKind[] = [
  "explain_concepts",
  "clarify_terminology",
  "guiding_questions",
  "hints",
  "formulas_without_substitution",
  "identify_conceptual_mistakes",
  "next_reasoning_step",
  "explain_compiler_errors",
  "point_to_course_material",
  "explain_syntax",
  "identify_bug_category",
  "generic_pseudocode",
  "circuit_concepts_and_laws",
]

const DENIED_WHILE_PROTECTED = [
  "correct_answer",
  "final_numeric_answer",
  "correct_option",
  "complete_derivation",
  "completed_solution",
  "answer_confirmation",
  "solution_code",
  "completed_circuit",
  "exact_implementation",
  "revealing_output",
]

const GUIDED_REFUSAL =
  "I can help you learn how to reach the answer, but I can't give, complete, or confirm it while this question is still protected. Tell me what you've tried so far, and I'll guide the next step."

function normalizeInstructorPolicy(raw: InstructorCoraPolicy | null | undefined): InstructorCoraPolicy {
  const value = String(raw ?? "review_after_release").toLowerCase().trim()
  if (value === "disabled" || value === "unavailable") return "disabled"
  if (value === "guided_only" || value === "restricted" || value === "guided") return "guided_only"
  if (value === "open") return "open"
  return "review_after_release"
}

function isWrittenSource(source: string | null | undefined): boolean {
  const src = String(source ?? "").toLowerCase()
  return (
    src === "quiz" ||
    src === "practice_hub" ||
    src === "practice" ||
    src === "lecture_workspace" ||
    src === "homework" ||
    src === "exam" ||
    src === "codebench"
  )
}

function classifyAssistance(
  message: string | null | undefined,
  questionType: string | null | undefined,
  answerSeeking: boolean,
  mode: CoraAssessmentMode,
): CoraAssistanceCategory {
  if (answerSeeking) return "answer_seeking"
  if (mode === "REVIEW") return "review"
  const text = String(message ?? "").toLowerCase()
  const qt = normalizeAskCoraQuestionType(questionType)
  if (/\b(compile|compiler|runtime|error|bug|debug|segfault|exception)\b/.test(text)) return "debugging"
  if (/\b(syntax|semicolon|pointer|loop|function signature)\b/.test(text)) return "syntax"
  if (qt.includes("circuit") || /\b(kirchhoff|ohm|voltage|current|schematic|node)\b/.test(text)) {
    return "circuit_guidance"
  }
  if (/\b(time left|how to submit|navigate|instructions?|wording)\b/.test(text)) return "logistics"
  return "conceptual_hint"
}

function guidedAssistanceForQuestion(questionType: string | null | undefined): CoraAssistanceKind[] {
  const qt = normalizeAskCoraQuestionType(questionType)
  const base = [...GUIDED_ASSISTANCE]
  if (qt === "code_write" || qt === "code_write_plot" || qt === "code_debug" || qt === "debug_code") {
    return base.filter((item) => item !== "circuit_concepts_and_laws")
  }
  if (qt.includes("circuit")) {
    return base.filter((item) => item !== "generic_pseudocode" && item !== "explain_compiler_errors")
  }
  return base
}

/**
 * Full solution access requires every unlock condition.
 * A single submission is never enough.
 */
export function canUnlockReleasedSolutions(state: {
  assessmentClosed: boolean
  attemptsRemaining: number | null
  solutionsReleased: boolean
  instructorPolicy: InstructorCoraPolicy
}): boolean {
  if (state.instructorPolicy === "disabled" || state.instructorPolicy === "guided_only") return false
  if (state.instructorPolicy === "open") return true
  const attemptsExhausted = state.attemptsRemaining == null || state.attemptsRemaining <= 0
  return state.assessmentClosed && state.solutionsReleased && attemptsExhausted
}

export const CoraAssessmentPolicy = {
  evaluate(input: CoraAssessmentPolicyInput): CoraAssessmentPolicyResult {
    const instructorPolicy = normalizeInstructorPolicy(input.instructorPolicy)
    const questionType = normalizeAskCoraQuestionType(input.questionType)
    const questionEligible = questionType
      ? canStudentAskCora(questionType, { subquestionTypes: input.subquestionTypes })
      : !isWrittenSource(input.source)
    const submitted = Boolean(input.submitted)
    const graded = Boolean(input.graded)
    const questionAnswered = Boolean(input.questionAnswered)
    const assessmentActive = Boolean(input.assessmentActive)
    const assessmentClosed = Boolean(input.assessmentClosed)
    const attemptsRemaining =
      input.attemptsRemaining == null || !Number.isFinite(Number(input.attemptsRemaining))
        ? null
        : Number(input.attemptsRemaining)
    const solutionsReleased = Boolean(input.solutionsReleased)
    const answerSeeking = looksLikeAnswerSeekingRequest(String(input.message ?? ""))

    const attemptState: CoraAttemptStateSnapshot = {
      assessmentType: input.assessmentType ?? null,
      questionType: questionType || null,
      submitted,
      graded,
      assessmentActive,
      assessmentClosed,
      attemptsRemaining,
      solutionsReleased,
      instructorPolicy,
      questionAnswered,
    }

    const denied = [...DENIED_WHILE_PROTECTED]

    if (instructorPolicy === "disabled") {
      return finish({
        mode: "DISABLED",
        canRevealAnswer: false,
        canConfirmAnswer: false,
        canGenerateSolutionCode: false,
        canUseHiddenSolutionContext: false,
        allowedAssistance: [],
        deniedAssistance: denied,
        questionEligible: false,
        answerSeeking,
        assistanceCategory: classifyAssistance(input.message, questionType, answerSeeking, "DISABLED"),
        attemptState,
        reason: "Instructor Cora policy disables Ask Cora for this assessment.",
        refusalMessage:
          "Ask Cora is turned off for this assessment. Use your notes, lecture material, or office hours instead.",
      })
    }

    if (questionType && !questionEligible) {
      return finish({
        mode: "DISABLED",
        canRevealAnswer: false,
        canConfirmAnswer: false,
        canGenerateSolutionCode: false,
        canUseHiddenSolutionContext: false,
        allowedAssistance: [],
        deniedAssistance: denied,
        questionEligible: false,
        answerSeeking,
        assistanceCategory: classifyAssistance(input.message, questionType, answerSeeking, "DISABLED"),
        attemptState,
        reason: "Ask Cora is not available for autograded / objective questions.",
        refusalMessage:
          "Ask Cora is available for written work such as code or circuit submissions, not for multiple-choice or other autograded items.",
      })
    }

    const unlocked = canUnlockReleasedSolutions({
      assessmentClosed,
      attemptsRemaining,
      solutionsReleased,
      instructorPolicy,
    })

    if (unlocked) {
      return finish({
        mode: "REVIEW",
        canRevealAnswer: true,
        canConfirmAnswer: true,
        canGenerateSolutionCode: true,
        canUseHiddenSolutionContext: true,
        allowedAssistance: [...guidedAssistanceForQuestion(questionType), "review_released_solution"],
        deniedAssistance: [],
        questionEligible,
        answerSeeking,
        assistanceCategory: classifyAssistance(input.message, questionType, answerSeeking, "REVIEW"),
        attemptState,
        reason: "Assessment is closed, attempts are exhausted, and solutions have been released.",
        refusalMessage: null,
      })
    }

    const inAssessmentContext = isWrittenSource(input.source) || Boolean(questionType)
    const isProtectedAttempt =
      inAssessmentContext &&
      (assessmentActive ||
        !submitted ||
        !questionAnswered ||
        !solutionsReleased ||
        !assessmentClosed ||
        (attemptsRemaining != null && attemptsRemaining > 0) ||
        instructorPolicy === "guided_only")

    if (isProtectedAttempt) {
      const reason = assessmentActive
        ? "Active attempt — Cora stays in guided-learning mode."
        : submitted && !solutionsReleased
          ? "Submitted, but solutions are not officially released yet."
          : "Protected assessment state — Cora may guide, not solve."
      return finish({
        mode: "GUIDED_ONLY",
        canRevealAnswer: false,
        canConfirmAnswer: false,
        canGenerateSolutionCode: false,
        canUseHiddenSolutionContext: false,
        allowedAssistance: guidedAssistanceForQuestion(questionType),
        deniedAssistance: denied,
        questionEligible,
        answerSeeking,
        assistanceCategory: classifyAssistance(input.message, questionType, answerSeeking, "GUIDED_ONLY"),
        attemptState,
        reason,
        refusalMessage: answerSeeking ? GUIDED_REFUSAL : null,
      })
    }

    return finish({
      mode: "OPEN",
      canRevealAnswer: true,
      canConfirmAnswer: true,
      canGenerateSolutionCode: true,
      canUseHiddenSolutionContext: true,
      allowedAssistance: [...guidedAssistanceForQuestion(questionType), "review_released_solution"],
      deniedAssistance: [],
      questionEligible,
      answerSeeking,
      assistanceCategory: classifyAssistance(input.message, questionType, answerSeeking, "OPEN"),
      attemptState,
      reason: "No protected assessment context — general study help is available.",
      refusalMessage: null,
    })
  },
}

function finish(result: CoraAssessmentPolicyResult): CoraAssessmentPolicyResult {
  return result
}

export function buildGuidedPolicyPrompt(policy: CoraAssessmentPolicyResult): string {
  if (policy.mode === "REVIEW" || policy.mode === "OPEN") {
    return `
ASSESSMENT POLICY: ${policy.mode}
- Solutions may be discussed because they are officially released or this is open learning.
- Still teach; do not dump a key without explanation.
`
  }
  if (policy.mode === "DISABLED") {
    return `
ASSESSMENT POLICY: DISABLED
- Do not help with this question. Direct the student to the assessment or instructor.
`
  }
  const qt = policy.attemptState.questionType ?? ""
  const codeRules =
    qt === "code_write" || qt === "code_write_plot" || qt.includes("code")
      ? `
CODEWRITE RULES:
- You MAY explain syntax, compiler/runtime errors, concepts, and the general location/type of a bug.
- You MAY ask what should happen next and give generic pseudocode that does not solve the problem.
- You MUST NOT write the required program, complete missing code, rewrite their code into the answer, or generate a copy-paste solution or plot.
- If they say "just give me the code", refuse and keep tutoring.`
      : ""
  const circuitRules = qt.includes("circuit")
    ? `
CIRCUIT RULES:
- You MAY explain concepts, laws, analysis methods, what to inspect, conceptual mistakes, and general equations.
- You MUST NOT solve the circuit, give final component values, voltages/currents, a completed schematic, or confirm a proposed final answer.`
    : ""

  return `
ASSESSMENT POLICY: GUIDED_ONLY (mandatory, server-enforced)
- The student is in a protected assessment or practice attempt.
- NEVER give the correct answer, final numeric result, correct option, complete derivation, or completed solution.
- NEVER confirm or deny whether their current answer/choice/code/circuit is correct.
- NEVER output code, plots, or circuits that can be copied into the submission.
- MAY: explain concepts, clarify wording, ask guiding questions, give hints, recall formulas without substituting problem values, identify conceptual mistakes, suggest the next reasoning step, explain compiler errors without writing the fix, and point to course material.
- Pattern: GUIDE → HINT → QUESTION → FEEDBACK. Never SOLVE → REVEAL → CONFIRM.
- Allowed: ${policy.allowedAssistance.join(", ") || "none"}
- Denied: ${policy.deniedAssistance.join(", ") || "none"}
- State: submitted=${policy.attemptState.submitted} active=${policy.attemptState.assessmentActive} solutionsReleased=${policy.attemptState.solutionsReleased} closed=${policy.attemptState.assessmentClosed}
${codeRules}${circuitRules}`
}

export function defaultInstructorCoraPolicy(): InstructorCoraPolicy {
  return "review_after_release"
}
