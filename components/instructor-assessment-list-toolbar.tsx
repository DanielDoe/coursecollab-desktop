"use client"

import type { ReactNode } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import type { QuizReleaseTarget } from "@/lib/quiz-release-targets"
import { FacultyModuleToolbar } from "@/components/instructor/dashboard-v2/FacultyModuleToolbar"

export type AssessmentListSort = "newest" | "oldest" | "title-asc" | "title-desc"
export type AssessmentListStatusFilter = "all" | "active" | "inactive"
export type AssessmentListViewMode = "list" | "grid"

export type AssessmentListItem = {
  id: number
  title: string
  description: string
  is_active: boolean
  created_at: string
  session_access?: Record<string, boolean | undefined>
}

export function filterAndSortAssessments<T extends AssessmentListItem>(
  items: T[],
  {
    search,
    statusFilter,
    sessionFilter,
    sort,
  }: {
    search: string
    statusFilter: AssessmentListStatusFilter
    sessionFilter: string
    sort: AssessmentListSort
  },
): T[] {
  let list = items
  const q = search.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.description || "").toLowerCase().includes(q),
    )
  }
  if (statusFilter === "active") list = list.filter((item) => item.is_active)
  if (statusFilter === "inactive") list = list.filter((item) => !item.is_active)
  if (sessionFilter !== "all") {
    list = list.filter((item) => item.session_access?.[sessionFilter] === true)
  }

  const sorted = [...list]
  const titleCompare = (a: T, b: T) =>
    a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" })

  sorted.sort((a, b) => {
    switch (sort) {
      case "oldest":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case "title-desc":
        return titleCompare(b, a)
      case "title-asc":
        return titleCompare(a, b)
      case "newest":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      default:
        return titleCompare(a, b)
    }
  })
  return sorted
}

type InstructorAssessmentListToolbarProps = {
  moduleId?: string
  search: string
  onSearchChange: (value: string) => void
  statusFilter: AssessmentListStatusFilter
  onStatusFilterChange: (value: AssessmentListStatusFilter) => void
  sessionFilter: string
  onSessionFilterChange: (value: string) => void
  sort: AssessmentListSort
  onSortChange: (value: AssessmentListSort) => void
  viewMode: AssessmentListViewMode
  onViewModeChange: (value: AssessmentListViewMode) => void
  releaseTargets: QuizReleaseTarget[]
  totalCount: number
  filteredCount: number
  trailing?: ReactNode
}

export function InstructorAssessmentListToolbar({
  moduleId = "quizzes",
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sessionFilter,
  onSessionFilterChange,
  sort,
  onSortChange,
  viewMode,
  onViewModeChange,
  releaseTargets,
  totalCount,
  filteredCount,
  trailing,
}: InstructorAssessmentListToolbarProps) {
  const showingFiltered = filteredCount !== totalCount

  return (
    <FacultyModuleToolbar
      moduleId={moduleId}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search by title or description…"
      viewMode={viewMode}
      onViewModeChange={onViewModeChange}
      summary={
        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
          {showingFiltered ? (
            <>
              {filteredCount} of {totalCount} shown
            </>
          ) : (
            <>{totalCount} total</>
          )}
        </p>
      }
      trailing={trailing}
      filters={
        <>
          <Select value={sessionFilter} onValueChange={onSessionFilterChange}>
            <SelectTrigger className="h-9 w-[9.5rem] rounded-lg text-sm">
              <SelectValue placeholder="Section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sections</SelectItem>
              {releaseTargets.map((target) => (
                <SelectItem key={target.sessionId} value={target.sessionCode}>
                  {target.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
    />
  )
}
