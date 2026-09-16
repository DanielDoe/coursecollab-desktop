"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

const TAB_TO_BROWSE: Record<string, string> = {
  analytics: "analytics",
  badges: "badges",
  leaderboard: "leaderboard",
  streak: "streak",
  challenge: "challenge",
  profile: "analytics",
}

export default function CodeBenchMorePage() {
  const router = useRouter()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get("tab") || "analytics"
    const browse = TAB_TO_BROWSE[tab] || "analytics"
    try {
      sessionStorage.setItem("codebench_hub_browse", browse)
    } catch {
      // ignore
    }
    router.replace("/student/dashboard-v2/codebench")
  }, [router])

  return (
    <div className="flex min-h-[320px] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-[var(--cc-accent)]" />
    </div>
  )
}
