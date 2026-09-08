"use client"

import { usePathname } from "next/navigation"
import { Sun, LayoutGrid, MessageCircle, Award } from "lucide-react"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import {
  DASHBOARD_V2_PANEL_SCROLL_ATTR,
  dashboardV2ModuleShellClass,
} from "@/lib/dashboard-v2-layout"
import { cn } from "@/lib/utils"

const CAMP_BASE = `${FACULTY_DASHBOARD_BASE}/summer-camp`

const SUMMER_CAMP_NAV = [
  { id: "overview", label: "Programs & tracks", href: CAMP_BASE, icon: LayoutGrid },
  { id: "discussions", label: "Discussions", href: `${CAMP_BASE}/discussions`, icon: MessageCircle },
  { id: "certificates", label: "Certificates", href: `${CAMP_BASE}/certificates`, icon: Award },
] as const

function activeSummerCampId(pathname: string): string {
  if (pathname.includes("/summer-camp/discussions")) return "discussions"
  if (pathname.includes("/summer-camp/certificates")) return "certificates"
  return "overview"
}

export default function SummerCampLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ""
  const activeId = activeSummerCampId(pathname)
  const isTrainingDetail =
    pathname.includes("/summer-camp/training/") || pathname.includes("/summer-camp/module/")
  const shellClass = dashboardV2ModuleShellClass("panel")
  const panelAttrs = { [DASHBOARD_V2_PANEL_SCROLL_ATTR]: "panel" } as const

  if (isTrainingDetail) {
    return (
      <div className={cn(shellClass, "overflow-x-hidden")} {...panelAttrs}>
        {children}
      </div>
    )
  }

  return (
    <div className={cn(shellClass, "overflow-hidden")} {...panelAttrs}>
      <FacultyModuleSplitLayout
        scrollMode="panel"
        className="min-h-0 flex-1"
        menu={
          <FacultyModuleSideMenu
            moduleId="summer-camp"
            title="Summer Camp"
            accent="theme"
            activeId={activeId}
            items={SUMMER_CAMP_NAV.map((item) => ({ ...item, icon: item.icon }))}
            footer={
              <p className="flex items-center gap-2 text-xs text-[var(--cc-text-muted)]">
                <Sun className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
                Publish tracks for camper enrollment
              </p>
            }
          />
        }
      >
        {children}
      </FacultyModuleSplitLayout>
    </div>
  )
}
