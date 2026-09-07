"use client"

import { useEffect, useState } from "react"
import { ChevronDown, PanelLeft } from "lucide-react"
import { getStudentData, getInstructorData } from "@/lib/auth"
import { COURSE_SWITCH_EVENT } from "@/lib/data/types"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"
import { isSummerProgramRole } from "@/lib/summer-camp/program-roles"
import { cn } from "@/lib/utils"

type DesktopWorkspaceHeaderProps = {
  collapsed?: boolean
  onToggleCollapsed?: () => void
}

function resolveWorkspace() {
  const student = getStudentData()
  const faculty = getInstructorData()

  if (faculty) {
    return {
      product: "CourseCollab",
      application: faculty.selectedCourseCode || "Faculty",
      subtitle: "Application",
    }
  }

  if (student?.isPlatformGuest) {
    return {
      product: "CourseCollab",
      application: "Career Member",
      subtitle: "Application",
    }
  }

  if (student?.isSummerCamper || isSummerProgramRole(student?.studentProgramRole ?? "")) {
    return {
      product: "CourseCollab",
      application: "Summer Camp",
      subtitle: "Application",
    }
  }

  return {
    product: "CourseCollab",
    application: student?.courseCode || "Student",
    subtitle: "Application",
  }
}

export function DesktopWorkspaceHeader({
  collapsed = false,
  onToggleCollapsed,
}: DesktopWorkspaceHeaderProps) {
  const [workspace, setWorkspace] = useState(resolveWorkspace)

  useEffect(() => {
    const sync = () => setWorkspace(resolveWorkspace())
    sync()
    window.addEventListener("student-session-ready", sync)
    window.addEventListener(COURSE_SWITCH_EVENT, sync)
    return () => {
      window.removeEventListener("student-session-ready", sync)
      window.removeEventListener(COURSE_SWITCH_EVENT, sync)
    }
  }, [])

  if (!isDesktopAppShell()) return null

  return (
    <div className={cn("mb-2 border-b border-[#e5e7eb] pb-2 dark:border-[#262626]", collapsed && "px-0")}>
      <div className={cn("flex items-center gap-1", collapsed && "justify-center")}>
        {!collapsed ? (
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-1 rounded-[6px] px-2 py-1.5 text-left hover:bg-[#f3f4f6] dark:hover:bg-[#1a1a1a]"
          >
            <span className="truncate text-[13px] font-semibold text-[#111827] dark:text-white">
              {workspace.product}
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-[#9ca3af]" />
          </button>
        ) : (
          <span className="flex size-8 items-center justify-center rounded-[6px] bg-[#111827] text-[12px] font-semibold text-white">
            C
          </span>
        )}
        {onToggleCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="inline-flex size-8 items-center justify-center rounded-[6px] text-[#6b7280] hover:bg-[#f3f4f6] dark:hover:bg-[#1a1a1a]"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeft className="size-4" />
          </button>
        ) : null}
      </div>
      {!collapsed ? (
        <div className="mt-2 px-2">
          <p className="text-[11px] font-medium text-[#9ca3af]">{workspace.subtitle}</p>
          <p className="mt-0.5 truncate text-[13px] font-medium text-[#111827] dark:text-white">
            {workspace.application}
          </p>
        </div>
      ) : null}
    </div>
  )
}
