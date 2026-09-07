"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowDownToLine, BookCopy, CalendarDays, Loader2, Plus, Send, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { COURSE_EXCHANGE_MODULE_LABELS } from "@/lib/course-exchange/modules"
import type { CourseExchangeModule, ExchangeTimelineEntry } from "@/lib/course-exchange/types"
import type { ExchangeSupplementOptions } from "@/lib/course-exchange/service"
import { summarizeCloneCounts } from "@/lib/course-exchange/provenance-shared"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

const SECTION_EYEBROW =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-secondary)]"

export type ExchangeRequestDetail = {
  id: number
  status: string
  purpose: string | null
  requested_modules: CourseExchangeModule[]
  approved_modules: CourseExchangeModule[] | null
  courseCode?: string
  courseTitle?: string
  requesterName?: string
  creatorName?: string
  destination_course_id?: number | null
  clone_summary?: Record<string, unknown> | null
  clone_error?: string | null
  created_at?: string
  reviewed_at?: string | null
  completed_at?: string | null
  rejected_at?: string | null
  rejection_reason?: string | null
  copyId?: number | null
  shareableModules?: CourseExchangeModule[]
  missingModules?: CourseExchangeModule[]
}

function formatWhen(value?: string | null) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ")
}

function ModuleChips({ modules, emptyLabel }: { modules: CourseExchangeModule[]; emptyLabel: string }) {
  if (!modules.length) {
    return <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>{emptyLabel}</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {modules.map((mod) => (
        <span
          key={mod}
          className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--muted)]/50 px-2.5 py-1 text-xs font-medium text-[var(--cc-text-secondary)]"
        >
          {COURSE_EXCHANGE_MODULE_LABELS[mod]}
        </span>
      ))}
    </div>
  )
}

function TimelineLedger({ entries }: { entries: ExchangeTimelineEntry[] }) {
  if (!entries.length) {
    return <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No activity recorded yet.</p>
  }
  return (
    <ol className="relative space-y-3 border-l border-[var(--border)] pl-4">
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border border-[var(--border)] bg-[var(--card)]" />
          <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{entry.label}</p>
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {formatWhen(entry.at)}
            {entry.actorName ? ` · ${entry.actorName}` : ""}
          </p>
          {entry.modules.length > 0 ? (
            <p className="mt-1 text-xs text-[var(--cc-text-secondary)]">
              {entry.modules.map((m) => COURSE_EXCHANGE_MODULE_LABELS[m]).join(" · ")}
            </p>
          ) : null}
          {entry.note ? <p className="mt-0.5 text-xs italic text-[var(--cc-text-muted)]">{entry.note}</p> : null}
        </li>
      ))}
    </ol>
  )
}

