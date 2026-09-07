import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isBlockedFetchUrl } from "@/lib/compliance/ssrf"
import { isSafeAppRedirect, sanitizeAppRedirect } from "@/lib/compliance/safe-redirect"
import { clampPageSize } from "@/lib/compliance/pagination"
import { redactObject } from "@/lib/compliance/log-redact"
import { requireCronAuth } from "@/lib/compliance/cron-auth"
import { scanTextForSecrets } from "@/lib/compliance/client-secret-scan"
import { passwordResetAcceptedResponse } from "@/lib/compliance/password-reset-public"
import { assertUploadAllowed } from "@/lib/compliance/upload-policy"

describe("ssrf and redirects", () => {
  it("blocks private and metadata hosts", () => {
    assert.equal(isBlockedFetchUrl("http://127.0.0.1/secret"), true)
    assert.equal(isBlockedFetchUrl("http://169.254.169.254/latest/meta-data"), true)
    assert.equal(isBlockedFetchUrl("file:///etc/passwd"), true)
    assert.equal(isBlockedFetchUrl("https://course-collab.com/privacy"), false)
  })

  it("rejects open redirects", () => {
    assert.equal(isSafeAppRedirect("https://evil.example/phish"), false)
    assert.equal(isSafeAppRedirect("/student/dashboard-v2"), true)
    assert.equal(sanitizeAppRedirect("https://evil.example"), "/")
  })
})

describe("pagination and redaction", () => {
  it("clamps huge page sizes", () => {
    assert.equal(clampPageSize(999999999), 100)
  })

  it("redacts secrets from log objects", () => {
    const redacted = redactObject({
      password: "secret",
      authorization: "Bearer abc",
      note: "ok",
    })
    assert.equal(redacted.password, "[redacted]")
    assert.equal(redacted.authorization, "[redacted]")
    assert.equal(redacted.note, "ok")
  })
})

describe("cron auth", () => {
  it("fails closed in production without CRON_SECRET", () => {
    const request = new Request("https://course-collab.com/api/cron/x")
    const result = requireCronAuth(request, { VERCEL_ENV: "production" })
    assert.equal(result.ok, false)
  })

  it("accepts a matching bearer token", () => {
    const request = new Request("https://course-collab.com/api/cron/x", {
      headers: { authorization: "Bearer cron-secret" },
    })
    const result = requireCronAuth(request, { CRON_SECRET: "cron-secret" })
    assert.equal(result.ok, true)
  })
})

describe("password reset and uploads", () => {
  it("uses a generic accepted response", () => {
    const body = passwordResetAcceptedResponse()
    assert.equal(body.success, true)
    assert.match(body.message, /If an account exists/)
  })

  it("rejects oversized or disallowed uploads", () => {
    assert.equal(assertUploadAllowed("profile_image", { size: 1000, mime: "image/png" }), null)
    assert.ok(assertUploadAllowed("profile_image", { size: 20_000_000, mime: "image/png" }))
    assert.ok(assertUploadAllowed("profile_image", { size: 1000, mime: "application/x-msdownload" }))
  })
})

describe("client secret scan", () => {
  it("flags live Stripe secrets and ignores placeholders", () => {
    const hits = scanTextForSecrets(
      "app/page.tsx",
      `const key = "sk_live_51abcdefghijklmnopqrstu"\nconst demo = "sk_live_example"`,
    )
    assert.ok(hits.some((hit) => hit.kind === "stripe_secret"))
    assert.equal(hits.length, 1)
  })
})
