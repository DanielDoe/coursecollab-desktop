"use client"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  PROJECT_LIST_PAGE_SIZES,
  type ProjectListPageSize,
  projectListPaginationItems,
} from "@/lib/pagination-ui"

type ProjectListPaginationBarProps = {
  totalItems: number
  page: number
  pageSize: ProjectListPageSize
  onPageChange: (page: number) => void
  onPageSizeChange: (size: ProjectListPageSize) => void
}

export function ProjectListPaginationBar({
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: ProjectListPaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const pageClamped = Math.min(Math.max(1, page), totalPages)
  const start = totalItems === 0 ? 0 : (pageClamped - 1) * pageSize + 1
  const end = Math.min(pageClamped * pageSize, totalItems)
  const pageItems = projectListPaginationItems(pageClamped, totalPages)

  if (totalItems === 0) return null

  return (
    <div className="flex flex-col gap-3 pt-4 mt-2 border-t border-slate-200/80 dark:border-white/[0.08]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v) as ProjectListPageSize)}
          >
            <SelectTrigger className="h-8 w-[76px] text-xs rounded-lg border-slate-200 dark:border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_LIST_PAGE_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          Showing {start}–{end} of {totalItems}
        </p>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            disabled={pageClamped <= 1}
            onClick={() => onPageChange(pageClamped - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          <div className="flex flex-wrap items-center justify-center gap-1 order-3 sm:order-none w-full sm:w-auto">
            {pageItems.map((item, idx) =>
              item === "ellipsis" ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1.5 text-slate-400 text-sm select-none"
                  aria-hidden
                >
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  type="button"
                  variant={item === pageClamped ? "secondary" : "outline"}
                  size="sm"
                  className="h-8 min-w-8 px-2"
                  onClick={() => onPageChange(item)}
                  aria-label={`Page ${item}`}
                  aria-current={item === pageClamped ? "page" : undefined}
                >
                  {item}
                </Button>
              )
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            disabled={pageClamped >= totalPages}
            onClick={() => onPageChange(pageClamped + 1)}
            aria-label="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
