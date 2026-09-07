"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Legacy route — admins have global access; no course picker required. */
export default function AdminSelectCourseRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/admin/dashboard-v2")
  }, [router])
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
