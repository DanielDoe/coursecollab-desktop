/**
 * Run: npx tsx --test lib/lecture-catalog-auth.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { NextRequest } from "next/server"
import { requireLectureCatalogCaller } from "@/lib/lecture-catalog-auth"

function requestWith(headers: Record<string, string> = {}) {
  return new NextRequest("https://course-collab.com/api/lectures", { headers })
}

describe("legacy lecture catalog auth", () => {
  it("rejects unauthenticated GET-style callers", async () => {
    const result = await requireLectureCatalogCaller(requestWith())
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.response.status, 401)
  })

  it("rejects header-only student identity", async () => {
    const result = await requireLectureCatalogCaller(requestWith({ "x-student-id": "722" }))
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.response.status, 401)
  })

  it("rejects header-only instructor identity", async () => {
    const result = await requireLectureCatalogCaller(
      requestWith({ "x-instructor-id": "15", "x-course-id": "16" }),
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.response.status, 401)
  })
})
