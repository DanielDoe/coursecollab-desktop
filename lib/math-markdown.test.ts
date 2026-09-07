/**
 * Run: npx tsx --test lib/math-markdown.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  fixUnbracedMultiCharSubscripts,
  fixUnbracedMultiCharSubscriptsInMath,
  normalizeInlineLatex,
} from "./math-markdown"
import { enrichHtmlWithKatex } from "./html-question-text"

describe("fixUnbracedMultiCharSubscripts", () => {
  it("wraps multi-character subscripts like rms", () => {
    assert.equal(fixUnbracedMultiCharSubscripts("V_rms"), "V_{rms}")
    assert.equal(fixUnbracedMultiCharSubscripts("I_rms"), "I_{rms}")
  })

  it("leaves single-character subscripts unchanged", () => {
    assert.equal(fixUnbracedMultiCharSubscripts("I_0"), "I_0")
  })
})

describe("fixUnbracedMultiCharSubscriptsInMath", () => {
  it("fixes subscripts inside dollar-delimited math", () => {
    assert.equal(
      fixUnbracedMultiCharSubscriptsInMath("$P = V_rms I_rms \\cos(36.87°)$"),
      "$P = V_{rms} I_{rms} \\cos(36.87^\\circ)$",
    )
  })
})

describe("normalizeInlineLatex", () => {
  it("repairs bare trig and multiplication shorthand", () => {
    assert.equal(
      normalizeInlineLatex("120 x 10 x sin(36.87°)"),
      "120 \\times 10 \\times \\sin(36.87^\\circ)",
    )
  })
})

describe("enrichHtmlWithKatex", () => {
  it("renders code blocks with V_rms as proper subscript", () => {
    const html = enrichHtmlWithKatex(
      "<code>P = V_rms I_rms cos(36.87°)</code>",
    )
    assert.match(html, /V_\{rms\}/)
    assert.match(html, /I_\{rms\}/)
    assert.doesNotMatch(html, /katex-error/)
  })
})
