"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { INSTRUCTOR_V2_QUESTION_BANK_PATH } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"

export default function NewQuestionPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace(`${INSTRUCTOR_V2_QUESTION_BANK_PATH}/new`)
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
