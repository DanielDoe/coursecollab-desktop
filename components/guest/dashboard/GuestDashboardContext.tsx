"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { getStudentData } from "@/lib/auth"
import type { GuestCapability, GuestPlan } from "@/lib/guest/types"
import type { GuestCoraBalanceLevel } from "@/lib/guest/membership-config"

type GuestEntitlementsSnapshot = {
  plan: GuestPlan
  capabilities: GuestCapability[]
  credits: number | null
  balanceLevel: GuestCoraBalanceLevel | null
  loading: boolean
}

type GuestDashboardContextValue = {
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  coraImmersive: boolean
  setCoraImmersive: (on: boolean) => void
  entitlements: GuestEntitlementsSnapshot
  refreshEntitlements: () => Promise<void>
}

const GuestDashboardContext = createContext<GuestDashboardContextValue | null>(null)

export function GuestDashboardProvider({ children }: { children: ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [coraImmersive, setCoraImmersive] = useState(false)
  const [entitlements, setEntitlements] = useState<GuestEntitlementsSnapshot>({
    plan: "guest_free",
    capabilities: [],
    credits: null,
    balanceLevel: null,
    loading: true,
  })

  const refreshEntitlements = useCallback(async () => {
    const d = getStudentData()
    if (!d?.databaseId) {
      setEntitlements((prev) => ({ ...prev, loading: false }))
      return
    }
    try {
      const res = await fetch(
        `/api/guest/entitlements?studentDatabaseId=${encodeURIComponent(d.databaseId)}`,
      )
      const json = await res.json()
      if (res.ok) {
        const rawPlan = String(json.plan ?? "guest_free")
        const plan: GuestPlan =
          rawPlan === "cora_career" || rawPlan === "cora_career_essentials"
            ? rawPlan
            : "guest_free"
        setEntitlements({
          plan,
          capabilities: Array.isArray(json.capabilities) ? json.capabilities : [],
          credits:
            typeof json.coraCredits?.available === "number" ? json.coraCredits.available : null,
          balanceLevel: json.coraCredits?.balanceLevel ?? null,
          loading: false,
        })
      } else {
        setEntitlements((prev) => ({ ...prev, loading: false }))
      }
    } catch {
      setEntitlements((prev) => ({ ...prev, loading: false }))
    }
  }, [])

  useEffect(() => {
    void refreshEntitlements()
  }, [refreshEntitlements])

  return (
    <GuestDashboardContext.Provider
      value={{
        mobileSidebarOpen,
        setMobileSidebarOpen,
        sidebarCollapsed,
        setSidebarCollapsed,
        coraImmersive,
        setCoraImmersive,
        entitlements,
        refreshEntitlements,
      }}
    >
      {children}
    </GuestDashboardContext.Provider>
  )
}

export function useGuestDashboard() {
  const ctx = useContext(GuestDashboardContext)
  return (
    ctx ?? {
      mobileSidebarOpen: false,
      setMobileSidebarOpen: () => {},
      sidebarCollapsed: false,
      setSidebarCollapsed: () => {},
      coraImmersive: false,
      setCoraImmersive: () => {},
      entitlements: {
        plan: "guest_free" as GuestPlan,
        capabilities: [] as GuestCapability[],
        credits: null,
        balanceLevel: null,
        loading: true,
      },
      refreshEntitlements: async () => {},
    }
  )
}
