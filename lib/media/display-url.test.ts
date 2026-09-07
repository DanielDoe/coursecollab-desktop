import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mediaDisplayUrl } from "./display-url"

describe("mediaDisplayUrl", () => {
  it("adds a width hint for Vercel Blob thumbnails", () => {
    const url = mediaDisplayUrl("https://abc.blob.vercel-storage.com/avatar.png", "thumbnail")
    assert.match(url, /[?&]w=64/)
    assert.match(url, /[?&]q=75/)
  })

  it("leaves originals and data URLs unchanged", () => {
    assert.equal(mediaDisplayUrl("https://abc.blob.vercel-storage.com/x.png", "full"), "https://abc.blob.vercel-storage.com/x.png")
    assert.equal(mediaDisplayUrl("data:image/png;base64,xx", "thumbnail"), "data:image/png;base64,xx")
  })
})
