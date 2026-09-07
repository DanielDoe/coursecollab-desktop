"use client"

import type { ReactNode } from "react"
import { FacultyIntegratedToolbar } from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"

type FacultyModuleToolbarProps = {
  moduleId: string
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  summary?: ReactNode
  filters?: ReactNode
  viewMode?: "grid" | "list"
  onViewModeChange?: (mode: "grid" | "list") => void
  trailing?: ReactNode
  className?: string
}

/** @deprecated Prefer FacultyIntegratedToolbar directly — this wraps it for legacy call sites. */
export function FacultyModuleToolbar({
  moduleId,
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  summary,
  filters,
  viewMode,
  onViewModeChange,
  trailing,
  className,
}: FacultyModuleToolbarProps) {
  return (
    <FacultyIntegratedToolbar
      moduleId={moduleId}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
      filters={filters}
      viewMode={viewMode}
      onViewModeChange={onViewModeChange}
      meta={summary}
      trailing={trailing}
      className={className}
    />
  )
}
