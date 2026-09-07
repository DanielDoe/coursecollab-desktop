/**
 * Unit tests for Cora dynamic task classification (no API keys required).
 * Run: npx tsx --test lib/cora/ai/dynamic-router.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  classifyCoraTaskComplexity,
  classifyCoraTaskDomain,
} from "@/lib/cora/ai/dynamic-router"

describe("classifyCoraTaskDomain", () => {
  it("routes coding / debugging to code", () => {
    assert.equal(
      classifyCoraTaskDomain("Please debug this TypeScript stack trace and refactor the API route"),
      "code",
    )
    assert.equal(classifyCoraTaskDomain("```ts\nfunction foo() {}\n```"), "code")
  })

  it("routes creative design / brainstorming to creative", () => {
    assert.equal(
      classifyCoraTaskDomain("Help me brainstorm a creative pitch and tagline for our UX poster"),
      "creative",
    )
  })

  it("routes short syllabus lookups to lightweight", () => {
    assert.equal(classifyCoraTaskDomain("When is the homework due date?"), "lightweight")
  })

  it("routes explain/tutor phrasing to teaching", () => {
    assert.equal(
      classifyCoraTaskDomain("Can you explain this concept and walk me through it like a lesson?"),
      "teaching",
    )
  })
})

describe("classifyCoraTaskComplexity", () => {
  it("marks short greetings as simple", () => {
    assert.equal(classifyCoraTaskComplexity("hi"), "simple")
    assert.equal(classifyCoraTaskComplexity("thanks"), "simple")
  })

  it("marks long multi-step / architecture asks as complex", () => {
    const long =
      "Design a comprehensive end-to-end production architecture from scratch for a distributed concurrent system, optimize performance and memory leaks, and prove that the race conditions are resolved with formal trade-offs."
    assert.equal(classifyCoraTaskComplexity(long), "complex")
  })

  it("defaults medium for typical tutoring asks", () => {
    assert.equal(
      classifyCoraTaskComplexity(
        "I am stuck on this homework problem about linked lists and need a clearer walkthrough of insert and delete without rewriting my whole solution from scratch.",
      ),
      "medium",
    )
  })
})
