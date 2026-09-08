"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  Check,
  Eye,
  ExternalLink,
  FileText,
  Inbox,
  LayoutGrid,
  List,
  Loader2,
  Search,
  X,
} from "lucide-react"
import { getInstructorData } from "@/lib/auth"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { purposeLabel } from "@/lib/recommendation-letters-shared"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { PORTAL_CARD, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import {
  AM_PANEL_FILL,
  AM_PANEL_SCROLL,
  AM_PANEL_SECTION,
} from "@/lib/assessments/assessment-management-surface-classes"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea"
import { InstructorRequestReviewModal } from "@/components/instructor/recommendations/instructor-request-review-modal"

type Row = {
  id: number
  status: string
  student_name: string
  purpose: string
  deadline: string | null
  course_code: string
  created_at: string
  latest_pdf_url?: string | null
  latest_download_at?: string | null
  student_request_description?: string | null
}

const ACTIVE_STATUSES = [
  "approved",
  "info_requested",
  "ai_generated",
  "student_selected",
  "instructor_review_pending",
  "revision_requested",
] as const

const DONE_STATUSES = ["finalized", "downloaded", "rejected"] as const

export type InstructorRecommendationsListBucket = "all" | "pending" | "active" | "done"

type SortKey = "recent" | "deadline_asc" | "name_asc"

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-slate-200/90 dark:border-white/[0.12] bg-slate-50/70 dark:bg-white/[0.03] px-6 py-12 text-center",
        AM_PANEL_FILL,
      )}
    >
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-200/60 dark:bg-white/10 text-slate-500 dark:text-slate-400 mb-3">
        <Inbox className="h-5 w-5" aria-hidden />
      </div>
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{title}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-sm mx-auto leading-relaxed">{description}</p>
    </div>
  )
}

function filterRows(rows: Row[], query: string): Row[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((r) => {
    const purpose = purposeLabel(r.purpose).toLowerCase()
    const hay = [
      r.student_name.toLowerCase(),
      r.course_code.toLowerCase(),
      r.status.replace(/_/g, " ").toLowerCase(),
      purpose,
      r.deadline?.toLowerCase() ?? "",
      (r.student_request_description ?? "").toLowerCase(),
    ].join(" ")
    return hay.includes(q)
  })
}

function formatRequestDeadline(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function statusBadgeStyles(status: string): string {
  switch (status) {
    case "requested":
      return "bg-amber-500/15 text-amber-900 dark:text-amber-100 border-amber-500/25"
    case "rejected":
      return "bg-red-500/12 text-red-800 dark:text-red-200 border-red-500/25"
    case "finalized":
    case "downloaded":
      return "bg-emerald-500/12 text-emerald-900 dark:text-emerald-100 border-emerald-500/25"
    default:
      return "bg-slate-500/10 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-white/[0.1]"
  }
}

function sortRows(rows: Row[], sort: SortKey): Row[] {
  const copy = [...rows]
  if (sort === "name_asc") {
    copy.sort((a, b) => a.student_name.localeCompare(b.student_name, undefined, { sensitivity: "base" }))
    return copy
  }
  if (sort === "deadline_asc") {
    copy.sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    })
    return copy
  }
  // recent — created_at desc
  copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return copy
}

