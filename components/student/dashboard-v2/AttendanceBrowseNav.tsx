"use client"

import { CalendarCheck, History, TrendingUp } from "lucide-react"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { cn } from "@/lib/utils"

const MODULE_ID = "attendance"
export const ATTENDANCE_HUB_BASE = "/student/dashboard-v2/attendance"

export type AttendanceBrowseId = "overview" | "history" | "analytics"

export function resolveAttendanceBrowseId(pathname: string | null): AttendanceBrowseId {
  const path = (pathname || "").replace(/\/$/, "")
  if (path.endsWith("/history")) return "history"
  if (path.endsWith("/analytics")) return "analytics"
  return "overview"
}

/** Shared Attendance browse rail (Practice Hub / Notes pattern). */
export function AttendanceBrowseNav({
  activeId,
  className,
}: {
  activeId: AttendanceBrowseId
  className?: string
}) {
  return (
    <FacultyModuleSideMenu
      embedded
      className={cn("lg:border-r lg:border-[var(--border)] lg:pr-4", className)}
      moduleId={MODULE_ID}
      accent={{ soft: "var(--cc-accent-soft)", ink: "var(--cc-text)" }}
      title="Browse"
      activeId={activeId}
      items={[
        {
          id: "overview",
          label: "Home",
          icon: CalendarCheck,
          href: ATTENDANCE_HUB_BASE,
        },
        {
          id: "history",
          label: "Session log",
          icon: History,
          href: `${ATTENDANCE_HUB_BASE}/history`,
        },
        {
          id: "analytics",
          label: "Insights",
          icon: TrendingUp,
          href: `${ATTENDANCE_HUB_BASE}/analytics`,
        },
      ]}
    />
  )
}
