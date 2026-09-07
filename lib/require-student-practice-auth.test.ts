/**
 * Run: npx tsx --test lib/require-student-practice-auth.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { NextRequest } from "next/server"
import {
  requirePracticeAttemptOwnership,
  requireStudentPracticeCaller,
} from "@/lib/require-student-practice-auth"

function requestWith(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers })
}

describe("student practice caller", () => {
  it("rejects query-only studentId as identity", async () => {
    const result = await requireStudentPracticeCaller(
      requestWith("https://course-collab.com/api/practice/topics-progress?studentId=910000001"),
      "910000001",
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.response.status, 401)
  })

  it("rejects header-only x-student-id as identity", async () => {
    const result = await requireStudentPracticeCaller(
      requestWith("https://course-collab.com/api/practice/history", {
        "x-student-id": "722",
      }),
      "910000001",
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.response.status, 401)
  })
})

describe("practice attempt ownership", () => {
  it("rejects unauthenticated ownership checks", async () => {
    const result = await requirePracticeAttemptOwnership(
      requestWith("https://course-collab.com/api/practice/evaluate"),
      1,
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.response.status, 401)
  })

  it("rejects header-only ownership checks", async () => {
    const result = await requirePracticeAttemptOwnership(
      requestWith("https://course-collab.com/api/student/practice/submit", {
        "x-student-id": "910000001",
      }),
      1,
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.response.status, 401)
  })

  it("rejects invalid attempt ids before querying", async () => {
    const result = await requirePracticeAttemptOwnership(
      requestWith("https://course-collab.com/api/practice/evaluate"),
      0,
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.response.status, 400)
  })
})
