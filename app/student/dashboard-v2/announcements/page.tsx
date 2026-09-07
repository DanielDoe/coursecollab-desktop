"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"
import { ModuleListSkeleton } from "@/components/data/module-list-skeleton"

const AnnouncementsDashboardV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/AnnouncementsDashboardV2").then((m) => ({
      default: m.AnnouncementsDashboardV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[420px]" /> },
)

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

  return (
    <StudentDashboardModulePage>
      {studentId ? (
        <AnnouncementsDashboardV2 studentId={studentId} initialOpenId={initialOpenId} />
      ) : (
        <ModuleListSkeleton rows={6} className="min-h-[300px]" />
      )}
    </StudentDashboardModulePage>
  )
}
