"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Redirect legacy instructor routes into dashboard v2. */
export function LegacyFacultyRedirect({ href }: { href: string }) {
  const router = useRouter()

  useEffect(() => {
    router.replace(href)
  }, [router, href])

  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
    </div>
  )
}
