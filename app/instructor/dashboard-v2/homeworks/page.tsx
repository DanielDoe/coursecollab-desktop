"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function HomeworksRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/instructor/dashboard-v2/assessments/homework")
  }, [router])
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
