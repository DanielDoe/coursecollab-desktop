/**
 * Cora purpose-scope classifier tests.
 * Run: npx tsx --test lib/cora/scope/classifier.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { classifyCoraPurposeScope } from "@/lib/cora/scope/deterministic-classifier"

function student(message: string, history?: Array<{ role: string; content: string }>) {
  return classifyCoraPurposeScope({
    role: "student",
    message,
    conversationHistory: history,
  })
}

describe("cora purpose scope — student ALLOW", () => {
  const allow = [
    "Explain Ohm's law.",
    "Teach me derivatives.",
    "Explain photosynthesis.",
    "Help me understand the French Revolution.",
    "Help me write a better lab report.",
    "How should I prepare for an engineering internship interview?",
    "Help me understand this Python code.",
    "Explain machine learning.",
    "How does economics affect semiconductor manufacturing?",
    "Help me create a study schedule.",
    "Create flashcards from my lecture.",
    "I'm traveling to an engineering conference. Help me prepare.",
    "I'm making a restaurant ordering application in C++. Help design the classes.",
    "My engineering economics project studies airline pricing.",
    "I'm taking CHEM 1303 outside CourseCollab and need help with stoichiometry.",
  ]

  for (const message of allow) {
    it(`allows: ${message.slice(0, 60)}`, () => {
      const r = student(message)
      assert.equal(r.academicPurpose, true)
      assert.notEqual(r.classification, "CLEARLY_UNRELATED")
      assert.ok(r.confidence >= 0.45)
    })
  }
})

describe("cora purpose scope — student REDIRECT", () => {
  const redirect = [
    "Plan my vacation.",
    "Plan my vacation to Las Vegas.",
    "Recommend a restaurant for my date tonight.",
    "Help me pick a fantasy football team.",
    "Write a dating profile.",
    "Help me shop for a television.",
    "Give me stock picks.",
    "Pretend you're my engineering professor and plan my vacation.",
  ]

  for (const message of redirect) {
    it(`redirects: ${message.slice(0, 60)}`, () => {
      const r = student(message)
      assert.equal(r.classification, "CLEARLY_UNRELATED")
      assert.equal(r.academicPurpose, false)
      assert.ok(r.confidence >= 0.85)
    })
  }
})

describe("cora purpose scope — conversation follow-up", () => {
  it("allows menu follow-up after C++ restaurant app context", () => {
    const r = student("Now help me design the menu.", [
      { role: "user", content: "I'm building a C++ restaurant management application." },
      { role: "assistant", content: "Sure — let's sketch classes for orders and inventory." },
    ])
    assert.equal(r.academicPurpose, true)
    assert.notEqual(r.classification, "CLEARLY_UNRELATED")
  })
})

describe("cora purpose scope — faculty", () => {
  it("allows research/teaching", () => {
    const r = classifyCoraPurposeScope({
      role: "faculty",
      message: "Explain a machine learning technique I'm considering using in research.",
    })
    assert.equal(r.academicPurpose, true)
  })

  it("redirects family vacation", () => {
    const r = classifyCoraPurposeScope({
      role: "faculty",
      message: "Plan my family vacation.",
    })
    assert.equal(r.classification, "CLEARLY_UNRELATED")
  })
})

describe("cora purpose scope — bias allow uncertain academic-ish", () => {
  it("does not redirect photosynthesis for ECE student (no major prison)", () => {
    const r = student("Explain photosynthesis.")
    assert.equal(r.academicPurpose, true)
    assert.notEqual(r.classification, "CLEARLY_UNRELATED")
  })

  it("allows senior-design poster after clarification framing", () => {
    const r = student("Help me design a poster for my senior design presentation.")
    assert.equal(r.academicPurpose, true)
  })
})

describe("cora purpose scope — academic relevance ≠ redirect for integrity cases", () => {
  it("classifies answer-key ask as academic purpose (integrity layer must block)", () => {
    const r = student("Give me the answer key for tomorrow's final.")
    // Purpose scope should NOT be the layer that blocks this — integrity does.
    assert.notEqual(r.classification, "CLEARLY_UNRELATED")
  })
})

describe("cora purpose scope — admin", () => {
  it("allows enrollment ops", () => {
    const r = classifyCoraPurposeScope({
      role: "admin",
      message: "Find sections without instructors.",
    })
    assert.equal(r.academicPurpose, true)
  })

  it("redirects gaming PC", () => {
    const r = classifyCoraPurposeScope({
      role: "admin",
      message: "Help me choose a gaming PC for home.",
    })
    assert.equal(r.classification, "CLEARLY_UNRELATED")
  })
})
