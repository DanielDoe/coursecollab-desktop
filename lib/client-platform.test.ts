/**
 * Run: npx tsx --test lib/client-platform.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  clientPlatformLabel,
  parseExplicitClientPlatform,
  resolveActivityClientPlatform,
  resolveClientPlatformFromUserAgent,
} from "@/lib/client-platform"

describe("client-platform", () => {
  it("parses explicit platform aliases", () => {
    assert.equal(parseExplicitClientPlatform("mobile"), "mobile")
    assert.equal(parseExplicitClientPlatform("native"), "mobile")
    assert.equal(parseExplicitClientPlatform("electron"), "desktop")
    assert.equal(parseExplicitClientPlatform("pc"), "desktop")
    assert.equal(parseExplicitClientPlatform("browser"), "web")
  })

  it("detects native mobile UA", () => {
    assert.equal(resolveClientPlatformFromUserAgent("CourseCollab-Native/1.0 CFNetwork"), "mobile")
    assert.equal(resolveClientPlatformFromUserAgent("okhttp/4.9.0"), "mobile")
  })

  it("detects desktop Electron UA", () => {
    assert.equal(
      resolveClientPlatformFromUserAgent("Mozilla/5.0 CourseCollab-Desktop Electron/28.0.0"),
      "desktop",
    )
  })

  it("defaults browser UA to web", () => {
    assert.equal(
      resolveClientPlatformFromUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0",
      ),
      "web",
    )
  })

  it("prefers metadata clientPlatform on activity rows", () => {
    assert.equal(
      resolveActivityClientPlatform({
        metadata: { clientPlatform: "desktop" },
        user_agent: "Mozilla/5.0 Chrome/120",
      }),
      "desktop",
    )
  })

  it("labels platforms for admin UI", () => {
    assert.equal(clientPlatformLabel("web"), "Web")
    assert.equal(clientPlatformLabel("mobile"), "Mobile app")
    assert.equal(clientPlatformLabel("desktop"), "Desktop app")
  })
})
