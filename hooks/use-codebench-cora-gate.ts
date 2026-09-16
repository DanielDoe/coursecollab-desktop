"use client"

import { useCallback, useState } from "react"
import { studentTierHasCodeBenchCoraAccess } from "@/lib/codebench-entitlement-client"
import type { MembershipTier } from "@/lib/membership-constants"

export function useCodebenchCoraGate(tier: MembershipTier | string | null | undefined) {
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [actionLabel, setActionLabel] = useState("this Cora action")
  const coraAccess = studentTierHasCodeBenchCoraAccess(tier)

  const requestCoraAction = useCallback(
    (label: string, run: () => void) => {
      if (!coraAccess) {
        setActionLabel(label)
        setUpgradeOpen(true)
        return false
      }
      run()
      return true
    },
    [coraAccess],
  )

  return {
    coraAccess,
    upgradeOpen,
    actionLabel,
    closeUpgrade: () => setUpgradeOpen(false),
    requestCoraAction,
  }
}
