"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function SettingsPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/admin/dashboard-v2/settings/profile")
  }, [router])
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="w-8 h-8 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
