"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { getStudentData } from "@/lib/auth"
import { StudentCalendar } from "@/components/student-calendar"

export default function DashboardV2CalendarPage() {
  const router = useRouter()
  const [studentId, setStudentId] = useState<string>("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const student = getStudentData()
    if (!student) {
      router.push("/student/login")
      return
    }
    setStudentId(student.databaseId?.toString() || "")
    setMounted(true)
  }, [router])

  if (!mounted || !studentId) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[var(--border)] border-t-[var(--cc-accent)]" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 sm:space-y-5 md:space-y-6 w-full min-w-0 overflow-x-hidden pb-8"
    >
      <StudentCalendar studentId={studentId} embedInDashboard />
    </motion.div>
  )
}
