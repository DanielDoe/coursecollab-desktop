"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { AnnouncementsFeedRedesign } from "@/components/announcements-feed-redesign"
import { ModuleListSkeleton } from "@/components/data/module-list-skeleton"

function readStudentId() {
  if (typeof window === "undefined") return ""
  try {
    const databaseId = sessionStorage.getItem("studentDatabaseId")
    if (databaseId) return databaseId
    const raw = localStorage.getItem("studentSession")
    if (!raw) return ""
    const session = JSON.parse(raw) as { databaseId?: string; id?: string }
    return session.databaseId?.toString() || session.id?.toString() || ""
  } catch {
    return ""
  }
}

function readInitialOpenId() {
  if (typeof window === "undefined") return null
  const parsed = Number.parseInt(new URLSearchParams(window.location.search).get("open") || "", 10)
  return Number.isFinite(parsed) ? parsed : null
}

export default function DashboardV2AnnouncementsPage() {
  const router = useRouter()
  const [studentId] = useState(readStudentId)
  const [initialOpenId] = useState(readInitialOpenId)

  useEffect(() => {
    if (!studentId && !localStorage.getItem("studentSession")) {
      router.push("/student/login")
    }
  }, [router, studentId])

  if (!studentId) {
    return <ModuleListSkeleton rows={6} className="min-h-[300px]" />
  }

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 sm:space-y-5 md:space-y-6 w-full min-w-0 pb-8"
    >
      <AnnouncementsFeedRedesign
        studentId={studentId}
        embedInDashboard
        initialOpenId={initialOpenId}
      />
    </motion.div>
  )
}
