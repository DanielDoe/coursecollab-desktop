"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Calendar,
  QrCode,
  BarChart3,
  Users,
  Settings,
  TrendingUp,
  Trash2,
  BookOpen,
} from "lucide-react"
import { QRGenerator } from "@/components/attendance/qr-generator"
import { InstructorAttendanceConfig } from "@/components/attendance/instructor-attendance-config"
import { InstructorAttendanceAnalytics } from "@/components/attendance/instructor-attendance-analytics"
import { InstructorAttendanceManagement } from "@/components/attendance/instructor-attendance-management"
import { InstructorAttendanceGradebook } from "@/components/attendance/instructor-attendance-gradebook"
import { InstructorAttendanceOverview } from "@/components/attendance/instructor-attendance-overview"
import { AttendanceTrash } from "@/components/attendance/attendance-trash"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"

type MenuTab = "overview" | "configure" | "qr-code" | "analytics" | "management" | "gradebook" | "trash"

interface InstructorAttendanceContentProps {
  embedInDashboard?: boolean
}

export function InstructorAttendanceContent({ embedInDashboard }: InstructorAttendanceContentProps = {}) {
  const router = useRouter()
  const { courseScopeVersion } = useInstructorDashboardV2()
  const [activeMenu, setActiveMenu] = useState<MenuTab>("overview")
  const [instructorData, setInstructorData] = useState<{ id: string } | null>(null)

  useEffect(() => {
    const instructorSession = localStorage.getItem("instructorSession")
    if (!instructorSession) {
      router.push("/instructor/login")
      return
    }
    const instructor = JSON.parse(instructorSession)
    setInstructorData(instructor)
  }, [router, courseScopeVersion])

  const menuItems = [
    { id: "overview" as MenuTab, label: "Overview", icon: BarChart3 },
    { id: "configure" as MenuTab, label: "Configure Sessions", icon: Settings },
    { id: "qr-code" as MenuTab, label: "Generate QR Code", icon: QrCode },
    { id: "analytics" as MenuTab, label: "Analytics", icon: TrendingUp },
    { id: "management" as MenuTab, label: "Manage Attendance", icon: Users },
    { id: "gradebook" as MenuTab, label: "Gradebook", icon: BookOpen },
    { id: "trash" as MenuTab, label: "Trash", icon: Trash2 },
  ]

  const panel = (
    <div className={embedInDashboard ? "flex min-h-0 flex-1 flex-col" : "space-y-3"}>
      {activeMenu === "overview" && instructorData?.id && (
        <InstructorAttendanceOverview
          instructorId={instructorData.id}
          embedInDashboard={embedInDashboard}
          onNavigate={setActiveMenu}
        />
      )}

      {activeMenu === "configure" && (
        <InstructorAttendanceConfig instructorId={instructorData?.id} embedInDashboard={embedInDashboard} />
      )}

      {activeMenu === "qr-code" && (
        <QRGenerator instructorId={instructorData?.id} embedInDashboard={embedInDashboard} />
      )}

      {activeMenu === "analytics" && (
        <InstructorAttendanceAnalytics instructorId={instructorData?.id} embedInDashboard={embedInDashboard} />
      )}

      {activeMenu === "management" && instructorData?.id && (
        <InstructorAttendanceManagement
          instructorId={String(instructorData.id)}
          embedInDashboard={embedInDashboard}
        />
      )}

      {activeMenu === "gradebook" && (
        <InstructorAttendanceGradebook
          instructorId={String(instructorData?.id ?? "")}
          embedInDashboard={embedInDashboard}
        />
      )}

      {activeMenu === "trash" && (
        <AttendanceTrash instructorId={instructorData?.id} embedInDashboard={embedInDashboard} />
      )}
    </div>
  )

  if (!embedInDashboard) {
    return (
      <div className="min-h-screen w-full min-w-0 overflow-x-hidden bg-[var(--background)] p-6">
        {panel}
      </div>
    )
  }

  return (
    <FacultyModuleSplitLayout
      scrollMode={embedInDashboard ? "panel" : "page"}
      className={embedInDashboard ? "min-h-0 flex-1" : undefined}
      menu={
        <FacultyModuleSideMenu
          moduleId="attendance"
          title="Attendance"
          accent="theme"
          activeId={activeMenu}
          onSelect={(id) => setActiveMenu(id as MenuTab)}
          items={menuItems.map((item) => ({
            id: item.id,
            label: item.label,
            icon: item.icon,
            tone: item.id === "trash" ? ("destructive" as const) : undefined,
          }))}
        />
      }
    >
      {panel}
    </FacultyModuleSplitLayout>
  )
}
