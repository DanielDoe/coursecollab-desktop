/**
 * Run: npx tsx --test lib/instructor-session-auth.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { NextRequest } from "next/server"
import { requireInstructorSession } from "@/lib/instructor-session-auth"

function requestWith(headers: Record<string, string> = {}) {
  return new NextRequest("https://course-collab.com/api/instructor/lectures", {
    headers,
  })
}

describe("instructor session identity", () => {
  it("rejects header-only x-instructor-id as identity", async () => {
    const result = await requireInstructorSession(requestWith({ "x-instructor-id": "15" }))
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.response.status, 401)
  })

  it("rejects requests with no session and no header", async () => {
    const result = await requireInstructorSession(requestWith())
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.response.status, 401)
  })
})
