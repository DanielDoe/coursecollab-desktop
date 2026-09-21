/**
 * Run: npx tsx --test lib/document-fullscreen.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isFullscreenFromDocument } from "./document-fullscreen"

describe("isFullscreenFromDocument", () => {
  it("is false when every vendor property is missing (Chrome / Electron)", () => {
    assert.equal(isFullscreenFromDocument({}), false)
  })

  it("is false when every vendor property is null", () => {
    assert.equal(
      isFullscreenFromDocument({
        fullscreenElement: null,
        webkitFullscreenElement: null,
        mozFullScreenElement: null,
        msFullscreenElement: null,
      }),
      false,
    )
  })

  it("does not treat undefined !== null as fullscreen", () => {
    const doc = {
      fullscreenElement: null,
      webkitFullscreenElement: undefined,
      mozFullScreenElement: undefined,
      msFullscreenElement: undefined,
    }
    const buggyCheck =
      doc.fullscreenElement !== null ||
      doc.webkitFullscreenElement !== null ||
      doc.mozFullScreenElement !== null ||
      doc.msFullscreenElement !== null

    assert.equal(buggyCheck, true)
    assert.equal(isFullscreenFromDocument(doc), false)
  })

  it("is true when the standard fullscreen element is set", () => {
    assert.equal(
      isFullscreenFromDocument({
        fullscreenElement: {} as Element,
      }),
      true,
    )
  })

  it("is true when only a prefixed fullscreen element is set", () => {
    assert.equal(
      isFullscreenFromDocument({
        fullscreenElement: null,
        webkitFullscreenElement: {} as Element,
      }),
      true,
    )
  })
})
