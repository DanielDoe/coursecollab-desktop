"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { projectListPaginationItems } from "@/lib/pagination-ui"
import { PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

export const CODEBENCH_LIBRARY_PAGE_SIZE = 8
export const CODEBENCH_LIVE_PAGE_SIZE = 6

export function paginateCodebenchList<T>(rows: T[], page: number, pageSize: number) {
  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const startIndex = (safePage - 1) * pageSize
  return {
    page: safePage,
    totalPages,
    total,
    pageSize,
    rows: rows.slice(startIndex, startIndex + pageSize),
  }
}

type Props = {
  page: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  className?: string
}

export function CodebenchListPagination({ page, pageSize, totalItems, onPageChange, className }: Props) {
  if (totalItems <= pageSize) return null

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize + 1
  const end = Math.min(safePage * pageSize, totalItems)
  const items = projectListPaginationItems(safePage, totalPages)

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-2 border-t border-[var(--border)] pt-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className={cn("text-center text-xs tabular-nums sm:text-left", PORTAL_TEXT_MUTED)}>
        Showing {start}–{end} of {totalItems}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2.5"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Prev</span>
        </Button>
        {items.map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className={cn("px-1.5 text-sm select-none", PORTAL_TEXT_MUTED)}
              aria-hidden
            >
              …
            </span>
          ) : (
            <Button
              key={item}
              type="button"
              variant={item === safePage ? "secondary" : "outline"}
              size="sm"
              className="h-8 min-w-8 px-2"
              onClick={() => onPageChange(item)}
              aria-label={`Page ${item}`}
              aria-current={item === safePage ? "page" : undefined}
            >
              {item}
            </Button>
          ),
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2.5"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