export function CourseExchangeRequestSheet({
  request,
  mode,
  open,
  onOpenChange,
  destinationLabel,
  loading,
  onImport,
  onReview,
  onViewSharedWithMe,
  onSupplement,
}: {
  request: ExchangeRequestDetail | null
  mode: "sent" | "received"
  open: boolean
  onOpenChange: (open: boolean) => void
  destinationLabel?: string | null
  loading?: boolean
  onImport?: () => void
  onReview?: () => void
  onViewSharedWithMe?: () => void
  onSupplement?: (modules: CourseExchangeModule[]) => Promise<void>
}) {
  const chrome = facultyEmbedChrome("course-exchange")
  const [timeline, setTimeline] = useState<ExchangeTimelineEntry[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [supplementOptions, setSupplementOptions] = useState<ExchangeSupplementOptions | null>(null)
  const [supplementOptionsLoading, setSupplementOptionsLoading] = useState(false)
  const [showSupplementPicker, setShowSupplementPicker] = useState(false)
  const [supplementSelected, setSupplementSelected] = useState<CourseExchangeModule[]>([])
  const [supplementLoading, setSupplementLoading] = useState(false)

  const addableModules = supplementOptions?.addableModules ?? request?.missingModules ?? []
  const requiresApproval = useMemo(
    () => new Set(supplementOptions?.requiresApproval ?? []),
    [supplementOptions?.requiresApproval],
  )

  useEffect(() => {
    if (!open || !request?.id) {
      setTimeline([])
      setSupplementOptions(null)
      setShowSupplementPicker(false)
      setSupplementSelected([])
      return
    }
    let cancelled = false
    setTimelineLoading(true)
    instructorApiFetch(`/api/instructor/course-exchange/requests/${request.id}/timeline`, {
      headers: buildInstructorApiHeaders(),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Failed to load timeline")
        if (!cancelled) setTimeline(data.timeline ?? [])
      })
      .catch(() => {
        if (!cancelled) setTimeline([])
      })
      .finally(() => {
        if (!cancelled) setTimelineLoading(false)
      })

    if (mode === "sent") {
      setSupplementOptionsLoading(true)
      instructorApiFetch(`/api/instructor/course-exchange/requests/${request.id}/supplement-options`, {
        headers: buildInstructorApiHeaders(),
      })
        .then(async (res) => {
          const data = await res.json()
          if (!res.ok) throw new Error(data.error ?? "Failed to load supplement options")
          if (!cancelled) {
            setSupplementOptions(data)
            const addable = (data.addableModules ?? []) as CourseExchangeModule[]
            if (addable.length > 0) {
              setSupplementSelected(addable)
              setShowSupplementPicker(true)
            }
          }
        })
        .catch(() => {
          if (!cancelled) setSupplementOptions(null)
        })
        .finally(() => {
          if (!cancelled) setSupplementOptionsLoading(false)
        })
    }

    return () => {
      cancelled = true
    }
  }, [open, request?.id, mode])

  if (!request) return null

  const status = request.status.toUpperCase()
  const personLabel = mode === "sent" ? "Course creator" : "Requester"
  const personName = mode === "sent" ? request.creatorName : request.requesterName
  const summary = summarizeCloneCounts(request.clone_summary ?? null)
  const canImport = mode === "sent" && (status === "APPROVED" || status === "FAILED")
  const canReview = mode === "received" && status === "PENDING"
  const showSharedLink = mode === "sent" && (status === "COMPLETED" || status === "COPIED")
  const canAddModules =
    mode === "sent" &&
    onSupplement &&
    addableModules.length > 0 &&
    status !== "REJECTED" &&
    status !== "CANCELLED" &&
    status !== "COPYING"

  const toggleSupplement = (mod: CourseExchangeModule) => {
    setSupplementSelected((prev) => (prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]))
  }

  const submitSupplement = async () => {
    if (!onSupplement || supplementSelected.length === 0 || !request?.id) return
    setSupplementLoading(true)
    try {
      await onSupplement(supplementSelected)
      setShowSupplementPicker(false)
      const res = await instructorApiFetch(`/api/instructor/course-exchange/requests/${request.id}/supplement-options`, {
        headers: buildInstructorApiHeaders(),
      })
      const data = await res.json()
      if (res.ok) {
        setSupplementOptions(data)
        const addable = (data.addableModules ?? []) as CourseExchangeModule[]
        setSupplementSelected(addable)
        setShowSupplementPicker(addable.length > 0)
      }
    } finally {
      setSupplementLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto border-l border-[var(--border)] bg-[var(--cc-modal-surface)] p-0 sm:max-w-md"
      >
        <SheetHeader className="space-y-2 border-b border-[var(--border)] px-5 pb-4 pt-5 text-left">
          <p className={SECTION_EYEBROW}>{mode === "sent" ? "Request sent" : "Request received"}</p>
          <SheetTitle className={cn("text-xl font-semibold tracking-tight", PORTAL_TEXT)}>
            {request.courseCode} — {request.courseTitle}
          </SheetTitle>
          <SheetDescription className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            Status: <span className="font-medium text-[var(--cc-text)]">{statusLabel(request.status)}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 px-5 py-4">
          <div className="overflow-hidden border border-[var(--border)] bg-[var(--card)]">
            <div className={cn("flex items-center gap-3 border-b border-[var(--border)] px-4 py-3.5", chrome.p.softBg)}>
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center", chrome.p.iconBg, chrome.p.iconText)}>
                <UserRound className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className={cn("truncate font-semibold", PORTAL_TEXT)}>{personName ?? "—"}</p>
                <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{personLabel}</p>
              </div>
            </div>
            <div className="space-y-2.5 px-4 py-3.5">
              {request.purpose ? (
                <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>{request.purpose}</p>
              ) : (
                <p className={cn("text-sm italic", PORTAL_TEXT_MUTED)}>No purpose note provided.</p>
              )}
              {destinationLabel ? (
                <p className={cn("flex items-center gap-2 text-sm", PORTAL_TEXT_MUTED)}>
                  <Send className={cn("h-4 w-4 shrink-0", chrome.p.iconText)} />
                  Destination: <span className="font-medium text-[var(--cc-text)]">{destinationLabel}</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-3 border border-[var(--border)] bg-[var(--card)] p-4">
            <div>
              <p className={SECTION_EYEBROW}>Requested modules</p>
              <div className="mt-2">
                <ModuleChips modules={request.requested_modules} emptyLabel="None selected" />
              </div>
            </div>
            {request.approved_modules?.length ? (
              <div>
                <p className={SECTION_EYEBROW}>Approved modules</p>
                <div className="mt-2">
                  <ModuleChips modules={request.approved_modules} emptyLabel="None approved" />
                </div>
              </div>
            ) : null}
            {addableModules.length > 0 ? (
              <div>
                <p className={SECTION_EYEBROW}>Not yet imported</p>
                <div className="mt-2">
                  <ModuleChips modules={addableModules} emptyLabel="All modules imported" />
                </div>
              </div>
            ) : null}
          </div>

          {canAddModules ? (
            <div className="space-y-3 border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={SECTION_EYEBROW}>Add missing modules</p>
                  <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>
                    Import more content into your destination course. Modules marked for owner approval need a new
                    review from the course creator.
                  </p>
                </div>
                {!showSupplementPicker ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5"
                    onClick={() => setShowSupplementPicker(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Select
                  </Button>
                ) : null}
              </div>
              {supplementOptionsLoading ? (
                <p className={cn("flex items-center gap-2 text-sm", PORTAL_TEXT_MUTED)}>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading available modules…
                </p>
              ) : null}
              {showSupplementPicker ? (
                <>
                  <div className="space-y-2">
                    {addableModules.map((mod) => (
                      <label key={mod} className="flex cursor-pointer items-start gap-2.5 text-sm">
                        <Checkbox
                          className="mt-0.5"
                          checked={supplementSelected.includes(mod)}
                          onCheckedChange={() => toggleSupplement(mod)}
                        />
                        <span>
                          {COURSE_EXCHANGE_MODULE_LABELS[mod]}
                          {requiresApproval.has(mod) ? (
                            <span className="ml-1.5 text-xs text-amber-600 dark:text-amber-300">
                              (owner approval)
                            </span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                  <Button
                    className={cn("w-full gap-2", chrome.solid)}
                    disabled={supplementLoading || supplementSelected.length === 0}
                    onClick={() => void submitSupplement()}
                  >
                    {supplementLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Import selected modules
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}

          {summary ? (
            <div className="space-y-2 border border-[var(--border)] bg-[var(--card)] p-4">
              <p className={SECTION_EYEBROW}>Imported content</p>
              <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>{summary}</p>
            </div>
          ) : null}

          {request.clone_error ? (
            <div className="border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">
              {request.clone_error}
            </div>
          ) : null}

          {request.rejection_reason ? (
            <div className="border border-[var(--border)] bg-[var(--muted)]/30 p-3 text-sm text-[var(--cc-text-muted)]">
              Rejection reason: {request.rejection_reason}
            </div>
          ) : null}

          <div className="space-y-2 border border-[var(--border)] bg-[var(--card)] p-4">
            <p className={SECTION_EYEBROW}>Provenance ledger</p>
            {timelineLoading ? (
              <p className={cn("flex items-center gap-2 text-sm", PORTAL_TEXT_MUTED)}>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading timeline…
              </p>
            ) : timeline.length > 0 ? (
              <TimelineLedger entries={timeline} />
            ) : (
              <div className={cn("space-y-1.5 text-sm", PORTAL_TEXT_MUTED)}>
                {formatWhen(request.created_at) ? (
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    Submitted {formatWhen(request.created_at)}
                  </p>
                ) : null}
                {formatWhen(request.reviewed_at) ? <p>Reviewed {formatWhen(request.reviewed_at)}</p> : null}
                {formatWhen(request.completed_at) ? <p>Completed {formatWhen(request.completed_at)}</p> : null}
                {formatWhen(request.rejected_at) ? <p>Rejected {formatWhen(request.rejected_at)}</p> : null}
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="mt-auto flex-col gap-2 border-t border-[var(--border)] px-5 py-4 sm:flex-col">
          {canImport ? (
            <Button className={cn("w-full gap-2", chrome.solid)} disabled={loading} onClick={onImport}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
              {status === "FAILED" ? "Retry import" : "Import to destination"}
            </Button>
          ) : null}
          {canReview ? (
            <Button className={cn("w-full", chrome.solid)} onClick={onReview}>
              Review request
            </Button>
          ) : null}
          {showSharedLink ? (
            <Button variant="outline" className="w-full gap-2" onClick={onViewSharedWithMe}>
              <BookCopy className="h-4 w-4" />
              View in Shared With Me
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
