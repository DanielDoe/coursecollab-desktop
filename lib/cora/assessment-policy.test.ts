/**
 * Run: npx tsx --test lib/cora/assessment-policy.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  CoraAssessmentPolicy,
  canUnlockReleasedSolutions,
  type CoraAssessmentPolicyInput,
} from "./assessment-policy"

function evaluate(overrides: Partial<CoraAssessmentPolicyInput> = {}) {
  return CoraAssessmentPolicy.evaluate({
    questionType: "code_write",
    source: "quiz",
    assessmentType: "homework",
    submitted: false,
    graded: false,
    questionAnswered: false,
    assessmentActive: true,
    assessmentClosed: false,
    attemptsRemaining: 1,
    solutionsReleased: false,
    instructorPolicy: "review_after_release",
    message: "Can you explain the loop concept?",
    ...overrides,
  })
}

describe("CoraAssessmentPolicy.evaluate — active attempt", () => {
  it("stays GUIDED_ONLY and blocks reveal/confirm/code/hidden context", () => {
    const result = evaluate()
    assert.equal(result.mode, "GUIDED_ONLY")
    assert.equal(result.canRevealAnswer, false)
    assert.equal(result.canConfirmAnswer, false)
    assert.equal(result.canGenerateSolutionCode, false)
    assert.equal(result.canUseHiddenSolutionContext, false)
    assert.ok(result.allowedAssistance.includes("hints"))
    assert.ok(result.deniedAssistance.includes("solution_code"))
  })

  it("flags answer-seeking and returns a refusal message", () => {
    const result = evaluate({ message: "Just give me the code." })
    assert.equal(result.answerSeeking, true)
    assert.ok(result.refusalMessage)
    assert.equal(result.assistanceCategory, "answer_seeking")
  })

  it("disables Ask Cora for MCQ", () => {
    const result = evaluate({ questionType: "mcq" })
    assert.equal(result.mode, "DISABLED")
    assert.equal(result.questionEligible, false)
  })

  it("honors instructor disabled policy", () => {
    const result = evaluate({ instructorPolicy: "disabled" })
    assert.equal(result.mode, "DISABLED")
  })
})

describe("CoraAssessmentPolicy.evaluate — after submission", () => {
  it("does not unlock just because the student submitted once", () => {
    const result = evaluate({
      submitted: true,
      questionAnswered: true,
      assessmentActive: false,
      assessmentClosed: false,
      attemptsRemaining: 1,
      solutionsReleased: false,
    })
    assert.equal(result.mode, "GUIDED_ONLY")
    assert.equal(result.canRevealAnswer, false)
    assert.equal(result.canUseHiddenSolutionContext, false)
  })

  it("unlocks REVIEW only when closed + released + attempts exhausted + instructor policy", () => {
    const result = evaluate({
      submitted: true,
      graded: true,
      questionAnswered: true,
      assessmentActive: false,
      assessmentClosed: true,
      attemptsRemaining: 0,
      solutionsReleased: true,
      instructorPolicy: "review_after_release",
    })
    assert.equal(result.mode, "REVIEW")
    assert.equal(result.canRevealAnswer, true)
    assert.equal(result.canConfirmAnswer, true)
    assert.equal(result.canGenerateSolutionCode, true)
    assert.equal(result.canUseHiddenSolutionContext, true)
  })

  it("stays guided when instructor policy is guided_only even after release", () => {
    const result = evaluate({
      submitted: true,
      assessmentActive: false,
      assessmentClosed: true,
      attemptsRemaining: 0,
      solutionsReleased: true,
      instructorPolicy: "guided_only",
    })
    assert.equal(result.mode, "GUIDED_ONLY")
    assert.equal(result.canRevealAnswer, false)
  })
})

describe("CoraAssessmentPolicy.evaluate — general study", () => {
  it("stays OPEN when there is no assessment context", () => {
    const result = CoraAssessmentPolicy.evaluate({
      source: "custom",
      message: "Explain pointers in general",
    })
    assert.equal(result.mode, "OPEN")
    assert.equal(result.canRevealAnswer, true)
  })
})

describe("canUnlockReleasedSolutions", () => {
  it("requires every unlock condition", () => {
    assert.equal(
      canUnlockReleasedSolutions({
        assessmentClosed: true,
        attemptsRemaining: 0,
        solutionsReleased: true,
        instructorPolicy: "review_after_release",
      }),
      true,
    )
    assert.equal(
      canUnlockReleasedSolutions({
        assessmentClosed: false,
        attemptsRemaining: 0,
        solutionsReleased: true,
        instructorPolicy: "review_after_release",
      }),
      false,
    )
    assert.equal(
      canUnlockReleasedSolutions({
        assessmentClosed: true,
        attemptsRemaining: 2,
        solutionsReleased: true,
        instructorPolicy: "review_after_release",
      }),
      false,
    )
  })
})
