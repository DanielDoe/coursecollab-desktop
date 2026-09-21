/**
 * Run: npx tsx --test lib/antiCheatConfig.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  applyStrictModeIntegrityDefaults,
  applyUnconfiguredQuizIntegrityDefaults,
  buildQuizAntiCheatConfigFromDb,
  isHomeworkAssessment,
  isQuizLevelAntiCheatActive,
  isStrictIntegrityAssessment,
} from "./antiCheatConfig"

describe("applyStrictModeIntegrityDefaults", () => {
  it("is a no-op when Strict Mode is off", () => {
    const config = {
      strictModeEnabled: false,
      blockCopyPaste: false,
      trackTabSwitches: false,
      requireFullscreen: false,
      trackGeminiWindow: false,
    }
    assert.deepEqual(applyStrictModeIntegrityDefaults(config), config)
  })

  it("turns on fullscreen, tab tracking, copy/paste, AI detection, and auto-submit", () => {
    const result = applyStrictModeIntegrityDefaults({
      strictModeEnabled: true,
      blockCopyPaste: false,
      trackTabSwitches: false,
      warnOnTabSwitch: false,
      autoSubmitOnViolations: false,
      trackGeminiWindow: false,
      requireFullscreen: false,
    })
    assert.equal(result.blockCopyPaste, true)
    assert.equal(result.trackTabSwitches, true)
    assert.equal(result.warnOnTabSwitch, true)
    assert.equal(result.autoSubmitOnViolations, true)
    assert.equal(result.trackGeminiWindow, true)
    assert.equal(result.requireFullscreen, true)
  })
})

describe("applyUnconfiguredQuizIntegrityDefaults", () => {
  it("turns on the full suite for graded quizzes with every flag off", () => {
    const result = applyUnconfiguredQuizIntegrityDefaults(
      {
        strictModeEnabled: false,
        blockCopyPaste: false,
        trackTabSwitches: false,
        requireFullscreen: false,
        trackGeminiWindow: false,
      },
      "quiz",
    )
    assert.equal(result.requireFullscreen, true)
    assert.equal(result.trackTabSwitches, true)
    assert.equal(result.trackGeminiWindow, true)
    assert.equal(result.strictModeEnabled, true)
  })

  it("leaves practice assessments unlocked when every flag is off", () => {
    const config = {
      strictModeEnabled: false,
      blockCopyPaste: false,
      trackTabSwitches: false,
      requireFullscreen: false,
      trackGeminiWindow: false,
    }
    assert.deepEqual(applyUnconfiguredQuizIntegrityDefaults(config, "practice"), config)
  })

  it("leaves quizzes titled No Anti-Cheat unlocked", () => {
    const config = {
      strictModeEnabled: false,
      blockCopyPaste: false,
      trackTabSwitches: false,
      requireFullscreen: false,
      trackGeminiWindow: false,
    }
    assert.deepEqual(
      applyUnconfiguredQuizIntegrityDefaults(config, "quiz", "Code Write Grading Test - Basic C++ (No Anti-Cheat)"),
      config,
    )
  })
})

describe("buildQuizAntiCheatConfigFromDb", () => {
  it("enforces fullscreen and tab tracking on an unconfigured graded quiz", () => {
    const config = buildQuizAntiCheatConfigFromDb({
      assessment_type: "quiz",
      strict_mode_enabled: false,
      block_copy_paste: false,
      track_tab_switches: false,
      require_fullscreen: false,
      track_gemini_window: false,
    })
    assert.equal(config.requireFullscreen, true)
    assert.equal(config.trackTabSwitches, true)
    assert.equal(config.trackGeminiWindow, true)
    assert.equal(isQuizLevelAntiCheatActive(config), true)
  })

  it("does not force integrity onto practice assessments", () => {
    const config = buildQuizAntiCheatConfigFromDb({
      assessment_type: "practice",
      strict_mode_enabled: false,
      block_copy_paste: false,
      track_tab_switches: false,
      require_fullscreen: false,
      track_gemini_window: false,
    })
    assert.equal(config.requireFullscreen, false)
    assert.equal(config.trackTabSwitches, false)
    assert.equal(isQuizLevelAntiCheatActive(config), false)
  })

  it("expands Strict Mode into the full desktop/web integrity suite", () => {
    const config = buildQuizAntiCheatConfigFromDb({
      strict_mode_enabled: true,
      block_copy_paste: false,
      track_tab_switches: false,
      require_fullscreen: false,
      track_gemini_window: false,
      auto_submit_on_violations: false,
    })
    assert.equal(config.strictModeEnabled, true)
    assert.equal(config.requireFullscreen, true)
    assert.equal(config.trackTabSwitches, true)
    assert.equal(config.blockCopyPaste, true)
    assert.equal(config.trackGeminiWindow, true)
    assert.equal(config.autoSubmitOnViolations, true)
    assert.equal(isQuizLevelAntiCheatActive(config), true)
  })

  it("honors an explicit require_fullscreen flag without Strict Mode", () => {
    const config = buildQuizAntiCheatConfigFromDb({
      assessment_type: "quiz",
      strict_mode_enabled: false,
      require_fullscreen: true,
      track_tab_switches: true,
    })
    assert.equal(config.requireFullscreen, true)
    assert.equal(config.trackTabSwitches, true)
    assert.equal(config.strictModeEnabled, false)
  })

  it("forces fullscreen when a graded quiz already has other integrity flags on", () => {
    const config = buildQuizAntiCheatConfigFromDb({
      assessment_type: "quiz",
      strict_mode_enabled: false,
      block_copy_paste: true,
      track_tab_switches: true,
      require_fullscreen: false,
      track_gemini_window: false,
    })
    assert.equal(config.requireFullscreen, true)
    assert.equal(config.trackTabSwitches, true)
    assert.equal(config.blockCopyPaste, true)
  })

  it("keeps homework unlocked even when DB flags were left on", () => {
    const config = buildQuizAntiCheatConfigFromDb({
      assessment_type: "homework",
      strict_mode_enabled: true,
      block_copy_paste: true,
      track_tab_switches: true,
      require_fullscreen: true,
      track_gemini_window: true,
      auto_submit_on_violations: true,
    })
    assert.equal(config.strictModeEnabled, false)
    assert.equal(config.requireFullscreen, false)
    assert.equal(config.trackTabSwitches, false)
    assert.equal(config.blockCopyPaste, false)
    assert.equal(config.trackGeminiWindow, false)
    assert.equal(isQuizLevelAntiCheatActive(config), false)
  })

  it("turns on the full suite for unconfigured mid-semester and final exams", () => {
    for (const assessmentType of ["mid_semester", "final"] as const) {
      const config = buildQuizAntiCheatConfigFromDb({
        assessment_type: assessmentType,
        strict_mode_enabled: false,
        block_copy_paste: false,
        track_tab_switches: false,
        require_fullscreen: false,
        track_gemini_window: false,
      })
      assert.equal(config.strictModeEnabled, true)
      assert.equal(config.requireFullscreen, true)
      assert.equal(config.trackTabSwitches, true)
    }
  })
})

describe("assessment type policy", () => {
  it("treats quizzes, mid-semesters, and finals as strict", () => {
    assert.equal(isStrictIntegrityAssessment("quiz"), true)
    assert.equal(isStrictIntegrityAssessment("mid_semester"), true)
    assert.equal(isStrictIntegrityAssessment("midsem"), true)
    assert.equal(isStrictIntegrityAssessment("final"), true)
    assert.equal(isStrictIntegrityAssessment("homework"), false)
    assert.equal(isHomeworkAssessment("homework"), true)
  })

  it("does not apply unconfigured defaults to homework", () => {
    const config = {
      strictModeEnabled: false,
      blockCopyPaste: false,
      trackTabSwitches: false,
      requireFullscreen: false,
      trackGeminiWindow: false,
    }
    const result = applyUnconfiguredQuizIntegrityDefaults(config, "homework")
    assert.equal(result.strictModeEnabled, false)
    assert.equal(result.requireFullscreen, false)
    assert.equal(isQuizLevelAntiCheatActive(result), false)
  })
})
