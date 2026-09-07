/**
 * Run: npx tsx --test lib/trade-center-student-access.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { NextRequest } from "next/server"
import {
  requireAuthenticatedStudentFromRequest,
  requireAuthenticatedStudentTradeAccess,
} from "@/lib/trade-center-student-access"

function requestWith(headers: Record<string, string> = {}) {
  return new NextRequest("https://course-collab.com/api/trade-center/points?studentId=722", {
    headers,
  })
}

describe("trade-center student session bind", () => {
  it("rejects header-only x-student-id as identity", async () => {
    const result = await requireAuthenticatedStudentFromRequest(
      requestWith({ "x-student-id": "722" }),
      "722",
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.status, 401)
  })

  it("rejects unauthenticated caller with no header", async () => {
    const result = await requireAuthenticatedStudentFromRequest(requestWith())
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.status, 401)
  })

  it("rejects header-only trade access before session membership", async () => {
    const result = await requireAuthenticatedStudentTradeAccess(
      requestWith({ "x-student-id": "722" }),
      "722",
      "ECE2202",
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.status, 401)
  })
})
