"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"

const DEFAULT_RESULTS_HREF = `${FACULTY_DASHBOARD_BASE}/results`

/** Legacy assessment queue routes → Course Analytics (/results). */
export function RedirectToCourseAnalytics({ href = DEFAULT_RESULTS_HREF }: { href?: string }) {
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
