"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import {
  AttendanceBrowseNav,
  resolveAttendanceBrowseId,
} from "@/components/student/dashboard-v2/AttendanceBrowseNav"

export function AttendanceBrowseShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const activeId = resolveAttendanceBrowseId(pathname)

  return (
    <FacultyModuleSplitLayout
      className="gap-2 sm:gap-3 lg:min-h-[min(560px,70vh)] lg:gap-4"
      menuWidthClass="lg:w-52"
      menu={
        <div className="flex min-h-0 flex-col gap-3 lg:h-full">
          <AttendanceBrowseNav activeId={activeId} />
        </div>
      }
    >
      <div className="min-w-0">{children}</div>
    </FacultyModuleSplitLayout>
  )
}
