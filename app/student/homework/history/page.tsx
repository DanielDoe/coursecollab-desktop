"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function StudentHomeworkHistoryRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/student/dashboard-v2/quiz-history")
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 dark:border-slate-700 border-t-primary" />
    </div>
  )
}
