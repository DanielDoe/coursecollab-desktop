/**
 * Run: npx tsx --test lib/admin-api-auth.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { NextRequest } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"

function requestWith(headers: Record<string, string> = {}, url = "https://course-collab.com/api/admin/users") {
  return new NextRequest(url, { headers })
}

describe("admin session identity", () => {
  it("rejects header-only x-admin-id as identity", async () => {
    const result = await requireAdminId(requestWith({ "x-admin-id": "1" }))
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.response.status, 401)
  })

  it("rejects adminId query as identity", async () => {
    const result = await requireAdminId(
      requestWith({}, "https://course-collab.com/api/admin/users?adminId=1"),
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.response.status, 401)
  })

  it("rejects requests with no session", async () => {
    const result = await requireAdminId(requestWith())
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.response.status, 401)
  })
})
