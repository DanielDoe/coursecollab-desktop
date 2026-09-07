"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { getMessageAuthHeaders } from "@/lib/direct-messages/client"
import type { ParticipantKind } from "@/lib/direct-messages/types"
import { presenceKey, type PresenceMap, type PresenceStatus } from "@/lib/presence/types"
import type { ManualPresenceStatus } from "@/lib/presence/types"

type LastSeenMap = Record<string, string | null>
type ManualStatusMap = Record<string, ManualPresenceStatus | null>

type ParticipantRef = { kind: ParticipantKind; id: number }

export function usePresenceTracking(participants: ParticipantRef[]) {
  const [statuses, setStatuses] = useState<PresenceMap>({})
  const [lastSeenAt, setLastSeenAt] = useState<LastSeenMap>({})
  const [manualStatuses, setManualStatuses] = useState<ManualStatusMap>({})

  const keys = useMemo(() => {
    const unique = new Map<string, ParticipantRef>()
    for (const p of participants) {
      unique.set(presenceKey(p.kind, p.id), p)
    }
    return [...unique.values()]
  }, [participants])

  const keysParam = useMemo(
    () => keys.map((p) => presenceKey(p.kind, p.id)).join(","),
    [keys],
  )

  const refresh = useCallback(async () => {
    if (keys.length === 0) {
      setStatuses({})
      setLastSeenAt({})
      setManualStatuses({})
      return
    }
    try {
      const res = await fetch(`/api/presence/batch?keys=${encodeURIComponent(keysParam)}`, {
        headers: getMessageAuthHeaders(),
      })
      if (!res.ok) return
      const data = (await res.json()) as {
        statuses?: PresenceMap
        lastSeenAt?: LastSeenMap
        manualStatuses?: ManualStatusMap
      }
      setStatuses(data.statuses ?? {})
      setLastSeenAt(data.lastSeenAt ?? {})
      setManualStatuses(data.manualStatuses ?? {})
    } catch {
      /* ignore */
    }
  }, [keys.length, keysParam])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), 30_000)
    const onPresenceUpdated = () => void refresh()
    const onFocus = () => void refresh()
    window.addEventListener("coursecollab-presence-updated", onPresenceUpdated)
    window.addEventListener("focus", onFocus)
    return () => {
      window.clearInterval(id)
      window.removeEventListener("coursecollab-presence-updated", onPresenceUpdated)
      window.removeEventListener("focus", onFocus)
    }
  }, [refresh])

  const getStatus = useCallback(
    (kind: ParticipantKind, id: number): PresenceStatus | undefined => statuses[presenceKey(kind, id)],
    [statuses],
  )

  const getLastSeenAt = useCallback(
    (kind: ParticipantKind, id: number): string | null | undefined => lastSeenAt[presenceKey(kind, id)],
    [lastSeenAt],
  )

  const getManualStatus = useCallback(
    (kind: ParticipantKind, id: number): ManualPresenceStatus | null | undefined =>
      manualStatuses[presenceKey(kind, id)],
    [manualStatuses],
  )

  return { statuses, lastSeenAt, manualStatuses, getStatus, getLastSeenAt, getManualStatus, refresh }
}

export { usePresenceHeartbeat } from "@/components/presence/PresenceSelfProvider"
