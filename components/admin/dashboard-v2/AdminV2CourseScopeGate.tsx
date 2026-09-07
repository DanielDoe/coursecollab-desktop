"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { getPortalConfig } from "@/lib/portal-config"
import { PortalWorkspaceLoading } from "@/components/dashboard-v2/PortalWorkspaceLoading"

/** Admin v2: auth only — no required course selection (global access to all courses). */
export function AdminV2CourseScopeGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const cfg = getPortalConfig("admin")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem(cfg.sessionStorageKey)
    if (!raw) {
      router.replace(cfg.loginPath)
      return
    }
    try {
      JSON.parse(raw)
    } catch {
      router.replace(cfg.loginPath)
      return
    }
    setReady(true)
  }, [router, cfg.loginPath, cfg.sessionStorageKey])

  if (!ready) {
    return (
      <PortalWorkspaceLoading
        subtitle="Admin workspace"
        title="Loading admin portal"
        detail="Verifying session…"
      />
    )
  }

  return <>{children}</>
}
