"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import {
  ClipboardList,
  FileText,
  Inbox,
  ListChecks,
  Settings,
  UserPlus,
} from "lucide-react"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"

export const INSTRUCTOR_RECOMMENDATIONS_MODULE_BASE = "/instructor/dashboard-v2/recommendations"

const NAV = [
  { id: "all", href: `${INSTRUCTOR_RECOMMENDATIONS_MODULE_BASE}/all`, label: "All letters", icon: FileText },
  { id: "pending", href: `${INSTRUCTOR_RECOMMENDATIONS_MODULE_BASE}/pending`, label: "Pending", icon: Inbox },
  { id: "active", href: `${INSTRUCTOR_RECOMMENDATIONS_MODULE_BASE}/active`, label: "Active", icon: ListChecks },
  { id: "done", href: `${INSTRUCTOR_RECOMMENDATIONS_MODULE_BASE}/done`, label: "Done", icon: ClipboardList },
  {
    id: "guest-account-requests",
    href: `${INSTRUCTOR_RECOMMENDATIONS_MODULE_BASE}/guest-account-requests`,
    label: "Career Member requests",
    icon: UserPlus,
  },
  { id: "settings", href: `${INSTRUCTOR_RECOMMENDATIONS_MODULE_BASE}/settings`, label: "Settings", icon: Settings },
] as const

export function InstructorRecommendationModuleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ""

  const activeId =
    NAV.find(({ href, id }) => {
      if (id === "all") {
        return pathname === href || pathname === INSTRUCTOR_RECOMMENDATIONS_MODULE_BASE
      }
      return pathname === href || pathname.startsWith(`${href}/`)
    })?.id ?? "all"

  return (
    <StudentDashboardModulePage scrollMode="panel">
      <FacultyModuleSplitLayout
        scrollMode="panel"
        className="min-h-0 flex-1"
        menu={
          <FacultyModuleSideMenu
            moduleId="recommendations"
            title="Letters"
            activeId={activeId}
            items={NAV.map(({ id, href, label, icon }) => ({ id, label, icon, href }))}
          />
        }
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden min-w-0">{children}</div>
      </FacultyModuleSplitLayout>
    </StudentDashboardModulePage>
  )
}
