/**
 * Run: npx tsx --test lib/compliance/production-scan.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isAllowlistedScanPath, scanSourceText } from "@/lib/compliance/production-scan"

describe("production scan", () => {
  it("flags localhost fallbacks in production-capable code", () => {
    const findings = scanSourceText(
      "lib/example.ts",
      `const API_URL = process.env.API_URL || "http://localhost:3000"\n`,
    )
    assert.equal(findings.some((finding) => finding.kind === "localhost_fallback"), true)
  })

  it("flags staging-style hosts", () => {
    const findings = scanSourceText("lib/example.ts", `fetch("https://abc.ngrok.io/api")\n`)
    assert.equal(findings.some((finding) => finding.kind === "prohibited_host"), true)
  })

  it("allows scripts, tests, and example env", () => {
    assert.equal(isAllowlistedScanPath("scripts/e2e-verify-quiz1-hw1-grading.ts"), true)
    assert.equal(isAllowlistedScanPath(".env.example"), true)
    const findings = scanSourceText(
      "scripts/e2e-verify-quiz1-hw1-grading.ts",
      `const baseUrl = process.env.E2E_BASE_URL || "http://localhost:3000"\n`,
    )
    assert.equal(findings.length, 0)
  })
})
