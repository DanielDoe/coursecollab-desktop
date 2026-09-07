/**
 * Run: npx tsx --test lib/require-student-lecture-auth.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { NextRequest } from "next/server"
import { requireStudentLectureCaller } from "@/lib/require-student-lecture-auth"

function requestWith(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers })
}

describe("student lecture caller", () => {
  it("rejects query-only studentId as identity", async () => {
    const result = await requireStudentLectureCaller(
      requestWith("https://course-collab.com/api/student/lectures?studentId=910000001"),
      "910000001",
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.response.status, 401)
  })

  it("rejects header-only x-student-id as identity", async () => {
    const result = await requireStudentLectureCaller(
      requestWith("https://course-collab.com/api/student/lectures/98/progress", {
        "x-student-id": "722",
      }),
      "910000001",
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.response.status, 401)
  })
})
