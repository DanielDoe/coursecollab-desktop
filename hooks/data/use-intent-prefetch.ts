"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"
import { createHoverPrefetch, isPrefetchableHref } from "@/lib/data/prefetch"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"
import { prefetchPageModule } from "@/src/router/page-resolver"

export function useIntentPrefetch() {
  const queryClient = useQueryClient()
  const hover = useMemo(() => createHoverPrefetch(queryClient), [queryClient])
  return {
    onIntentEnter: (href: string) => {
      if (isDesktopAppShell()) {
        const path = href.split("?")[0] ?? href
        prefetchPageModule(path)
      }
      if (isPrefetchableHref(href)) hover.onEnter(href)
    },
    onIntentLeave: hover.onLeave,
  }
}
