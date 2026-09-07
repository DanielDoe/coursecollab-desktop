"use client"

import { QueryClientProvider } from "@tanstack/react-query"
import { useEffect, useState, type ReactNode } from "react"
import { createAppQueryClient } from "@/lib/data/query-client"
import { subscribeQueryCrossTab } from "@/lib/data/cross-tab"
import { SESSION_RESET_EVENT } from "@/lib/data/types"
import { recordDataMetric } from "@/lib/data/metrics"
import { installClientPerfObserver } from "@/lib/perf/client-observer"

export function AppQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createAppQueryClient)

  useEffect(() => {
    installClientPerfObserver()
    const onReset = () => {
      client.clear()
    }
    window.addEventListener(SESSION_RESET_EVENT, onReset)
    const unsubscribe = subscribeQueryCrossTab(client)
    const unsubCache = client.getQueryCache().subscribe((event) => {
      if (event.type === "observerResultsUpdated" && event.query.state.fetchStatus === "fetching") {
        recordDataMetric("query.start", { key: event.query.queryHash })
      }
    })
    const unsubMut = client.getMutationCache().subscribe((event) => {
      if (event.type === "updated") {
        const status = event.mutation.state.status
        if (status === "pending") recordDataMetric("mutation.start")
        if (status === "success") recordDataMetric("mutation.success")
        if (status === "error") recordDataMetric("mutation.error")
      }
    })
    return () => {
      window.removeEventListener(SESSION_RESET_EVENT, onReset)
      unsubscribe()
      unsubCache()
      unsubMut()
    }
  }, [client])

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
