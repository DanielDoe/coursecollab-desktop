/**
 * Run: npx tsx --test lib/compliance/rate-limit.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { checkRateLimit } from "@/lib/compliance/rate-limit"
import { assertDestructiveScriptAllowed, isLikelyProductionDatabaseUrl } from "@/lib/compliance/script-safety"
import { REQUIRED_SECURITY_HEADER_NAMES } from "@/lib/compliance/security-headers"

describe("rate limit", () => {
  it("allows traffic under the limit and blocks after", () => {
    const key = `test-${Date.now()}`
    const first = checkRateLimit(key, 2, 60_000, 1_000)
    const second = checkRateLimit(key, 2, 60_000, 1_100)
    const third = checkRateLimit(key, 2, 60_000, 1_200)
    assert.equal(first.ok, true)
    assert.equal(second.ok, true)
    assert.equal(third.ok, false)
  })

  it("resets after the window", () => {
    const key = `reset-${Date.now()}`
    checkRateLimit(key, 1, 1_000, 5_000)
    const later = checkRateLimit(key, 1, 1_000, 6_100)
    assert.equal(later.ok, true)
  })
})

describe("script safety", () => {
  it("blocks destructive scripts in production", () => {
    assert.throws(() =>
      assertDestructiveScriptAllowed({ VERCEL_ENV: "production" }, "seed"),
    )
  })

  it("allows an explicit override", () => {
    assert.doesNotThrow(() =>
      assertDestructiveScriptAllowed(
        { VERCEL_ENV: "production", ALLOW_PRODUCTION_DESTRUCTIVE: "1" },
        "seed",
      ),
    )
  })

  it("does not treat localhost databases as production", () => {
    assert.equal(isLikelyProductionDatabaseUrl("postgresql://u:p@localhost:5432/cc"), false)
    assert.equal(
      isLikelyProductionDatabaseUrl("postgresql://u:p@ep-prod-course-collab.us.aws.neon.tech/neondb"),
      true,
    )
  })
})

describe("security headers", () => {
  it("includes transport and framing protections", () => {
    assert.ok(REQUIRED_SECURITY_HEADER_NAMES.includes("Strict-Transport-Security"))
    assert.ok(REQUIRED_SECURITY_HEADER_NAMES.includes("X-Frame-Options"))
    assert.ok(REQUIRED_SECURITY_HEADER_NAMES.includes("X-Content-Type-Options"))
  })
})
