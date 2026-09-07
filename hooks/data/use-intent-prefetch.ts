"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"
import { createHoverPrefetch, isPrefetchableHref } from "@/lib/data/prefetch"

export function useIntentPrefetch() {
  const queryClient = useQueryClient()
  const hover = useMemo(() => createHoverPrefetch(queryClient), [queryClient])
  return {
    onIntentEnter: (href: string) => {
      if (isPrefetchableHref(href)) hover.onEnter(href)
    },
    onIntentLeave: hover.onLeave,
  }
}
