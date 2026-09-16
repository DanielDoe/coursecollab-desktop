"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import {
  PracticeBrowseNav,
  resolvePracticeBrowseId,
  type PracticeBrowseCounts,
} from "@/components/student/dashboard-v2/PracticeBrowseNav"

/** Browse rail shared by Practice Hub pages (matches Notes / Flashcards / CodeBench / Cora). */
export function PracticeHubBrowseShell({
  children,
  menuExtra,
  counts,
  menuWidthClass = "lg:w-56",
}: {
  children: ReactNode
  /** Optional list pane under Browse (e.g. topic list on Topics). */
  menuExtra?: ReactNode
  counts?: PracticeBrowseCounts
  menuWidthClass?: string
}) {
  const pathname = usePathname()
  const activeId = resolvePracticeBrowseId(pathname)

  return (
    <FacultyModuleSplitLayout
      className="gap-2 sm:gap-3 lg:min-h-[min(640px,72vh)] lg:gap-4"
      menuWidthClass={menuWidthClass}
      menu={
        <div className="flex min-h-0 flex-col gap-3 lg:h-full">
          <PracticeBrowseNav activeId={activeId} counts={counts} />
          {menuExtra ? <div className="min-h-0 flex-1 overflow-y-auto">{menuExtra}</div> : null}
        </div>
      }
    >
      <div className="min-w-0">{children}</div>
    </FacultyModuleSplitLayout>
  )
}
