import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isAuthPublicPath } from "./session-restore-guard"

describe("isAuthPublicPath", () => {
  it("treats login and university picker as public auth surfaces", () => {
    assert.equal(isAuthPublicPath("/auth/student"), true)
    assert.equal(isAuthPublicPath("/auth/university"), true)
    assert.equal(isAuthPublicPath("/faculty/login"), true)
    assert.equal(isAuthPublicPath("/student/login/summer-camp"), true)
  })

  it("does not treat dashboard routes as auth surfaces", () => {
    assert.equal(isAuthPublicPath("/student/dashboard-v2"), false)
    assert.equal(isAuthPublicPath("/faculty/dashboard"), false)
    assert.equal(isAuthPublicPath("/instructor/dashboard-v2"), false)
  })
})
