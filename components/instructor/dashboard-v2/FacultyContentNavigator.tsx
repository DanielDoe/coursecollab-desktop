"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"

export const FACULTY_CONTENT_PAGE_SIZE = 6

export function orderContentByTopic<T extends { id: number; topic?: string | null; title: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const topicA = a.topic?.trim() || "General"
    const topicB = b.topic?.trim() || "General"
    if (topicA !== topicB) return topicA.localeCompare(topicB)
    return a.title.localeCompare(b.title)
  })
}

export function groupContentByTopic<T extends { topic?: string | null }>(
  items: T[],
): [string, T[]][] {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = item.topic?.trim() || "General"
    const list = map.get(key) ?? []
    list.push(item)
    map.set(key, list)
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
}

export function displayContentTitle(title: string): string {
  return title.replace(/^\[sample-ui\]\s*/i, "").trim() || title
}

export function formatContentCount(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : plural ?? `${singular}s`}`
}

type NavigatorProps = {
  currentIndex: number
  total: number
  onPrevious: () => void
  onNext: () => void
  itemLabel?: string
  className?: string
  size?: "sm" | "default"
}

export function FacultyContentNavigator({
  currentIndex,
  total,
  onPrevious,
  onNext,
  itemLabel = "item",
  className,
  size = "default",
}: NavigatorProps) {
  const hasSelection = currentIndex >= 0 && total > 0
  const atStart = !hasSelection || currentIndex <= 0
  const atEnd = !hasSelection || currentIndex >= total - 1
  const buttonClass = size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-2.5 text-xs"

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--sidebar-accent)]/15 px-2.5 py-2",
        className,
      )}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("gap-1", buttonClass)}
        disabled={atStart}
        onClick={onPrevious}
      >
        <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
        Previous
      </Button>

      <p className="text-xs text-muted-foreground tabular-nums text-center min-w-[5.5rem]">
        {hasSelection ? (
          <>
            <span className="font-medium text-foreground">{currentIndex + 1}</span>
            {" of "}
            {total}
          </>
        ) : (
          `No ${itemLabel} selected`
        )}
      </p>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("gap-1", buttonClass)}
        disabled={atEnd}
        onClick={onNext}
      >
        Next
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
      </Button>
    </div>
  )
}

type SidebarPaginationProps = {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  className?: string
}

export function FacultySidebarPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  className,
}: SidebarPaginationProps) {
  if (totalItems <= pageSize) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalItems)
  const buttonClass = "h-7 px-2 text-xs"

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2.5 mt-1",
        className,
      )}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("gap-1", buttonClass)}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
        Prev
      </Button>
      <p className="text-[11px] text-muted-foreground tabular-nums text-center">
        {start}–{end} of {totalItems}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("gap-1", buttonClass)}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
      </Button>
    </div>
  )
}

export function pageForContentIndex(index: number, pageSize = FACULTY_CONTENT_PAGE_SIZE): number {
  if (index < 0) return 1
  return Math.floor(index / pageSize) + 1
}
