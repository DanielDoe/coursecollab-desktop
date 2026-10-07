import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  leaveShouldReleaseHolder,
  liveHoldBlocksJoin,
  type LiveEditorHoldSnapshot,
} from "./codebench-live-handoff"

const now = 1_000_000
const fresh: LiveEditorHoldSnapshot = { clientId: "phone-client", seenAtMs: now - 2_000, left: false }

describe("liveHoldBlocksJoin", () => {
  it("lets the device that already holds the editor refresh its join", () => {
    assert.equal(
      liveHoldBlocksJoin({ hold: fresh, myClientId: "phone-client", now, claim: false }),
      false,
    )
  })

  it("asks before a second device takes a live classroom", () => {
    assert.equal(
      liveHoldBlocksJoin({ hold: fresh, myClientId: "desktop-client", now, claim: false }),
      true,
    )
  })

  it("moves the session when the student confirms", () => {
    assert.equal(
      liveHoldBlocksJoin({ hold: fresh, myClientId: "desktop-client", now, claim: true }),
      false,
    )
  })

  it("ignores a holder that already left or went quiet", () => {
    assert.equal(
      liveHoldBlocksJoin({ hold: { ...fresh, left: true }, myClientId: "desktop-client", now, claim: false }),
      false,
    )
    assert.equal(
      liveHoldBlocksJoin({
        hold: { ...fresh, seenAtMs: now - 30_000 },
        myClientId: "desktop-client",
        now,
        claim: false,
      }),
      false,
    )
    assert.equal(liveHoldBlocksJoin({ hold: null, myClientId: "desktop-client", now, claim: false }), false)
  })

  it("lets the editor already in the room stamp a seat that has no device yet", () => {
    assert.equal(
      liveHoldBlocksJoin({
        hold: { clientId: null, seenAtMs: now - 1_000, left: false },
        myClientId: "desktop-client",
        now,
        claim: false,
      }),
      false,
    )
  })
})

describe("leaveShouldReleaseHolder", () => {
  it("releases when this device still holds the editor", () => {
    assert.equal(leaveShouldReleaseHolder("phone-client", "phone-client"), true)
    assert.equal(leaveShouldReleaseHolder(null, "phone-client"), true)
  })

  it("does not clear the session after it moved to another device", () => {
    assert.equal(leaveShouldReleaseHolder("desktop-client", "phone-client"), false)
    assert.equal(leaveShouldReleaseHolder("desktop-client", null), false)
  })
})
