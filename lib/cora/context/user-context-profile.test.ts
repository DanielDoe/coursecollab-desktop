import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  formatContextProfilePrompt,
  mergeContextProfileContent,
  type UserContextProfile,
} from "@/lib/cora/context/user-context-profile"

describe("mergeContextProfileContent", () => {
  it("keeps newest facts first and removes exact duplicates", () => {
    const merged = mergeContextProfileContent(
      "Name: Ada Lovelace\nMembership: Scholar\nLegacy fact",
      ["Membership: Scholar", "Goal: review circuits", "Name: Ada Lovelace"],
    )

    assert.equal(
      merged,
      ["Membership: Scholar", "Goal: review circuits", "Name: Ada Lovelace", "Legacy fact"].join("\n"),
    )
  })

  it("caps the merged content by character budget", () => {
    const merged = mergeContextProfileContent("", ["alpha", "beta", "gamma"], 9)
    assert.equal(merged, "alpha")
  })
})

describe("formatContextProfilePrompt", () => {
  it("wraps the profile with the durable context instruction", () => {
    const profile: UserContextProfile = {
      role: "student",
      userId: 7,
      courseId: 3,
      content: "Name: Ada Lovelace\nMembership: Scholar",
      updatedAt: "2026-08-29T00:00:00.000Z",
    }

    const prompt = formatContextProfilePrompt(profile)

    assert.match(prompt, /^USER CONTEXT PROFILE \(durable — built from platform data\):/m)
    assert.match(prompt, /- Name: Ada Lovelace/)
    assert.match(prompt, /- Membership: Scholar/)
    assert.match(
      prompt,
      /If the user asks about something not present in this context or in thread memory, DO NOT guess/,
    )
  })
})
