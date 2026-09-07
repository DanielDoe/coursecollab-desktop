"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Redirect to Help Center in Learning Center (no Profile/Settings tabs) */
export default function SettingsHelpRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/admin/dashboard-v2/learning-center/help")
  }, [router])
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="w-8 h-8 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
