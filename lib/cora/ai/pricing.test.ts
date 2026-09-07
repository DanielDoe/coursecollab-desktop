/**
 * Unit tests for Cora AI pricing / credit conversion (no DB).
 * Run: npx tsx --test lib/cora/ai/pricing.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  calculateProviderCostUsd,
  providerCostToCoraCredits,
  resolveModelPrice,
  estimateCacheSavingsUsd,
} from "@/lib/cora/ai/pricing"

describe("cora ai pricing", () => {
  it("uses versioned mini rates", () => {
    const price = resolveModelPrice("gpt-5.4-mini", "OPENAI", new Date("2026-06-01"))
    assert.equal(price.inputCostPerMillion, 0.75)
    assert.equal(price.cachedInputCostPerMillion, 0.075)
  })

  it("calculates provider cost with cached discount", () => {
    const cost = calculateProviderCostUsd({
      model: "gpt-5.4-mini",
      usage: {
        inputTokens: 10_000,
        cachedInputTokens: 8_000,
        outputTokens: 1_000,
        reasoningTokens: 0,
        totalTokens: 11_000,
      },
      timestamp: new Date("2026-06-01"),
    })
    // uncached 2k * 0.75/M + cached 8k * 0.075/M + out 1k * 4.5/M
    const expected = (2000 / 1e6) * 0.75 + (8000 / 1e6) * 0.075 + (1000 / 1e6) * 4.5
    assert.ok(Math.abs(cost - expected) < 1e-9)
  })

  it("converts cost to integer credits with minimum", () => {
    const credits = providerCostToCoraCredits(0.001, { applyMinimum: true })
    assert.ok(credits >= 5)
  })

  it("estimates cache savings", () => {
    const savings = estimateCacheSavingsUsd({
      model: "gpt-5.4-mini",
      cachedInputTokens: 1_000_000,
      timestamp: new Date("2026-06-01"),
    })
    assert.ok(Math.abs(savings - (0.75 - 0.075)) < 1e-9)
  })

  it("does not charge when not billable", () => {
    assert.equal(providerCostToCoraCredits(1.5, { billable: false }), 0)
  })

  it("applies the premium minimum when provider usage is missing", () => {
    assert.ok(providerCostToCoraCredits(0, { applyMinimum: true }) >= 5)
  })
})
