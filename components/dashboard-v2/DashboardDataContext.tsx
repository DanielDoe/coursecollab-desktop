"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { buildAdminApiHeaders } from "@/lib/admin-api-headers"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { getStudentData } from "@/lib/auth"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { fetchStudentDashboardStats, mapCamperHubToStats } from "@/lib/dashboard-v2/student-stats-client"
import type {
  AdminDashboardStats,
  CamperDashboardStats,
  DashboardActivityItem,
  DashboardPortal,
  FacultyDashboardStats,
  StudentDashboardStats,
} from "@/lib/dashboard-v2/types"

type CamperHubData = Record<string, unknown>

type DashboardDataContextValue = {
  loading: boolean
  adminStats: AdminDashboardStats | null
  facultyStats: FacultyDashboardStats | null
  studentStats: StudentDashboardStats | null
  camperStats: CamperDashboardStats | null
  camperHub: CamperHubData | null
  recentActivity: DashboardActivityItem[]
  portal: DashboardPortal
}

const DashboardDataContext = createContext<DashboardDataContextValue | null>(null)

function getStudentSessionIds() {
  const student = getStudentData()
  const dbId =
    student?.databaseId ??
    (typeof window !== "undefined" ? sessionStorage.getItem("studentDatabaseId") : null)
  const displayId =
    student?.id ??
    (typeof window !== "undefined" ? sessionStorage.getItem("studentId") : null) ??
    dbId
  const section =
    student?.section ??
    (typeof window !== "undefined" ? sessionStorage.getItem("studentSection") : null) ??
    "ALL"
  return { dbId, displayId, section }
}

export function DashboardDataProvider({
  portal,
  children,
}: {
  portal: DashboardPortal
  children: ReactNode
}) {
  const instructorCtx = useInstructorDashboardV2()
  const courseScopeVersion =
    portal === "admin" || portal === "faculty" ? instructorCtx.courseScopeVersion : 0
  const [loading, setLoading] = useState(true)
  const [adminStats, setAdminStats] = useState<AdminDashboardStats | null>(null)
  const [facultyStats, setFacultyStats] = useState<FacultyDashboardStats | null>(null)
  const [studentStats, setStudentStats] = useState<StudentDashboardStats | null>(null)
  const [camperStats, setCamperStats] = useState<CamperDashboardStats | null>(null)
  const [camperHub, setCamperHub] = useState<CamperHubData | null>(null)
  const [recentActivity, setRecentActivity] = useState<DashboardActivityItem[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        if (portal === "admin") {
          const [statsRes, activityRes] = await Promise.all([
            fetch("/api/admin/dashboard/stats", { headers: buildAdminApiHeaders() }),
            fetch("/api/admin/recent-activity", { headers: buildAdminApiHeaders() }),
          ])
          if (cancelled) return
          if (statsRes.ok) {
            const { stats } = await statsRes.json()
            setAdminStats(stats)
          }
          if (activityRes.ok) {
            const data = await activityRes.json()
            setRecentActivity(data.recentActivity ?? data.activities ?? [])
          }
          setFacultyStats(null)
          setStudentStats(null)
          setCamperStats(null)
          setCamperHub(null)
        } else if (portal === "faculty") {
          const [statsRes, activityRes] = await Promise.all([
            instructorApiFetch("/api/instructor/dashboard/stats", { headers: buildInstructorApiHeaders() }),
            instructorApiFetch("/api/instructor/recent-activity", { headers: buildInstructorApiHeaders() }),
          ])
          if (cancelled) return
          if (statsRes.ok) {
            const payload = await statsRes.json()
            const stats = payload.stats as FacultyDashboardStats
            if (payload.scope) {
              stats.scopeTermLabel = payload.scope.termLabel ?? null
              stats.scopeSessionCode = payload.scope.sessionCode ?? null
            }
            setFacultyStats(stats)
          }
          if (activityRes.ok) {
            const data = await activityRes.json()
            setRecentActivity(data.recentActivity ?? [])
          }
          setAdminStats(null)
          setStudentStats(null)
          setCamperStats(null)
          setCamperHub(null)
        } else if (portal === "student") {
          const { dbId, displayId, section } = getStudentSessionIds()
          if (!dbId) {
            setStudentStats(null)
          } else {
            const stats = await fetchStudentDashboardStats(dbId, displayId ?? dbId, section ?? "ALL")
            if (!cancelled) setStudentStats(stats)
          }
          if (!cancelled) {
            setAdminStats(null)
            setFacultyStats(null)
            setCamperStats(null)
            setCamperHub(null)
            setRecentActivity([])
          }
        } else if (portal === "camper") {
          const { dbId } = getStudentSessionIds()
          if (!dbId) {
            setCamperStats(null)
            setCamperHub(null)
          } else {
            const res = await fetch(`/api/summer-camp/dashboard?studentDatabaseId=${encodeURIComponent(dbId)}`)
            if (res.ok) {
              const hub = await res.json()
              if (!cancelled) {
                setCamperHub(hub)
                setCamperStats(mapCamperHubToStats(hub))
              }
            } else if (!cancelled) {
              setCamperStats(null)
              setCamperHub(null)
            }
          }
          if (!cancelled) {
            setAdminStats(null)
            setFacultyStats(null)
            setStudentStats(null)
            setRecentActivity([])
          }
        }
      } catch {
        if (!cancelled) {
          setAdminStats(null)
          setFacultyStats(null)
          setStudentStats(null)
          setCamperStats(null)
          setCamperHub(null)
          setRecentActivity([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [portal, courseScopeVersion])

  const value = useMemo(
    () => ({
      loading,
      adminStats,
      facultyStats,
      studentStats,
      camperStats,
      camperHub,
      recentActivity,
      portal,
    }),
    [loading, adminStats, facultyStats, studentStats, camperStats, camperHub, recentActivity, portal],
  )

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>
}

export function useDashboardData() {
  const ctx = useContext(DashboardDataContext)
  if (!ctx) throw new Error("useDashboardData must be used within DashboardDataProvider")
  return ctx
}
