import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { prospectShortName, prospectSlug } from "@/lib/institutions/workspace"

describe("institution prospect keys", () => {
  it("builds a unique-ish short name from the institution", () => {
    const a = prospectShortName("Prairie View A&M University")
    const b = prospectShortName("Prairie View A&M University")
    assert.match(a, /^PRAIRIEV[A-Z0-9]+$/)
    assert.notEqual(a, b)
    assert.ok(a.length <= 32)
  })

  it("builds a slug suitable for universities.slug", () => {
    const slug = prospectSlug("University of Houston")
    assert.match(slug, /^university-of-houston-[a-z0-9]+$/)
    assert.ok(slug.length <= 128)
  })
})