export function InstructorRecommendationsList({ bucket }: { bucket: InstructorRecommendationsListBucket }) {
  const { courseScopeVersion } = useInstructorDashboardV2()
  const [rows, setRows] = useState<Row[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortKey>("recent")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [modalId, setModalId] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [actionBusy, setActionBusy] = useState<number | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [rejectSubmitting, setRejectSubmitting] = useState(false)

  const refresh = useCallback(async () => {
    const s = getInstructorData()
    if (!s?.id) {
      setErr("Not signed in")
      return
    }
    const res = await instructorApiFetch("/api/instructor/recommendations", {
      headers: buildInstructorAuthorizedApiHeaders({ "x-instructor-id": String(s.id) }),
    })
    const j = await res.json()
    if (!res.ok) throw new Error(j.error || "Failed")
    setRows(j.requests || [])
  }, [courseScopeVersion])

  useEffect(() => {
    ;(async () => {
      try {
        await refresh()
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed")
      }
    })()
  }, [refresh])

  const buckets = (status: string) => rows.filter((r) => r.status === status)

  const tabRowsFor = (tab: InstructorRecommendationsListBucket) => {
    if (tab === "all") return rows
    if (tab === "pending") return buckets("requested")
    if (tab === "active") return rows.filter((r) => ACTIVE_STATUSES.includes(r.status as (typeof ACTIVE_STATUSES)[number]))
    return rows.filter((r) => DONE_STATUSES.includes(r.status as (typeof DONE_STATUSES)[number]))
  }

  const openModal = (id: number) => {
    setModalId(id)
    setModalOpen(true)
  }

  const quickApprove = async (id: number) => {
    const inst = getInstructorData()
    if (!inst?.id) return
    setActionBusy(id)
    setErr(null)
    try {
      const res = await instructorApiFetch(`/api/instructor/recommendations/${id}`, {
        method: "PATCH",
        headers: buildInstructorAuthorizedApiHeaders({
          "Content-Type": "application/json",
          "x-instructor-id": String(inst.id),
        }),
        body: JSON.stringify({ action: "approve" }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || "Failed")
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed")
    } finally {
      setActionBusy(null)
    }
  }

  const openReject = (id: number) => {
    setRejectTargetId(id)
    setRejectReason("")
    setRejectOpen(true)
  }

  const submitReject = async () => {
    if (rejectTargetId == null) return
    const inst = getInstructorData()
    if (!inst?.id) return
    setRejectSubmitting(true)
    setErr(null)
    try {
      const res = await instructorApiFetch(`/api/instructor/recommendations/${rejectTargetId}`, {
        method: "PATCH",
        headers: buildInstructorAuthorizedApiHeaders({
          "Content-Type": "application/json",
          "x-instructor-id": String(inst.id),
        }),
        body: JSON.stringify({ action: "reject", reason: rejectReason }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || "Failed")
      setRejectOpen(false)
      setRejectTargetId(null)
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed")
    } finally {
      setRejectSubmitting(false)
    }
  }

  /** Grid cells are narrow — allow shrink + truncate labels (Button defaults include shrink-0 + whitespace-nowrap). */
  const actionBtnClass =
    "flex h-9 w-full min-w-0 max-w-full shrink items-center justify-center gap-1 rounded-md px-1.5 text-[11px] font-medium leading-tight shadow-none whitespace-normal sm:gap-1.5 sm:px-2 sm:text-xs [&_svg]:size-3.5 [&_svg]:shrink-0"

  const actionLabel = (text: string) => (
    <span className="min-w-0 flex-1 truncate text-center">{text}</span>
  )

  function RequestItem({ r, layout }: { r: Row; layout: "grid" | "list" }) {
    const isPending = r.status === "requested"
    const busy = actionBusy === r.id

    const statusChip = (
      <span
        className={cn(
          "inline-flex shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
          statusBadgeStyles(r.status),
        )}
      >
        {r.status.replace(/_/g, " ")}
      </span>
    )

    const actionBar = (
      <div
        role="group"
        aria-label="Request actions"
        className={cn(
          "grid w-full min-w-0 gap-1.5 sm:gap-2",
          isPending ? "grid-cols-4" : "grid-cols-2",
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={actionBtnClass}
          onClick={() => openModal(r.id)}
          aria-label={`View details for ${r.student_name}`}
        >
          <Eye />
          {actionLabel("View")}
        </Button>
        {isPending ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              actionBtnClass,
              "border-emerald-500/70 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white dark:border-emerald-500/50 dark:bg-emerald-600 dark:hover:bg-emerald-500",
              busy && "justify-center",
            )}
            disabled={busy}
            onClick={() => void quickApprove(r.id)}
            aria-label={`Quick approve ${r.student_name}`}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Check />}
            {!busy ? actionLabel("Approve") : null}
          </Button>
        ) : null}
        {isPending ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              actionBtnClass,
              "border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/50",
            )}
            disabled={busy}
            onClick={() => openReject(r.id)}
            aria-label={`Reject request from ${r.student_name}`}
          >
            <X />
            {actionLabel("Reject")}
          </Button>
        ) : null}
        <Button variant="outline" size="sm" className={cn(actionBtnClass, "border-slate-200 dark:border-slate-600")} asChild>
          <Link
            href={`/instructor/dashboard-v2/recommendations/${r.id}`}
            className="min-w-0 max-w-full justify-center no-underline"
            aria-label="Open workspace"
          >
            <ExternalLink />
            {actionLabel("Workspace")}
          </Link>
        </Button>
      </div>
    )

    if (layout === "list") {
      return (
        <CardWrapper delay={0} hover={false} className="min-w-0">
          <div
            className={cn(
              "flex min-w-0 flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4",
            )}
          >
            <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{r.student_name}</p>
              {statusChip}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-600 dark:text-slate-300">{r.course_code}</span>
              {" · "}
              {purposeLabel(r.purpose)}
              {" · "}
              {r.deadline ? formatRequestDeadline(r.deadline) : "No deadline"}
            </p>
            {String(r.student_request_description ?? "").trim() ? (
              <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-snug">
                {String(r.student_request_description).trim()}
              </p>
            ) : null}
            {r.latest_pdf_url ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">PDF on file</p>
            ) : null}
          </div>
            <div className="min-w-0 border-t border-slate-100 px-2 py-2 dark:border-slate-800 sm:w-auto sm:border-l sm:border-t-0 sm:px-3 sm:pt-0 lg:min-w-[19rem]">
              {actionBar}
            </div>
          </div>
        </CardWrapper>
      )
    }

    return (
      <CardWrapper delay={0} hover={false} className="h-full min-w-0">
        <div className="flex h-full min-h-[19rem] min-w-0 flex-col p-4 sm:p-4">
          <div className="flex items-start justify-between gap-2 border-b border-slate-200/70 pb-3 dark:border-white/[0.08]">
            <h3 className="min-w-0 text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">
              {r.student_name}
            </h3>
            {statusChip}
          </div>
          <div className="grid flex-1 grid-cols-1 gap-3 py-3 text-xs sm:grid-cols-1">
            <div className="rounded-lg bg-slate-50/80 px-2.5 py-2 dark:bg-white/[0.04]">
              <p className="text-slate-500 dark:text-slate-400">Course</p>
              <p className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">{r.course_code}</p>
            </div>
            <div className="rounded-lg bg-slate-50/80 px-2.5 py-2 dark:bg-white/[0.04]">
              <p className="text-slate-500 dark:text-slate-400">Purpose</p>
              <p className="mt-0.5 text-slate-700 dark:text-slate-300">{purposeLabel(r.purpose)}</p>
            </div>
            <div className="rounded-lg bg-slate-50/80 px-2.5 py-2 dark:bg-white/[0.04]">
              <p className="text-slate-500 dark:text-slate-400">Deadline</p>
              <p className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">
                {r.deadline ? formatRequestDeadline(r.deadline) : "—"}
              </p>
            </div>
            {String(r.student_request_description ?? "").trim() ? (
              <div className="rounded-lg bg-slate-50/80 px-2.5 py-2 dark:bg-white/[0.04] sm:col-span-1">
                <p className="text-slate-500 dark:text-slate-400">Student note</p>
                <p className="mt-0.5 text-slate-700 dark:text-slate-300 line-clamp-3 leading-snug">
                  {String(r.student_request_description).trim()}
                </p>
              </div>
            ) : null}
          </div>
          {r.latest_pdf_url ? (
            <p className="-mt-1 pb-2 text-xs text-emerald-600 dark:text-emerald-400">PDF on file</p>
          ) : null}
          <div className="mt-auto min-w-0 border-t border-slate-200/70 pt-3 dark:border-white/[0.08]">
            {actionBar}
          </div>
        </div>
      </CardWrapper>
    )
  }

  function BucketPanel({ b }: { b: InstructorRecommendationsListBucket }) {
    const raw = tabRowsFor(b)
    const filtered = sortRows(filterRows(raw, search), sort)
    const emptyTitle =
      search.trim() && raw.length > 0
        ? "No matching requests"
        : b === "all"
          ? "No letter requests"
          : b === "pending"
            ? "No pending requests"
            : b === "active"
              ? "No active requests"
              : "No completed requests yet"
    const emptyDesc =
      search.trim() && raw.length > 0
        ? "Try a different search or clear the filter."
        : b === "all"
          ? "When students request letters from you, they will appear here."
          : b === "pending"
            ? "When students submit a letter request, it will show up here for approval."
            : b === "active"
              ? "Approved and in-progress letters will appear here."
              : "Finalized, downloaded, or rejected requests will be listed here."

    return (
      <div
        className={cn(
          filtered.length === 0
            ? cn(AM_PANEL_SECTION, "min-h-0 flex-1")
            : cn(
                "grid items-stretch gap-4",
                viewMode === "grid" && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4",
                viewMode === "list" && "grid-cols-1",
                AM_PANEL_SCROLL,
              ),
        )}
      >
        {filtered.length === 0 ? (
          <EmptyPanel title={emptyTitle} description={emptyDesc} />
        ) : (
          filtered.map((r) => <RequestItem key={r.id} r={r} layout={viewMode} />)
        )}
      </div>
    )
  }

  const bucketLabel: Record<InstructorRecommendationsListBucket, string> = {
    all: "All letters",
    pending: "Pending",
    active: "Active",
    done: "Done",
  }

  const bucketRows = sortRows(filterRows(tabRowsFor(bucket), search), sort)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex min-h-0 flex-1 flex-col overflow-hidden w-full min-w-0"
    >
      <InstructorRequestReviewModal
        requestId={modalId}
        open={modalOpen}
        onOpenChange={(o) => {
          setModalOpen(o)
          if (!o) setModalId(null)
        }}
        onListRefresh={() => void refresh()}
      />

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent className="rounded-2xl border-slate-200/90 dark:border-white/[0.1]">
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this request?</AlertDialogTitle>
            <AlertDialogDescription>
              The student will see your reason below. You can leave it brief if you already discussed this with them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            className="rounded-xl min-h-[88px] text-sm"
            placeholder="Reason (optional but recommended)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={rejectSubmitting}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              disabled={rejectSubmitting}
              onClick={() => void submitReject()}
            >
              {rejectSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject request"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className={cn(AM_PANEL_SECTION, "gap-3")}>
        {err && (
          <p className="shrink-0 text-sm text-red-600 dark:text-red-400 rounded-lg border border-red-200/80 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/30 px-3 py-2">
            {err}
          </p>
        )}

        <div className="shrink-0">
          <FacultyIntegratedToolbar
          moduleId="recommendations"
          search={search}
          onSearchChange={setSearch}
          onSearchClear={() => setSearch("")}
          searchPlaceholder="Search student, course, status…"
          filters={
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className={cn(facultyToolbarFilterButtonClass(), "h-9 min-w-[9rem] shadow-none")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Newest first</SelectItem>
                <SelectItem value="deadline_asc">Deadline (soonest)</SelectItem>
                <SelectItem value="name_asc">Student A–Z</SelectItem>
              </SelectContent>
            </Select>
          }
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          meta={
            <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>
              {bucketLabel[bucket]} · {bucketRows.length} request{bucketRows.length === 1 ? "" : "s"}
            </span>
          }
        />
        </div>

        <BucketPanel b={bucket} />
      </div>
    </motion.div>
  )
}
