"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { CourseSyllabusPanel } from "@/components/syllabus/CourseSyllabusPanel"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"

export default function DashboardV2SyllabusPage() {
  const router = useRouter()
  const [studentId, setStudentId] = useState("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const studentSession = localStorage.getItem("studentSession")
    if (!studentSession) {
      router.push("/student/login")
      return
    }
    try {
      const session = JSON.parse(studentSession)
      const databaseId = sessionStorage.getItem("studentDatabaseId")
      setStudentId(databaseId || session.databaseId?.toString() || session.id?.toString() || "")
    } catch {
      router.push("/student/login")
    } finally {
      setMounted(true)
    }
  }, [router])

  if (!mounted || !studentId) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--cc-accent)]" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-[calc(100dvh-9rem)] w-full min-w-0 flex-col overflow-hidden"
    >
      <EmbedModuleCard className="flex min-h-0 flex-1 flex-col">
        <CourseSyllabusPanel
          courseId={0}
          mode="student"
          fetchUrl="/api/student/syllabus"
          studentId={studentId}
          buildHeaders={() => ({ "x-student-id": studentId })}
        />
      </EmbedModuleCard>
    </motion.div>
  )
}
