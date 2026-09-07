import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

const here = dirname(fileURLToPath(import.meta.url))
import {
  displayPlaygroundSessionQuestion,
  indexPlaygroundSnapshotsByBankId,
  mergePlaygroundQuestionSnapshot,
  parsePlaygroundQuestionSnapshot,
} from "./playground-session-question-snapshot"

describe("playground session question snapshots", () => {
  it("parses a mobile session-copy payload", () => {
    const snapshot = parsePlaygroundQuestionSnapshot({
      bankQuestionId: 900,
      questionText: "State Ohm's law",
      questionType: "mcq",
      difficulty: "easy",
      topic: "Circuits",
      options: ["V = IR", "P = IV"],
      correctAnswer: "V = IR",
      explanation: "Session-only wording",
    })
    assert.equal(snapshot?.bankQuestionId, 900)
    assert.equal(snapshot?.questionText, "State Ohm's law")
    assert.deepEqual(snapshot?.options, ["V = IR", "P = IV"])
  })

  it("indexes incoming snapshots and prefers them over a stored copy", () => {
    const incoming = indexPlaygroundSnapshotsByBankId([
      { bankQuestionId: 900, questionText: "Edited copy", options: ["A", "B"] },
    ])
    const existing = parsePlaygroundQuestionSnapshot({
      bank_question_id: 900,
      questionText: "Old copy",
      options: ["A", "B"],
    })
    const merged = mergePlaygroundQuestionSnapshot(incoming.get(900), existing ?? undefined)
    assert.equal(merged?.questionText, "Edited copy")
    assert.equal(mergePlaygroundQuestionSnapshot(undefined, existing ?? undefined)?.questionText, "Old copy")
  })

  it("displays snapshot fields over the live Question Bank row", () => {
    const displayed = displayPlaygroundSessionQuestion({
      question_text: "Bank prompt",
      snapshot_question_text: "Session prompt",
      question_type: "mcq",
      options: ["Bank A", "Bank B"],
      snapshot_options: ["Session A", "Session B"],
      correct_answer: "Bank A",
      snapshot_correct_answer: "Session A",
      explanation: "Bank",
      snapshot_explanation: "Session",
    })
    assert.equal(displayed.questionText, "Session prompt")
    assert.deepEqual(displayed.options, ["Session A", "Session B"])
    assert.equal(displayed.correctAnswer, "Session A")
    assert.equal(displayed.explanation, "Session")
  })

  it("web session editor edits a session copy and sends snapshots", () => {
    const source = readFileSync(
      join(here, "../components/instructor-playground-management.tsx"),
      "utf8",
    )
    assert.match(source, /openSnapshotEditor/)
    assert.match(source, /Save for this session/)
    assert.match(source, /questions: editorQuestions.map/)
    assert.doesNotMatch(source, /updateQuestionBankQuestion/)
  })

  it("faculty questions PUT persists the questions snapshot array", () => {
    const source = readFileSync(
      join(here, "../app/api/instructor/playground/sessions/[sessionId]/questions/route.ts"),
      "utf8",
    )
    assert.match(source, /indexPlaygroundSnapshotsByBankId\(questions\)/)
    assert.match(source, /snapshot_question_text/)
    assert.match(source, /ensurePlaygroundQuestionSnapshotColumns/)
  })
})
