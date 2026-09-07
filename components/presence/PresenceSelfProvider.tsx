"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { getMessageAuthHeaders } from "@/lib/direct-messages/client"
import { MANUAL_PRESENCE_OPTIONS } from "@/lib/presence/constants"
import { presenceLabel } from "@/components/presence/PresenceAvatar"
import type { ManualPresenceStatus, PresenceStatus } from "@/lib/presence/types"

type PresenceSelfContextValue = {
  status: PresenceStatus
  manualStatus: ManualPresenceStatus | null
  statusLabel: string
  setStatus: (next: ManualPresenceStatus) => Promise<void>
  resetStatus: () => Promise<void>
  refresh: () => Promise<void>
}

const PresenceSelfContext = createContext<PresenceSelfContextValue | null>(null)

function authHeaders(): HeadersInit {
  return { ...getMessageAuthHeaders(), "Content-Type": "application/json" }
}

export function PresenceSelfProvider({ children }: { children: ReactNode }) {
  const [status, setStatusState] = useState<PresenceStatus>("offline")
  const [manualStatus, setManualStatus] = useState<ManualPresenceStatus | null>(null)

  const applyPresence = useCallback(
    (record?: { status: PresenceStatus; manualStatus: ManualPresenceStatus | null }) => {
      if (!record) return
      setStatusState(record.status)
      setManualStatus(record.manualStatus)
      window.dispatchEvent(new CustomEvent("coursecollab-presence-updated", { detail: record }))
    },
    [],
  )

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/presence", { headers: getMessageAuthHeaders() })
      if (!res.ok) return
      const data = (await res.json()) as {
        presence?: { status: PresenceStatus; manualStatus: ManualPresenceStatus | null }
      }
      applyPresence(data.presence)
    } catch {
      /* ignore */
    }
  }, [applyPresence])

  const heartbeat = useCallback(async () => {
    try {
      const res = await fetch("/api/presence", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ heartbeat: true }),
      })
      if (!res.ok) return
      const data = (await res.json()) as {
        presence?: { status: PresenceStatus; manualStatus: ManualPresenceStatus | null }
      }
      applyPresence(data.presence)
    } catch {
      /* ignore */
    }
  }, [applyPresence])

  const setStatus = useCallback(
    async (next: ManualPresenceStatus) => {
      const res = await fetch("/api/presence", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) return
      const data = (await res.json()) as {
        presence?: { status: PresenceStatus; manualStatus: ManualPresenceStatus | null }
      }
      applyPresence(data.presence)
    },
    [applyPresence],
  )

  const resetStatus = useCallback(async () => {
    const res = await fetch("/api/presence", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ reset: true }),
    })
    if (!res.ok) return
    const data = (await res.json()) as {
      presence?: { status: PresenceStatus; manualStatus: ManualPresenceStatus | null }
    }
    applyPresence(data.presence)
  }, [applyPresence])

  useEffect(() => {
    void refresh()
    void heartbeat()

    let id: number | null = null
    const startHeartbeat = () => {
      if (id != null) return
      id = window.setInterval(() => {
        if (!document.hidden) void heartbeat()
      }, 60_000)
    }
    const stopHeartbeat = () => {
      if (id == null) return
      window.clearInterval(id)
      id = null
    }
    const onVisibility = () => {
      if (document.hidden) {
        stopHeartbeat()
      } else {
        void heartbeat()
        startHeartbeat()
      }
    }

    startHeartbeat()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      stopHeartbeat()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [refresh, heartbeat])

  const statusLabel = useMemo(() => {
    const manual = MANUAL_PRESENCE_OPTIONS.find((o) => o.value === manualStatus)
    return manual?.label ?? presenceLabel(status)
  }, [manualStatus, status])

  const value = useMemo(
    () => ({ status, manualStatus, statusLabel, setStatus, resetStatus, refresh }),
    [status, manualStatus, statusLabel, setStatus, resetStatus, refresh],
  )

  return <PresenceSelfContext.Provider value={value}>{children}</PresenceSelfContext.Provider>
}

export function useSelfPresence(): PresenceSelfContextValue {
  const ctx = useContext(PresenceSelfContext)
  if (!ctx) {
    return {
      status: "offline",
      manualStatus: null,
      statusLabel: "Offline",
      setStatus: async () => {},
      resetStatus: async () => {},
      refresh: async () => {},
    }
  }
  return ctx
}

/** @deprecated use PresenceSelfProvider + useSelfPresence */
export function usePresenceHeartbeat() {
  useSelfPresence()
}
