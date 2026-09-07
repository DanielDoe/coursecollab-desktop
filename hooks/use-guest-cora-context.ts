"use client"

import { useCallback, useEffect, useState } from "react"
import {
  buildGuestCoraContext,
  runGuestCoraContextSetup,
  type GuestCoraContext,
  type GuestCoraSetupStepId,
} from "@/lib/cora/guest-cora-context"
import {
  isGuestCoraContextStale,
  loadGuestCoraContext,
  saveGuestCoraContext,
} from "@/lib/cora/guest-cora-context-store"
import type { GuestCoraContextPayload } from "@/lib/cora/fetch-guest-context"

export type GuestCoraSetupStatus = "loading" | "running" | "ready" | "error"

export function useGuestCoraContext(options: {
  guestId: string | null | undefined
  guestName?: string
  enabled?: boolean
}) {
  const { guestId, guestName, enabled = true } = options
  const [status, setStatus] = useState<GuestCoraSetupStatus>("loading")
  const [setupStep, setSetupStep] = useState<GuestCoraSetupStepId>("preparing")
  const [context, setContext] = useState<GuestCoraContext | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [setupToken, setSetupToken] = useState(0)

  useEffect(() => {
    if (!enabled || !guestId) {
      setStatus("loading")
      setContext(null)
      return
    }

    setContext((current) => (current?.guestId === guestId ? current : null))
    setStatus("loading")
    setError(null)

    let cancelled = false

    void (async () => {
      const stored = loadGuestCoraContext(guestId)
      if (cancelled) return

      if (stored?.setupComplete && stored.guestId === guestId && setupToken === 0 && !isGuestCoraContextStale(stored)) {
        setContext(stored)
        setStatus("ready")
        return
      }

      setStatus("running")
      setSetupStep("preparing")
      try {
        const built = await runGuestCoraContextSetup(guestId, {
          guestName,
          onStep: (step) => {
            if (!cancelled) setSetupStep(step)
          },
        })
        if (cancelled || built.guestId !== guestId) return
        saveGuestCoraContext(built)
        setContext(built)
        setStatus("ready")
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Could not prepare Cora Career.")
        setStatus("error")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, guestId, guestName, setupToken])

  const retrySetup = useCallback(() => {
    setSetupToken((value) => value + 1)
  }, [])

  const refreshContextIfStale = useCallback(
    async (force = false) => {
      if (!guestId) return null
      const current = context ?? loadGuestCoraContext(guestId)
      if (!force && current && !isGuestCoraContextStale(current)) return current

      try {
        const response = await fetch(
          `/api/guest/cora/context?studentDatabaseId=${encodeURIComponent(guestId)}`,
        )
        if (!response.ok) return current
        const payload = (await response.json()) as GuestCoraContextPayload
        const built = buildGuestCoraContext(guestId, payload, guestName)
        saveGuestCoraContext(built)
        setContext(built)
        return built
      } catch {
        return current
      }
    },
    [guestId, guestName, context],
  )

  return {
    status,
    setupStep,
    context,
    error,
    retrySetup,
    refreshContextIfStale,
  }
}
