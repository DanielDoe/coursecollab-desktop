import { recordUsageEvent } from "@/lib/cora/ai/ledger"
import type { GuestPlan } from "@/lib/guest/types"
import type { RawModelUsage } from "@/lib/cora/ai/types"

export async function recordGuestCoraUsage(args: {
  guestId: number
  plan: GuestPlan
  model: string
  usage: RawModelUsage
  providerCostUsd: number
  creditsCharged: number
  feature?: string
  operation?: string
  toolName?: string
  toolCallsCount?: number
  billable?: boolean
  latencyMs?: number
}): Promise<void> {
  await recordUsageEvent({
    context: {
      actor: {
        userId: args.guestId,
        userRole: "guest",
        membershipTier: args.plan,
      },
      feature: "CHAT",
      module: "guest_cora",
      operation: args.operation ?? args.feature ?? "guest_cora_chat",
      toolName: args.toolName ?? null,
      toolCallsCount: args.toolCallsCount ?? 0,
      billable: args.billable !== false && args.creditsCharged > 0,
    },
    provider: "OPENAI",
    model: args.model,
    usage: args.usage,
    providerCostUsd: args.providerCostUsd,
    creditsCharged: args.creditsCharged,
    latencyMs: args.latencyMs,
  })
}
