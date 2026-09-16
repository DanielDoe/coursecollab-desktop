import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isAssessmentPlatformAllowed,
  parseAssessmentPlatformAccess,
  parseAssessmentPlatformOverride,
  resolveAssessmentPlatformFlags,
  resolveAssessmentPlatformKind,
} from "./assessment-platform-access"

describe("assessment platform access", () => {
  it("maps aliases", () => {
    assert.equal(resolveAssessmentPlatformKind("midsem"), "mid_semester")
    assert.equal(resolveAssessmentPlatformKind("finals"), "final")
  })

  it("defaults every client on", () => {
    const access = parseAssessmentPlatformAccess(null)
    assert.equal(isAssessmentPlatformAllowed(access, "quiz", "mobile"), true)
    assert.equal(isAssessmentPlatformAllowed(access, "final", "web"), true)
  })

  it("honors deactivated mobile for quizzes and finals", () => {
    const access = parseAssessmentPlatformAccess({
      quiz: { web: true, mobile: false },
      mid_semester: { web: true, mobile: false },
      final: { mobile: false },
    })
    assert.equal(isAssessmentPlatformAllowed(access, "quiz", "mobile"), false)
    assert.equal(isAssessmentPlatformAllowed(access, "quiz", "web"), true)
    assert.equal(isAssessmentPlatformAllowed(access, "homework", "mobile"), true)
    assert.equal(isAssessmentPlatformAllowed(access, "finals", "mobile"), false)
  })

  it("treats null quiz platform_access as inherit", () => {
    assert.equal(parseAssessmentPlatformOverride(null), null)
    assert.equal(parseAssessmentPlatformOverride({ inherit: true }), null)
    assert.equal(parseAssessmentPlatformOverride({}), null)
  })

  it("lets one assessment override the course default", () => {
    const course = parseAssessmentPlatformAccess({
      homework: { web: true, mobile: false, desktop: true },
    })
    assert.equal(isAssessmentPlatformAllowed(course, "homework", "mobile"), false)
    assert.equal(
      isAssessmentPlatformAllowed(course, "homework", "mobile", { web: true, mobile: true }),
      true,
    )
    assert.equal(
      resolveAssessmentPlatformFlags(course, "homework", { mobile: false, web: true }).mobile,
      false,
    )
    assert.equal(resolveAssessmentPlatformFlags(course, "homework", null).mobile, false)
  })
})
