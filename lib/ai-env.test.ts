import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  remapRetiredAnthropicModelId,
  resolveAnthropicModelId,
} from "./ai-env"

describe("ai-env retired Anthropic models", () => {
  it("remaps retired Sonnet 4 snapshot ids", () => {
    assert.equal(
      remapRetiredAnthropicModelId("claude-sonnet-4-20250514"),
      "claude-sonnet-4-6",
    )
  })

  it("resolveAnthropicModelId remaps env-backed retired defaults", () => {
    const previous = process.env.ANTHROPIC_DEFAULT_MODEL
    process.env.ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-4-20250514"
    try {
      assert.equal(resolveAnthropicModelId(), "claude-sonnet-4-6")
      assert.equal(resolveAnthropicModelId("claude-sonnet-4-20250514"), "claude-sonnet-4-6")
    } finally {
      if (previous === undefined) delete process.env.ANTHROPIC_DEFAULT_MODEL
      else process.env.ANTHROPIC_DEFAULT_MODEL = previous
    }
  })
})
