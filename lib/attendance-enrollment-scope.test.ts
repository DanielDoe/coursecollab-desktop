/**
 * Run: npx tsx --test lib/attendance-enrollment-scope.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { termStartWithGrace, toDateOnly } from "./attendance-enrollment-scope"

describe("attendance dates", () => {
  it("turns a Date into a calendar day instead of a weekday label", () => {
    const value = new Date(2026, 7, 25, 15, 30)
    assert.equal(toDateOnly(value), "2026-08-25")
    assert.notEqual(String(value).slice(0, 10), "2026-08-25")
  })

  it("rejects a weekday slice that Postgres cannot cast to date", () => {
    assert.equal(toDateOnly("Tue Aug 25"), null)
    assert.equal(termStartWithGrace("Tue Aug 25"), null)
  })

  it("subtracts the grace window from an ISO term start", () => {
    assert.equal(termStartWithGrace("2026-08-25"), "2026-08-11")
  })
})
