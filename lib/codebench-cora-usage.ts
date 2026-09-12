import { NextResponse } from "next/server"
import type { CoraAiFeature, CoraUsageContext } from "@/lib/cora/ai/types"

export function codebenchUsageContext(
  studentDbId: number,
  feature: CoraAiFeature,
  module: string,
): CoraUsageContext {
  return {
    actor: { userId: studentDbId, userRole: "student" },
    feature,
    module,
    billable: true,
  }
}

export function isInsufficientCoraCredits(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : ""
  const message = error instanceof Error ? error.message : ""
  return code === "INSUFFICIENT_CORA_CREDITS" || message === "INSUFFICIENT_CORA_CREDITS"
}

export function insufficientCoraCreditsResponse() {
  return NextResponse.json(
    {
      error: "You've used your Cora credits for this period. Buy a pack or wait for your monthly refresh.",
      creditsInsufficient: true,
    },
    { status: 402 },
  )
}

export function jsonFromCodebenchCoraError(error: unknown, fallback: string) {
  if (isInsufficientCoraCredits(error)) return insufficientCoraCreditsResponse()
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 500 },
  )
}
