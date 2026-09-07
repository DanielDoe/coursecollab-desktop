"use client"

import type { QueryClient } from "@tanstack/react-query"
import { CACHE_MUTATED_EVENT, SESSION_RESET_EVENT, type CacheMutatedDetail } from "@/lib/data/types"

const CHANNEL = "cc-query-sync"

export function subscribeQueryCrossTab(queryClient: QueryClient): () => void {
  if (typeof window === "undefined") return () => {}

  const bc = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL) : null

  const onLocalMutated = (event: Event) => {
    const detail = (event as CustomEvent<CacheMutatedDetail>).detail
    bc?.postMessage({ type: "invalidate", prefixes: detail?.prefixes ?? [] })
  }

  const onLocalReset = () => {
    bc?.postMessage({ type: "clear" })
  }

  const onMessage = (event: MessageEvent) => {
    const data = event.data as { type?: string; prefixes?: string[][] } | null
    if (!data) return
    if (data.type === "clear") {
      queryClient.clear()
      return
    }
    if (data.type === "invalidate") {
      for (const prefix of data.prefixes ?? []) {
        void queryClient.invalidateQueries({ queryKey: prefix })
      }
    }
  }

  window.addEventListener(CACHE_MUTATED_EVENT, onLocalMutated)
  window.addEventListener(SESSION_RESET_EVENT, onLocalReset)
  bc?.addEventListener("message", onMessage)

  return () => {
    window.removeEventListener(CACHE_MUTATED_EVENT, onLocalMutated)
    window.removeEventListener(SESSION_RESET_EVENT, onLocalReset)
    bc?.removeEventListener("message", onMessage)
    bc?.close()
  }
}
