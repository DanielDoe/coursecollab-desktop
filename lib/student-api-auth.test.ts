/**
 * Run: npx tsx --test lib/student-api-auth.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { NextRequest } from "next/server"
import {
  requireBoundStudentCaller,
  requireCallerStudentDbId,
  requireStudentIdParamMatchesCaller,
} from "@/lib/student-api-auth"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"

function requestWith(headers: Record<string, string> = {}) {
  return new NextRequest("https://course-collab.com/api/grades/student?studentId=722", {
    headers,
  })
}

describe("student session identity", () => {
  it("rejects requests with no session and no header", async () => {
    const result = await requireCallerStudentDbId(requestWith())
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.response.status, 401)
  })

  it("rejects header-only x-student-id as identity", async () => {
    const result = await requireStudentIdParamMatchesCaller(
      requestWith({ "x-student-id": "722" }),
      "722",
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.response.status, 401)
  })

  it("rejects unauthenticated finals-style caller binding", async () => {
    const result = await requireBoundStudentCaller(requestWith(), "722")
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.response.status, 401)
  })

  it("rejects membership/info style param match without a session", async () => {
    const result = await requireStudentIdParamMatchesCaller(
      new NextRequest("https://course-collab.com/api/student/membership?studentId=722", {
        headers: { "x-student-id": "722" },
      }),
      "722",
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.response.status, 401)
  })

  it("rejects CodeBench analytics without a student session", async () => {
    const result = await requireCodebenchStudent(
      new NextRequest("https://course-collab.com/api/codebench/badges?studentId=722", {
        headers: { "x-student-id": "722" },
      }),
      "722",
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.response.status, 401)
  })

  it("rejects CodeBench analytics with no claimed id and no session", async () => {
    const result = await requireCodebenchStudent(
      new NextRequest("https://course-collab.com/api/codebench/streak"),
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.response.status, 401)
  })
})
