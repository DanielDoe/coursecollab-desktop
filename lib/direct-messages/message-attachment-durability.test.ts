import { describe, expect, it } from "node:test"
import {
  isPersistedMessageAttachmentUrl,
  validateMessageAttachmentInput,
} from "@/lib/direct-messages/attachments"
import { composerCanSend } from "@/lib/direct-messages/upload-message-attachment-client"

describe("message attachment durability helpers", () => {
  it("rejects blob and data URLs", () => {
    expect(isPersistedMessageAttachmentUrl("blob:abc")).toBe(false)
    expect(isPersistedMessageAttachmentUrl("data:image/png;base64,aa")).toBe(false)
    expect(
      isPersistedMessageAttachmentUrl(
        "https://example.blob.vercel-storage.com/messages/1/file.jpg",
      ),
    ).toBe(true)
  })

  it("validateMessageAttachmentInput requires https fileUrl", () => {
    expect(validateMessageAttachmentInput({ fileName: "a.jpg", fileUrl: "blob:x" })).toMatch(/upload/)
  })

  it("composerCanSend blocks in-flight uploads", () => {
    expect(
      composerCanSend("<p>hi</p>", [
        {
          fileName: "x.jpg",
          fileUrl: "",
          mimeType: "image/jpeg",
          fileSize: 1,
          uploadState: "uploading",
        },
      ]),
    ).toBe(false)
  })
})
