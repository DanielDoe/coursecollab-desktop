"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { CalendarCheck, History, TrendingUp } from "lucide-react"
import { StudentModuleHubLayout } from "@/components/student/dashboard-v2/StudentModuleHubLayout"
import {
  ATTENDANCE_HUB_BASE,
  resolveAttendanceBrowseId,
  type AttendanceBrowseId,
} from "@/components/student/dashboard-v2/AttendanceBrowseNav"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { formatKpiPercent } from "@/lib/dashboard-v2/format-kpi-value"

export function AttendanceBrowseShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const activeId = resolveAttendanceBrowseId(pathname)

  const [metaLoading, setMetaLoading] = useState(true)
  const [section, setSection] = useState("")
  const [attendancePct, setAttendancePct] = useState<number | null>(null)
  const [classesAttended, setClassesAttended] = useState<number | null>(null)
  const [totalClasses, setTotalClasses] = useState<number | null>(null)

  const loadMeta = useCallback(async () => {
    const student = getStudentData()
    if (!student?.databaseId) {
      setMetaLoading(false)
      return
    }

    setSection(student.section || "")
    try {
      const res = await studentApiFetch(
        `/api/attendance/score?studentId=${encodeURIComponent(student.databaseId)}`,
        {
          headers: {
            "x-student-id": student.databaseId,
            "x-student-session": student.section,
          },
        },
      )
      if (res.ok) {
        const data = await res.json()
        const att = data.attendance ?? {}
        setAttendancePct(Number(att.attendance_percentage ?? 0))
        setClassesAttended(Number(att.classes_attended ?? 0))
        setTotalClasses(Number(att.sessions_scored_so_far ?? att.total_classes ?? 0))
      }
    } catch {
      // Header meta is optional; sub-pages still load their own data.
    } finally {
      setMetaLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMeta()
  }, [loadMeta])

  const onMenuSelect = (id: string) => {
    const map: Record<AttendanceBrowseId, string> = {
      overview: ATTENDANCE_HUB_BASE,
      history: `${ATTENDANCE_HUB_BASE}/history`,
      analytics: `${ATTENDANCE_HUB_BASE}/analytics`,
    }
    router.push(map[id as AttendanceBrowseId] ?? ATTENDANCE_HUB_BASE)
  }

  const metaLine = metaLoading ? (
    <span className="inline-block h-4 w-56 animate-pulse rounded bg-[var(--muted)]" />
  ) : section ? (
    <>
      Section {section}
      {totalClasses != null && totalClasses > 0
        ? ` · ${formatKpiPercent(attendancePct ?? 0)} · ${classesAttended ?? 0}/${totalClasses} sessions`
        : " · check in when your instructor opens attendance"}
    </>
  ) : (
    "Track check-ins, session history, and insights"
  )

  return (
    <StudentModuleHubLayout
      moduleId="attendance"
      scrollMode="page"
      title="Attendance"
      metaLine={metaLine}
      metaSuffix="check in, track sessions, and view insights"
      menuView={activeId}
      onMenuSelect={onMenuSelect}
      menuItems={[
        { id: "overview", label: "Home", icon: CalendarCheck },
        { id: "history", label: "Session log", icon: History },
        {
          id: "analytics",
          label: "Insights",
          icon: TrendingUp,
          badge:
            totalClasses != null && totalClasses > 0 ? totalClasses : undefined,
        },
      ]}
    >
      {children}
    </StudentModuleHubLayout>
  )
}
