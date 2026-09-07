import type { CoraPhase } from "@/lib/cora/step-engine/types"

/** Map legacy step kinds → universal problem-solving phases. */
export function phaseForStep(index: number, total: number, kind?: string): CoraPhase {
  const k = String(kind ?? "").toLowerCase()
  if (k === "summary") return "reflect"
  if (k === "check") return "verify"
  if (k === "setup" || k === "concept") return index === 0 ? "analyze" : "plan"
  if (k === "code") return "solve"
  if (k === "hint") return "plan"

  const ratio = total <= 1 ? 0 : index / (total - 1)
  if (ratio < 0.2) return "analyze"
  if (ratio < 0.45) return "plan"
  if (ratio < 0.8) return "solve"
  if (ratio < 0.95) return "verify"
  return "reflect"
}

export const PHASE_LABELS: Record<CoraPhase, string> = {
  problem: "Problem",
  analyze: "Analyze",
  plan: "Plan",
  solve: "Solve",
  verify: "Verify",
  reflect: "Reflect",
}

export { type CoraPhase } from "@/lib/cora/step-engine/types"
