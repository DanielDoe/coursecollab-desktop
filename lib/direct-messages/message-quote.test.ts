import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildQuotedReply, parseMessageQuote } from "./message-quote"

describe("message quotes", () => {
  it("keeps the quoted message separate from the reply", () => {
    const stored = buildQuotedReply(
      "Efren Gutierrez",
      "If I get the trail blazer thing can I retake the mid term?",
    )
    const parsed = parseMessageQuote(`${stored}Mid semesters and finals do not have retakes.`)
    assert.equal(parsed.quote?.senderName, "Efren Gutierrez")
    assert.match(parsed.quote?.excerpt ?? "", /trail blazer/)
    assert.equal(parsed.reply, "Mid semesters and finals do not have retakes.")
    assert.doesNotMatch(parsed.reply, /^>/)
  })

  it("reads older quotes that only used angle brackets", () => {
    const parsed = parseMessageQuote("> If I get the trail blazer thing\n> can I retake it\n\nNo retakes.")
    assert.equal(parsed.quote?.senderName, null)
    assert.match(parsed.quote?.excerpt ?? "", /trail blazer/)
    assert.equal(parsed.reply, "No retakes.")
  })

  it("leaves a normal message alone", () => {
    const parsed = parseMessageQuote("See you at office hours.")
    assert.equal(parsed.quote, null)
    assert.equal(parsed.reply, "See you at office hours.")
  })
})
