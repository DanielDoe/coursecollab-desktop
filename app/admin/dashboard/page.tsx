"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Legacy admin dashboard → v2 shell */
export default function AdminDashboardRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/admin/dashboard-v2")
  }, [router])
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
