"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Loader2 } from "lucide-react"

/**
 * Renders children only after mount so WebView pages avoid SSR/client hydration mismatches
 * (framer-motion, sessionStorage, native layout branches).
 * Always start unmounted — native WebViews inject __COURSE_COLLAB_NATIVE__ before hydrate.
 */
export function NotetakerClientGate({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div
        data-notetaker-native-root
        className="flex min-h-[40vh] items-center justify-center p-8"
      >
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" aria-hidden />
      </div>
    )
  }

  return <div data-notetaker-native-root className="min-h-0">{children}</div>
}
