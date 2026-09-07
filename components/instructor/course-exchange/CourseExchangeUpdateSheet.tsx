"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowDownToLine, Loader2, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useToast } from "@/components/ui/use-toast"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { COURSE_EXCHANGE_MODULE_LABELS } from "@/lib/course-exchange/modules"
import type { ExchangeSyncChange, ExchangeSyncDiff } from "@/lib/course-exchange/lineage-types"
import { PORTAL_TEXT } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

function moduleLabel(module: ExchangeSyncChange["module"]) {
  if (module === "syllabus") return "Syllabus"
  return COURSE_EXCHANGE_MODULE_LABELS[module] ?? module
}

function kindBadge(kind: ExchangeSyncChange["kind"]) {
  if (kind === "added") return "New"
  if (kind === "modified") return "Updated"
  return "Removed"
}

export function CourseExchangeUpdateSheet({
  copyId,
  open,
  onOpenChange,
  onApplied,
}: {
  copyId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplied?: () => void
}) {
  const { toast } = useToast()
  const chrome = facultyEmbedChrome("course-exchange")
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [diff, setDiff] = useState<ExchangeSyncDiff | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const loadDiff = (force = false) => {
    if (copyId == null) return
    const setBusy = force ? setRefreshing : setLoading
    setBusy(true)
    void instructorApiFetch(`/api/instructor/course-exchange/copies/${copyId}/sync${force ? "?force=1" : ""}`, {
      headers: buildInstructorApiHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        const next = data.diff as ExchangeSyncDiff | undefined
        if (!next?.changes) {
          setDiff(null)
          setSelected(new Set())
          return
        }
        setDiff(next)
        setSelected(
          new Set(next.changes.filter((c) => c.kind !== "removed").map((c) => c.changeId)),
        )
      })
      .catch(() => {
        toast({ title: "Could not load updates", variant: "destructive" })
      })
      .finally(() => setBusy(false))
  }

  useEffect(() => {
    if (!open || copyId == null) return
    loadDiff(false)
  }, [open, copyId])

  const selectableChanges = useMemo(
    () => (diff?.changes ?? []).filter((c) => c.kind !== "removed"),
    [diff],
  )

  async function applySelected() {
    if (copyId == null || selected.size === 0) return
    setApplying(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/course-exchange/copies/${copyId}/sync`, {
        method: "POST",
        headers: { ...buildInstructorApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ changeIds: [...selected] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Apply failed")
      toast({
        title: "Course updated",
        description: `Applied ${data.result?.applied ?? selected.size} change(s) from the source course.`,
      })
      onApplied?.()
      onOpenChange(false)
    } catch (e) {
      toast({ title: "Update failed", description: String(e), variant: "destructive" })
    } finally {
      setApplying(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-full flex-col gap-0 overflow-hidden border-l border-[var(--border)] bg-[var(--cc-modal-surface)] p-0 sm:max-w-lg"
      >
        <SheetHeader className="relative border-b border-[var(--border)] px-5 pb-4 pt-5 pr-24 text-left">
          <div className="absolute right-4 top-4 flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-lg border-[var(--border)] bg-[var(--card)]"
              disabled={loading || refreshing}
              aria-label="Refresh updates"
              onClick={() => loadDiff(true)}
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <SheetClose asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-lg border-[var(--border)] bg-[var(--card)]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          </div>
          <SheetTitle className={cn("text-xl font-semibold", PORTAL_TEXT)}>Review source updates</SheetTitle>
          <SheetDescription className="text-sm text-[var(--cc-text-secondary)]">
            {diff
              ? `${diff.sourceCourseCode} → ${diff.destinationCourseCode} · version ${diff.sourceVersion}`
              : "Compare incoming creator changes with your copy."}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-[var(--cc-text-secondary)]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking for updates…
            </div>
          ) : !diff?.hasUpdates ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--cc-text-secondary)]">
              Your copy matches the latest shared content from the creator.
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[var(--cc-text-muted)]">
                Select the changes you want. Your local edits to unselected items stay as-is.
              </p>
              <div className="overflow-hidden rounded-2xl border border-[var(--border)] divide-y divide-[var(--border)]">
                {diff.changes.map((change) => {
                  const disabled = change.kind === "removed"
                  const checked = selected.has(change.changeId)
                  return (
                    <label
                      key={change.changeId}
                      className={cn(
                        "flex cursor-pointer gap-3 px-3 py-3 hover:bg-[var(--cc-accent-soft)]/45",
                        disabled && "cursor-default opacity-60",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(on) => {
                          setSelected((prev) => {
                            const next = new Set(prev)
                            if (on) next.add(change.changeId)
                            else next.delete(change.changeId)
                            return next
                          })
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-[var(--cc-text)]">{change.label}</span>
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", chrome.p.softBg, chrome.p.iconText)}>
                            {moduleLabel(change.module)}
                          </span>
                          <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--cc-text-secondary)]">
                            {kindBadge(change.kind)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[var(--cc-text-secondary)]">{change.summary}</p>
                        {change.kind === "modified" ? (
                          <p className="mt-1 text-[11px] text-[var(--cc-text-muted)]">
                            Yours: {change.yoursLabel ?? "—"} · Incoming: {change.incomingLabel ?? "—"}
                          </p>
                        ) : null}
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="gap-2 border-t border-[var(--border)] px-5 py-4">
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {selectableChanges.length > 0 ? (
            <Button
              className={cn("h-11 rounded-xl", chrome.solid)}
              disabled={applying || selected.size === 0}
              onClick={() => void applySelected()}
            >
              {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowDownToLine className="mr-2 h-4 w-4" />}
              Apply {selected.size} selected
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function CourseExchangeUpdateBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
      <RefreshCw className="h-3 w-3" />
      {count} update{count === 1 ? "" : "s"}
    </span>
  )
}
