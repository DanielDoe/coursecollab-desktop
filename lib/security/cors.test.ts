/**
 * Run: npx tsx --test lib/security/cors.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  corsAllowOriginValue,
  isAllowedCorsOrigin,
  isBlockedCrossOriginMutation,
} from "@/lib/security/cors"

const prod = { VERCEL_ENV: "production", NODE_ENV: "production" } as NodeJS.ProcessEnv

describe("CORS allowlist", () => {
  it("does not reflect arbitrary origins", () => {
    assert.equal(corsAllowOriginValue("https://evil.example", prod), null)
    assert.equal(isAllowedCorsOrigin("*", prod), false)
  })

  it("allows CourseCollab production origins", () => {
    assert.equal(isAllowedCorsOrigin("https://course-collab.com", prod), true)
    assert.ok(corsAllowOriginValue("https://www.course-collab.com", prod))
  })

  it("blocks credentialed mutations from unknown origins", () => {
    assert.equal(isBlockedCrossOriginMutation("POST", "https://evil.example", prod), true)
    assert.equal(isBlockedCrossOriginMutation("POST", "https://course-collab.com", prod), false)
    assert.equal(isBlockedCrossOriginMutation("POST", null, prod), false)
    assert.equal(isBlockedCrossOriginMutation("GET", "https://evil.example", prod), false)
  })
})
