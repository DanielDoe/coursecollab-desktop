import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { messageIsOnlyLocalDeviceFile } from "@/lib/direct-messages/local-device-file"

const IOS_PASTE =
  "file:///var/mobile/Library/SMS/Attachments/43/03/5A9B95C7-C4F1-4207-87C5-2D3A92780FBD/Screenshot%202026-09-28%20at%205.38.57%E2%80%AFPM.png Gabreail Givens"

describe("messageIsOnlyLocalDeviceFile", () => {
  it("treats an iPhone screenshot path plus a name as an unuploaded photo", () => {
    assert.equal(messageIsOnlyLocalDeviceFile(IOS_PASTE), true)
  })

  it("keeps a real message that mentions a file path", () => {
    assert.equal(
      messageIsOnlyLocalDeviceFile(
        "I tried to send this but it failed: file:///var/mobile/photo.png. Can you check?",
      ),
      false,
    )
  })

  it("ignores normal text", () => {
    assert.equal(messageIsOnlyLocalDeviceFile("Here is my homework photo"), false)
  })
})
