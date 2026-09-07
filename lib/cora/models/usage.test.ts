/**
 * Run: npx tsx --test lib/cora/models/usage.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { CORA_CREDITS_PER_USD, CORA_MIN_PREMIUM_CREDITS } from "@/lib/cora/credits/economy"
import { hashCoraActionKey } from "@/lib/cora/models/idempotency"
import { tokensToUsdCost } from "@/lib/cora/credits/economy"
import { normalizeCoraModelUsage } from "@/lib/cora/models/usage"

describe("normalizeCoraModelUsage", () => {
  it("converts provider tokens to USD then Cora Credits", () => {
    const usage = normalizeCoraModelUsage({
      provider: "openai",
      model: "gpt-5.4-mini",
      profile: "standard",
      usage: {
        inputTokens: 1_000_000,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        totalTokens: 1_000_000,
      },
      userRole: "student",
      latencyMs: 12,
      success: true,
    })
    assert.ok(usage.estimatedProviderCostUsd > 0)
    const expectedCredits = Math.max(
      CORA_MIN_PREMIUM_CREDITS,
      Math.ceil(usage.estimatedProviderCostUsd * CORA_CREDITS_PER_USD),
    )
    assert.equal(usage.creditsCharged, expectedCredits)
  })

  it("counts fallback and verification flags without double-charging in the normalizer", () => {
    const usage = normalizeCoraModelUsage({
      provider: "anthropic",
      model: "claude-sonnet-5",
      profile: "verifier",
      usage: {
        inputTokens: 100,
        cachedInputTokens: 0,
        outputTokens: 50,
        reasoningTokens: 0,
        totalTokens: 150,
      },
      userRole: "instructor",
      latencyMs: 40,
      success: true,
      fallbackUsed: true,
      verificationUsed: true,
      toolRounds: 3,
    })
    assert.equal(usage.fallbackUsed, true)
    assert.equal(usage.verificationUsed, true)
    assert.equal(usage.toolRounds, 3)
    assert.ok(usage.creditsCharged >= CORA_MIN_PREMIUM_CREDITS)
  })

  it("does not charge failed empty provider calls a premium minimum when apply path has no tokens", () => {
    const usage = normalizeCoraModelUsage({
      provider: "openai",
      model: "gpt-5.4-mini",
      profile: "standard",
      usage: {
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        totalTokens: 0,
      },
      userRole: "student",
      latencyMs: 8,
      success: false,
    })
    assert.equal(usage.creditsCharged, 0)
  })
})

describe("idempotency", () => {
  it("hashes confirm keys stably", () => {
    const key = hashCoraActionKey({ userId: 9, tool: "announcement.publish", actionId: "cora_test_1" })
    assert.equal(
      key,
      hashCoraActionKey({ userId: 9, tool: "announcement.publish", actionId: "cora_test_1" }),
    )
    assert.notEqual(
      key,
      hashCoraActionKey({ userId: 9, tool: "announcement.publish", actionId: "cora_test_2" }),
    )
  })
})

describe("economy estimates use the versioned price table", () => {
  it("prices Claude Haiku above zero", () => {
    const usd = tokensToUsdCost({
      model: "claude-haiku-4.5",
      inputTokens: 1_000_000,
      outputTokens: 0,
    })
    assert.ok(usd > 0)
  })
})
