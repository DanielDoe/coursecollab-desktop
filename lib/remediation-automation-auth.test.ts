/**
 * Run: npx tsx --test lib/remediation-automation-auth.test.ts
 */
import assert from "node:assert/strict"
import { describe, it, beforeEach, afterEach } from "node:test"
import { NextRequest } from "next/server"
import { resolveRemediationAutomationActor } from "@/lib/remediation-automation-auth"

function requestWith(headers: Record<string, string> = {}) {
  return new NextRequest("https://course-collab.com/api/admin/system-logs/stats", { headers })
}

describe("remediation automation auth", () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    delete process.env.REMEDIATION_AGENT_SECRET
    delete process.env.REMEDIATION_ADMIN_ID
  })

  afterEach(() => {
    process.env = env
  })

  it("accepts matching x-remediation-secret", () => {
    process.env.REMEDIATION_AGENT_SECRET = "test-secret"
    const result = resolveRemediationAutomationActor(
      requestWith({ "x-remediation-secret": "test-secret" }),
    )
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.actorId, "cursor-automation")
  })

  it("accepts x-admin-id matching default REMEDIATION_ADMIN_ID", () => {
    const result = resolveRemediationAutomationActor(requestWith({ "x-admin-id": "1" }))
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.actorId, "admin:1")
  })

  it("accepts x-admin-id matching configured REMEDIATION_ADMIN_ID", () => {
    process.env.REMEDIATION_ADMIN_ID = "42"
    const result = resolveRemediationAutomationActor(requestWith({ "x-admin-id": "42" }))
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.actorId, "admin:42")
  })

  it("rejects mismatched x-admin-id", () => {
    process.env.REMEDIATION_ADMIN_ID = "42"
    const result = resolveRemediationAutomationActor(requestWith({ "x-admin-id": "1" }))
    assert.equal(result.ok, false)
  })

  it("rejects requests with no automation credentials", () => {
    const result = resolveRemediationAutomationActor(requestWith())
    assert.equal(result.ok, false)
  })
})
