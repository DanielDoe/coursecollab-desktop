"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { CalendarDays, LayoutGrid, ListTree } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SemesterTimeline } from "@/components/student/dashboard-v2/SemesterTimeline"
import { StudentModuleHubLayout } from "@/components/student/dashboard-v2/StudentModuleHubLayout"

type MenuView = "timeline" | "table"

export function TimelineDashboardV2() {
  const [menuView, setMenuView] = useState<MenuView>("timeline")

  const headerAction = useMemo(
    () => (
      <Button asChild variant="ghost" size="sm" className="h-9 rounded-xl px-3">
        <Link href="/student/dashboard-v2/calendar">
          <CalendarDays className="h-4 w-4 mr-1.5" />
          Open calendar
        </Link>
      </Button>
    ),
    [],
  )

  return (
    <StudentModuleHubLayout
      moduleId="timeline"
      title="Semester Timeline"
      metaLine="Assignments, releases, syllabus dates, and completed work"
      metaSuffix="timeline and table views"
      headerAction={headerAction}
      menuView={menuView}
      onMenuSelect={(id) => setMenuView(id as MenuView)}
      menuItems={[
        { id: "timeline", label: "Timeline", icon: ListTree },
        { id: "table", label: "Table", icon: LayoutGrid },
      ]}
    >
      <SemesterTimeline showFilters showViewToggle={false} viewMode={menuView} />
    </StudentModuleHubLayout>
  )
}
