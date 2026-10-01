"use client"

import { useMemo, useState } from "react"
import { EMBED_MATERIAL_PANEL } from "@/components/student/dashboard-v2/embed-module-ui"
import type { StudioRunRow } from "@/lib/codebench-studio-analytics"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 8

type Props = {
  rows: StudioRunRow[]
  errorCount: number
  cleanCount: number
  compact?: boolean
}

function formatWhen(at: number) {
  if (!at) return ""
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function outcomeLabel(outcome: StudioRunRow["outcome"]) {
  if (outcome === "clean") return "Clean"
  if (outcome === "runtime") return "Runtime"
  return "Error"
}

export function CodebenchStudentInsight({ rows, errorCount, cleanCount, compact = false }: Props) {
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const pageSize = compact ? 5 : PAGE_SIZE
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const visible = useMemo(
    () => rows.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [rows, safePage, pageSize],
  )
  const selected = rows.find((row) => row.id === selectedId) ?? null

  return (
    <div className={cn(EMBED_MATERIAL_PANEL, "p-4 sm:p-5")}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={cn("text-base font-semibold", PORTAL_TEXT)}>Runs</h2>
        <p className={cn("text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
          {errorCount} error{errorCount === 1 ? "" : "s"} · {cleanCount} clean
        </p>
      </div>

      {rows.length === 0 ? (
        <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No runs yet. Press Run in the editor.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[280px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wide text-[var(--cc-text-muted)]">
                <th className="py-2 pr-3 font-medium">When</th>
                <th className="py-2 pr-3 font-medium">Result</th>
                <th className="hidden py-2 pr-3 font-medium sm:table-cell">File</th>
                <th className="py-2 text-right font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border)] last:border-0">
                  <td className={cn("py-2.5 pr-3 align-middle text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
                    {formatWhen(row.at)}
                  </td>
                  <td className="py-2.5 pr-3 align-middle">
                    <span className={cn("font-medium", PORTAL_TEXT)}>{outcomeLabel(row.outcome)}</span>
                    <span className={cn("mt-0.5 block truncate text-xs sm:hidden", PORTAL_TEXT_MUTED)}>
                      {row.title}
                    </span>
                    <span className={cn("hidden text-xs sm:inline", PORTAL_TEXT_MUTED)}> · {row.title}</span>
                  </td>
                  <td className={cn("hidden max-w-[140px] truncate py-2.5 pr-3 align-middle text-xs sm:table-cell", PORTAL_TEXT_MUTED)}>
                    {row.fileName || "—"}
                  </td>
                  <td className="py-2.5 text-right align-middle">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg px-2.5 text-xs"
                      onClick={() => setSelectedId(row.id)}
                    >
                      View more
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!compact && rows.length > pageSize ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
          >
            Previous
          </Button>
          <span className={cn("text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
            {safePage + 1} / {pageCount}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(safePage + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}

      <Sheet open={selected != null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {selected ? (
            <>
              <SheetHeader className="pr-8">
                <SheetTitle>{selected.title}</SheetTitle>
                <SheetDescription>
                  {formatWhen(selected.at)}
                  {selected.fileName ? ` · ${selected.fileName}` : ""}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-3 px-4 pb-6">
                <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{outcomeLabel(selected.outcome)}</p>
                {selected.message ? (
                  <p className="break-words rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2 font-mono text-[12px] leading-relaxed text-[var(--cc-text)]">
                    {selected.message}
                  </p>
                ) : null}
                <p className={cn("text-sm leading-relaxed", PORTAL_TEXT)}>{selected.meaning}</p>
                <p className={cn("text-sm leading-relaxed", PORTAL_TEXT)}>{selected.nextStep}</p>
                {selected.repeatCount > 1 ? (
                  <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                    This kind of error is in your log {selected.repeatCount} times.
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
