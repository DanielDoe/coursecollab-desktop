import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { institutionRequestSpamReason, looksLikeRandomToken } from "@/lib/institutions/request-spam"

describe("institution request spam", () => {
  it("flags the random tokens bots submit", () => {
    assert.equal(looksLikeRandomToken("eQLYgSUqAiUcztvJzbJXf"), true)
    assert.equal(looksLikeRandomToken("cWSRjwSglfqXkuYztxkclP"), true)
    assert.equal(looksLikeRandomToken("XVmNhzbWsafRizyT"), true)
  })

  it("allows real institution and contact names", () => {
    assert.equal(looksLikeRandomToken("Northbrook Engineering College"), false)
    assert.equal(looksLikeRandomToken("Notify wiring check"), false)
    assert.equal(looksLikeRandomToken("Alex Rivera"), false)
    assert.equal(looksLikeRandomToken("Daniel Doe"), false)
    assert.equal(looksLikeRandomToken("CourseCollab"), false)
  })

  it("rejects the bot submissions from the inbox", () => {
    assert.equal(
      institutionRequestSpamReason({
        institutionName: "eQLYgSUqAiUcztvJzbJXf",
        contactName: "eStTqGzmGtEWuBFsUic",
        contactEmail: "c.a.j.i.ye.t.o.95.0@gmail.com",
        domain: "taxEWqfbytpvKqSotQMVT",
        jobTitle: "UTuaMLZRxXdDTJSIxGaNQ",
        department: "sRYipAfLftzmLtTLlmWxY",
        desiredScope: "vPTHjRGegMeuFmitdTRFVI",
      }),
      "stuffed-email",
    )
    assert.equal(
      institutionRequestSpamReason({
        institutionName: "BZMmwwKauuZRBCaYgTOIc",
        contactName: "XVmNhzbWsafRizyT",
        contactEmail: "roji.toqe0.6@gmail.com",
        domain: "pWQfzGaXonuNmlXaQpnQMYdn",
      }),
      "random-token",
    )
  })

  it("allows the real demo and pilot requests", () => {
    assert.equal(
      institutionRequestSpamReason({
        institutionName: "Notify wiring check",
        contactName: "Daniel Doe",
        contactEmail: "danieldoe33@gmail.com",
        domain: "coursecollab.com",
        jobTitle: "Platform creator",
      }),
      null,
    )
    assert.equal(
      institutionRequestSpamReason({
        institutionName: "Northbrook Engineering College",
        contactName: "Alex Rivera",
        contactEmail: "alex.rivera+instws@coursecollab.test",
      }),
      null,
    )
  })
})
