/** Configurable guardrails against agent loops and spend spikes. */

export type BudgetLimits = {
  maxModelCallsPerRun: number
  maxRetriesPerTool: number
  maxExpensiveModelCallsPerRun: number
  maxCreditsPerRun: number
  maxDailyUserCredits: number
}

export function getBudgetLimits(): BudgetLimits {
  return {
    maxModelCallsPerRun: Number(process.env.CORA_MAX_MODEL_CALLS_PER_RUN ?? 12),
    maxRetriesPerTool: Number(process.env.CORA_MAX_TOOL_RETRIES ?? 2),
    maxExpensiveModelCallsPerRun: Number(process.env.CORA_MAX_EXPENSIVE_MODEL_CALLS ?? 3),
    maxCreditsPerRun: Number(process.env.CORA_MAX_CREDITS_PER_RUN ?? 400),
    maxDailyUserCredits: Number(process.env.CORA_MAX_DAILY_USER_CREDITS ?? 5000),
  }
}

export function isExpensiveModel(model: string | null | undefined): boolean {
  const m = (model || "").toLowerCase()
  return (
    m.includes("gpt-5.4") && !m.includes("mini") && !m.includes("nano") ||
    (m.includes("gpt-5") && !m.includes("mini") && !m.includes("nano") && !m.includes("4o")) ||
    m.includes("claude-opus") ||
    m.includes("claude-sonnet-5")
  )
}

export function assertAgentRunBudget(args: {
  modelCallsSoFar: number
  expensiveModelCallsSoFar: number
  creditsChargedSoFar: number
  nextModel?: string | null
  nextEstimatedCredits?: number
}): { ok: true } | { ok: false; reason: string } {
  const limits = getBudgetLimits()
  if (args.modelCallsSoFar >= limits.maxModelCallsPerRun) {
    return { ok: false, reason: `Agent run exceeded max model calls (${limits.maxModelCallsPerRun}).` }
  }
  if (
    isExpensiveModel(args.nextModel) &&
    args.expensiveModelCallsSoFar >= limits.maxExpensiveModelCallsPerRun
  ) {
    return {
      ok: false,
      reason: `Agent run exceeded max advanced-model calls (${limits.maxExpensiveModelCallsPerRun}).`,
    }
  }
  const next = args.creditsChargedSoFar + (args.nextEstimatedCredits ?? 0)
  if (next > limits.maxCreditsPerRun) {
    return { ok: false, reason: `Agent run would exceed max credits (${limits.maxCreditsPerRun}).` }
  }
  return { ok: true }
}
