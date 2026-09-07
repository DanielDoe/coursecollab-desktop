/**
 * Run: npx tsx --test lib/instructor-grading-auth.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { NextRequest } from "next/server"
import { requireInstructorGradingAccess } from "@/lib/instructor-grading-auth"

function requestWith(headers: Record<string, string> = {}) {
  return new NextRequest("https://course-collab.com/api/instructor/re-evaluate-attempt", {
    headers,
  })
}

describe("instructor grading identity", () => {
  it("rejects header-only x-admin-id privilege escalation", async () => {
    const result = await requireInstructorGradingAccess(requestWith({ "x-admin-id": "1" }))
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.response.status, 401)
  })

  it("rejects header-only x-instructor-id as identity", async () => {
    const result = await requireInstructorGradingAccess(requestWith({ "x-instructor-id": "15" }))
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.response.status, 401)
  })
})
