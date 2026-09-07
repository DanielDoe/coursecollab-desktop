import type { AccountLifecycleStatus } from "@/lib/access-governance/types"

const PENDING_LIFECYCLES = new Set<AccountLifecycleStatus>([
  "pending_approval",
  "pending_email_verification",
])

const REJECTED_LIFECYCLES = new Set<AccountLifecycleStatus>([
  "rejected",
  "suspended",
  "deactivated",
])

export function accessStatusPagePath(lifecycle: AccountLifecycleStatus): string | null {
  if (PENDING_LIFECYCLES.has(lifecycle)) return "/auth/access-pending"
  if (REJECTED_LIFECYCLES.has(lifecycle)) return "/auth/access-rejected"
  return null
}

export function lifecycleMatchesPendingPage(lifecycle: AccountLifecycleStatus): boolean {
  return PENDING_LIFECYCLES.has(lifecycle)
}

export function lifecycleMatchesRejectedPage(lifecycle: AccountLifecycleStatus): boolean {
  return REJECTED_LIFECYCLES.has(lifecycle)
}
