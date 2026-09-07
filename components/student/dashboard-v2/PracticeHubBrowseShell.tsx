"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import {
  PracticeBrowseNav,
  resolvePracticeBrowseId,
  type PracticeBrowseCounts,
} from "@/components/student/dashboard-v2/PracticeBrowseNav"
import { getStudentData, studentApiFetch } from "@/lib/auth"

/** Browse rail shared by Practice Hub pages (matches Notes / Flashcards / CodeBench / Cora). */
export function PracticeHubBrowseShell({
  children,
  menuExtra,
  counts: countsProp,
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
  const [fetchedCounts, setFetchedCounts] = useState<PracticeBrowseCounts | undefined>()

  useEffect(() => {
    if (countsProp) return
    const studentData = getStudentData()
    if (!studentData?.databaseId) return
    const studentDbId = Number.parseInt(studentData.databaseId, 10)
    if (!Number.isFinite(studentDbId)) return

    void studentApiFetch(`/api/practice/recent-sessions?studentId=${studentDbId}&limit=100`)
      .then(async (response) => {
        if (!response.ok) return
        const data = await response.json()
        setFetchedCounts({ sessions: Array.isArray(data.sessions) ? data.sessions.length : 0 })
      })
      .catch(() => {})
  }, [countsProp, pathname])

  const counts = countsProp ?? fetchedCounts

  return (
    <FacultyModuleSplitLayout
      splitMode="container"
      containerName="practice-hub"
      className="border-t border-[color-mix(in_srgb,var(--cc-text)_10%,transparent)] pt-3 sm:pt-4 lg:min-h-[min(640px,72vh)]"
      menuWidthClass={
        menuWidthClass === "lg:w-56"
          ? "@[720px]/practice-hub:w-48 @[880px]/practice-hub:w-52"
          : menuWidthClass === "lg:w-52"
            ? "@[720px]/practice-hub:w-44 @[880px]/practice-hub:w-52"
            : menuWidthClass
      }
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
