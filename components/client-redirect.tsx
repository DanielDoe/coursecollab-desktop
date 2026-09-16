"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Client-side redirect that works in both Next.js and the Vite desktop shell.
 * Prefer this over next/navigation `redirect()` in page modules shared with Electron.
 */
export function ClientRedirect({ href }: { href: string }) {
  const router = useRouter()

  useEffect(() => {
    router.replace(href)
  }, [href, router])

  return (
    <div className="flex min-h-[12rem] items-center justify-center text-sm text-[var(--cc-text-muted)]">
      Redirecting…
    </div>
  )
}
