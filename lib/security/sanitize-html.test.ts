/**
 * Run: npx tsx --test lib/security/sanitize-html.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { sanitizeStoredContent, sanitizeUserHtml } from "@/lib/security/sanitize-html"

describe("HTML sanitizer", () => {
  it("strips script tags and event handlers", () => {
    const dirty = `<p onclick="alert(1)">Hi</p><script>alert(1)</script>`
    const clean = sanitizeUserHtml(dirty)
    assert.equal(clean.includes("<script"), false)
    assert.equal(clean.toLowerCase().includes("onclick"), false)
    assert.equal(clean.includes("Hi"), true)
  })

  it("blocks javascript: URLs", () => {
    const clean = sanitizeUserHtml(`<a href="javascript:alert(1)">x</a>`)
    assert.equal(/javascript:/i.test(clean), false)
  })

  it("leaves plain markdown unchanged", () => {
    const md = "## Title\n\n**bold**"
    assert.equal(sanitizeStoredContent(md), md)
  })
})
