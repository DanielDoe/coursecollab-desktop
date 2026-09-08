import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createAuthRoutePushVariants, isDesktopAuthRoute } from "./route-transition"

describe("isDesktopAuthRoute", () => {
  it("matches login and onboarding auth surfaces only", () => {
    assert.equal(isDesktopAuthRoute("/auth/welcome"), true)
    assert.equal(isDesktopAuthRoute("/auth/university"), true)
    assert.equal(isDesktopAuthRoute("/auth/student"), true)
    assert.equal(isDesktopAuthRoute("/faculty/login"), true)
    assert.equal(isDesktopAuthRoute("/admin/login"), true)
    assert.equal(isDesktopAuthRoute("/student/login/guest"), true)
  })

  it("does not match signed-in dashboard or module routes", () => {
    assert.equal(isDesktopAuthRoute("/student/dashboard-v2"), false)
    assert.equal(isDesktopAuthRoute("/student/dashboard-v2/codebench"), false)
    assert.equal(isDesktopAuthRoute("/student/dashboard-v2/codebench/ide"), false)
    assert.equal(isDesktopAuthRoute("/student/dashboard-v2/trade-center"), false)
    assert.equal(isDesktopAuthRoute("/faculty/dashboard"), false)
    assert.equal(isDesktopAuthRoute("/faculty/dashboard/assessments/grades"), false)
    assert.equal(isDesktopAuthRoute("/instructor/dashboard-v2"), false)
    assert.equal(isDesktopAuthRoute("/admin/dashboard-v2"), false)
  })
})

describe("createAuthRoutePushVariants", () => {
  it("disables pointer events on exiting auth panes during slide transitions", () => {
    const variants = createAuthRoutePushVariants(false)
    const exit = variants.exit as (direction: "forward" | "back" | "none") => Record<string, unknown>

    assert.equal(exit("forward").pointerEvents, "none")
    assert.equal(exit("back").pointerEvents, "none")
  })

  it("keeps entering auth panes interactive", () => {
    const variants = createAuthRoutePushVariants(false)
    const animate = variants.animate as Record<string, unknown>

    assert.equal(animate.pointerEvents, "auto")
  })

  it("disables pointer events on reduced-motion exit as well", () => {
    const variants = createAuthRoutePushVariants(true)
    const exit = variants.exit as Record<string, unknown>

    assert.equal(exit.pointerEvents, "none")
  })
})
