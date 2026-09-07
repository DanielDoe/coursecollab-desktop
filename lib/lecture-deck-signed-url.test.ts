/**
 * Run: npx tsx --test lib/lecture-deck-signed-url.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  applySignedLectureDeckUrls,
  isDirectLectureAssetUrl,
  signStudentLectureDeckToken,
  verifyStudentLectureDeckToken,
} from "@/lib/lecture-deck-signed-url"

describe("signed lecture deck URLs", () => {
  it("accepts a fresh token and rejects a tampered one", () => {
    const token = signStudentLectureDeckToken({ lectureId: 98, studentDbId: 722 })
    assert.equal(
      verifyStudentLectureDeckToken({
        lectureId: 98,
        studentDbId: 722,
        exp: token.exp,
        sig: token.sig,
      }),
      true,
    )
    assert.equal(
      verifyStudentLectureDeckToken({
        lectureId: 99,
        studentDbId: 722,
        exp: token.exp,
        sig: token.sig,
      }),
      false,
    )
  })

  it("replaces public blob URLs and leaves already-signed paths alone", () => {
    const redacted = applySignedLectureDeckUrls(
      {
        id: 98,
        pdf_url: "https://example.public.blob.vercel-storage.com/deck.pdf",
        title: "Week 1",
      },
      { studentDbId: 722, origin: "https://course-collab.com" },
    )
    assert.match(String(redacted.pdf_url), /\/api\/student\/lectures\/98\/deck\?/)
    assert.equal(String(redacted.pdf_url).includes("blob.vercel-storage.com"), false)
    assert.equal(isDirectLectureAssetUrl(redacted.pdf_url), false)
  })
})
