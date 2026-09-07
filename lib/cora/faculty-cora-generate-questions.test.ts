/**
 * Run: npx tsx --test lib/cora/faculty-cora-generate-questions.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { extractTypeMixFromPrompt } from "@/lib/cora/faculty-cora-generate-questions"

describe("extractTypeMixFromPrompt", () => {
  it("parses 6 MCQ / 3 T/F / 3 select-all", () => {
    const mix = extractTypeMixFromPrompt(
      "Use 6 multiple-choice, 3 true/false, and 3 select-all questions.",
    )
    assert.deepEqual(
      Object.fromEntries(mix.map((m) => [m.type, m.count])),
      { mcq: 6, true_false: 3, select_all: 3 },
    )
  })
})
