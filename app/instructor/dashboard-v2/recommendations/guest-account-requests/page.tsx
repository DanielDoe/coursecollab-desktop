"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Mail,
  Microscope,
  UserPlus,
} from "lucide-react"
import { getInstructorData } from "@/lib/auth"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { useToast } from "@/components/ui/use-toast"
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
import { cn } from "@/lib/utils"

function GuestCourseMetricsCard({
  lettersTotal,
  lettersDone,
  inPipeline,
  awaitingYou,
  awaitingThem,
}: {
  lettersTotal: number
  lettersDone: number
  inPipeline: number
  awaitingYou: number
  awaitingThem: number
}) {
  const valueTone = (emphasis: "default" | "emerald" | "amber") =>
    emphasis === "emerald"
      ? "text-emerald-700 dark:text-emerald-400"
      : emphasis === "amber"
        ? "text-amber-800 dark:text-amber-200"
        : "text-slate-900 dark:text-slate-50"

  const statBlocks: {
    icon: typeof FileText
    label: string
    sub: string
    value: number
    emphasis: "default" | "emerald" | "amber"
  }[] = [
    { icon: FileText, label: "Letters", sub: "In this course", value: lettersTotal, emphasis: "default" },
    { icon: CheckCircle2, label: "Done", sub: "Exported or finalized", value: lettersDone, emphasis: "emerald" },
    { icon: Activity, label: "Pipeline", sub: "In progress", value: inPipeline, emphasis: inPipeline > 0 ? "amber" : "default" },
  ]

  return (
    <div
      className="mt-3 w-full min-w-0 rounded-xl border border-slate-200/90 bg-white/60 p-3 sm:mt-4 sm:p-4 dark:border-white/[0.1] dark:bg-white/[0.03]"
      role="region"
      aria-label="Recommendation letter metrics for this course"
    >
      <div className="border-b border-slate-100 pb-3 dark:border-white/[0.08]">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Letter metrics · this course only</p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
          Counts use this Career Member&apos;s email with <span className="font-medium text-slate-800 dark:text-slate-200">you</span> in the{" "}
          <span className="font-medium text-slate-800 dark:text-slate-200">selected course</span>—not other instructors, sections, or courses.
        </p>
      </div>
      <div className="mt-3 rounded-lg bg-slate-50/90 px-2 py-3 dark:bg-white/[0.04] sm:px-3 sm:py-3.5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          {statBlocks.map(({ icon: Icon, label, sub, value, emphasis }, i) => (
            <div key={i} className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
                <span className="min-w-0 leading-snug">{label}</span>
              </div>
              <p className="mt-0.5 pl-5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">{sub}</p>
              <p className={cn("mt-1 pl-5 tabular-nums text-xl font-semibold leading-none tracking-tight sm:text-2xl", valueTone(emphasis))}>
                {value}
              </p>
            </div>
          ))}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800 dark:text-slate-200">
              <Clock className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
              <span className="min-w-0 leading-snug">Awaiting</span>
            </div>
            <p className="mt-0.5 pl-5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">Who owes the next step</p>
            <div className="mt-2 grid grid-cols-2 gap-2 pl-5">
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  <Microscope className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                  <span>You</span>
                </div>
                <p
                  className={cn(
                    "tabular-nums text-xl font-semibold leading-none tracking-tight sm:text-2xl",
                    valueTone(awaitingYou > 0 ? "amber" : "default"),
                  )}
                >
                  {awaitingYou}
                </p>
              </div>
              <div className="min-w-0 border-l border-slate-200/90 pl-2 dark:border-white/[0.1]">
                <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  <UserPlus className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                  <span>Them</span>
                </div>
                <p className={cn("tabular-nums text-xl font-semibold leading-none tracking-tight sm:text-2xl", valueTone("default"))}>
                  {awaitingThem}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export type RecommendationGuestInsightRow = {
  id: number
  full_name: string
  student_id: string
  section: string
  email: string
  status: string
  created_at?: string | null
  approved_at?: string | null
  rejected_at?: string | null
  rejection_reason?: string | null
  request_kind?: string | null
  guest_purpose?: string | null
  guest_purpose_detail?: string | null
  organization?: string | null
  matching_student_found?: boolean
  rec_letter_total?: number
  rec_letter_completed?: number
  rec_pipeline?: number
  rec_pending_your_review?: number
  rec_awaiting_student?: number
  last_request_submitted_at?: string | null
  last_request_updated_at?: string | null
  newest_deadline?: string | null
}

type SortKey = "submitted_desc" | "submitted_asc" | "letters_desc" | "name_asc" | "recent_activity_desc"
type StatusFilter = "all" | "pending" | "approved" | "rejected"

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtRelativeHint(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 14) return `${days}d ago`
  if (days < 60) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function statusBadgeClass(status: string): string {
  switch (String(status).toLowerCase()) {
    case "pending":
      return "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100"
    case "approved":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
    case "rejected":
      return "border-red-500/25 bg-red-500/10 text-red-800 dark:text-red-200"
    default:
      return "border-slate-200 bg-slate-500/10 text-slate-700 dark:border-white/10 dark:text-slate-200"
  }
}

function matchesSearch(r: RecommendationGuestInsightRow, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  const hay = [
    r.full_name,
    r.email,
    r.organization,
    r.section,
    r.student_id,
    r.status,
    r.guest_purpose_detail,
    r.rejection_reason,
  ]
    .map((x) => String(x ?? "").toLowerCase())
    .join(" ")
  return hay.includes(s)
}

export default function GuestRecommendationAccountRequestsPage() {
  const { courseScopeVersion } = useInstructorDashboardV2()
  const { toast } = useToast()
  const [rows, setRows] = useState<RecommendationGuestInsightRow[]>([])
  const [busy, setBusy] = useState(false)
  const [actionBusy, setActionBusy] = useState<number | null>(null)
  const [rejectId, setRejectId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [rejectSubmitting, setRejectSubmitting] = useState(false)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [sort, setSort] = useState<SortKey>("submitted_desc")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  const load = useCallback(async () => {
    const inst = getInstructorData()
    if (!inst?.id) return
    setBusy(true)
    try {
      const res = await instructorApiFetch("/api/instructor/recommendation-guest-account-requests", {
        headers: buildInstructorAuthorizedApiHeaders({ "x-instructor-id": String(inst.id) }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || "Failed to load requests")
      setRows(Array.isArray(j.requests) ? j.requests : [])
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not load requests",
        description: e instanceof Error ? e.message : "Unknown error",
      })
      setRows([])
    } finally {
      setBusy(false)
    }
  }, [courseScopeVersion, toast])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    let out = rows.filter((r) => matchesSearch(r, search))
    if (statusFilter !== "all") {
      out = out.filter((r) => String(r.status).toLowerCase() === statusFilter)
    }
    const copy = [...out]
    copy.sort((a, b) => {
      if (sort === "name_asc") {
        return a.full_name.localeCompare(b.full_name, undefined, { sensitivity: "base" })
      }
      if (sort === "letters_desc") {
        return (Number(b.rec_letter_total) || 0) - (Number(a.rec_letter_total) || 0)
      }
      if (sort === "submitted_asc" || sort === "submitted_desc") {
        const ta = new Date(String(a.created_at ?? 0)).getTime()
        const tb = new Date(String(b.created_at ?? 0)).getTime()
        return sort === "submitted_desc" ? tb - ta : ta - tb
      }
      // recent_activity_desc — last touched on any letter then submitted
      const act = (x: RecommendationGuestInsightRow) => {
        const t1 = x.last_request_updated_at ? new Date(String(x.last_request_updated_at)).getTime() : 0
        const t2 = x.created_at ? new Date(String(x.created_at)).getTime() : 0
        return Math.max(t1, t2)
      }
      return act(b) - act(a)
    })
    return copy
  }, [rows, search, statusFilter, sort])


  const approve = async (id: number) => {
    const inst = getInstructorData()
    if (!inst?.id) return
    setActionBusy(id)
    try {
      const res = await instructorApiFetch(`/api/instructor/account-requests/${id}/approve`, {
        method: "POST",
        headers: buildInstructorAuthorizedApiHeaders({
          "Content-Type": "application/json",
          "x-instructor-id": String(inst.id),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Approve failed")
      toast({
        title: "Career Member approved",
        description: String(data.message ?? "They can sign in with the Career Member page using their email and password."),
      })
      await load()
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Approve failed",
        description: e instanceof Error ? e.message : "Failed",
      })
    } finally {
      setActionBusy(null)
    }
  }

  const submitReject = async () => {
    if (rejectId == null) return
    const inst = getInstructorData()
    if (!inst?.id) return
    setRejectSubmitting(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/account-requests/${rejectId}/reject`, {
        method: "POST",
        headers: buildInstructorAuthorizedApiHeaders({
          "Content-Type": "application/json",
          "x-instructor-id": String(inst.id),
        }),
        body: JSON.stringify({ reason: rejectReason || "No reason provided" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Reject failed")
      toast({ title: "Request rejected" })
      setRejectId(null)
      setRejectReason("")
      await load()
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Reject failed",
        description: e instanceof Error ? e.message : "Failed",
      })
    } finally {
      setRejectSubmitting(false)
    }
  }

  function GuestRowCard({ r, layout }: { r: RecommendationGuestInsightRow; layout: "grid" | "list" }) {
    const pending = String(r.status).toLowerCase() === "pending"
    const b = actionBusy === r.id
    const nr = Number(r.rec_letter_total) || 0
    const done = Number(r.rec_letter_completed) || 0
    const pipe = Number(r.rec_pipeline) || 0
    const awaitInstr = Number(r.rec_pending_your_review) || 0
    const awaitStudent = Number(r.rec_awaiting_student) || 0
    const hasProfile = Boolean(r.matching_student_found)

    const actionBtnClass =
      "flex h-9 min-h-0 w-full min-w-0 shrink items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium shadow-none sm:text-sm [&_svg]:size-3.5 [&_svg]:shrink-0"

    const actions = (
      <div className="flex w-full shrink-0 flex-row gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            actionBtnClass,
            "flex-1 border-emerald-500/70 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white dark:border-emerald-500/50 dark:bg-emerald-600 dark:hover:bg-emerald-500",
          )}
          disabled={!pending || b}
          onClick={() => void approve(r.id)}
        >
          {b ? <Loader2 className="animate-spin" aria-hidden /> : "Approve"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            actionBtnClass,
            "flex-1 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/50",
          )}
          disabled={!pending || b}
          onClick={() => {
            setRejectId(r.id)
            setRejectReason("")
          }}
        >
          Reject
        </Button>
      </div>
    )

    const detailsBlock = (
      <div className="mt-3 flex min-w-0 flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-start sm:gap-2">
        <Badge variant="outline" className={cn("inline-flex max-w-full justify-start whitespace-normal rounded-md px-2 py-0.5 text-left font-normal capitalize", statusBadgeClass(r.status))}>
          {r.status}
        </Badge>
        {hasProfile ? (
          <Badge variant="outline" className="inline-flex max-w-full gap-1 rounded-md border-green-600/35 bg-green-600/10 text-left font-normal text-green-900 dark:border-green-500/35 dark:bg-green-500/15 dark:text-green-300">
            <CheckCircle2 className="mt-px h-3 w-3 shrink-0" aria-hidden />
            <span className="leading-snug">
              <span className="sm:hidden">Profile linked</span>
              <span className="hidden sm:inline">Career Member profile matched to platform login</span>
            </span>
          </Badge>
        ) : (
          <Badge variant="outline" className="inline-flex max-w-full justify-start whitespace-normal rounded-md border-slate-300/80 bg-slate-400/10 text-left font-normal text-slate-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
            <span className="leading-snug">
              <span className="sm:hidden">Awaiting signup</span>
              <span className="hidden sm:inline">No platform profile · stats populate after signup</span>
            </span>
          </Badge>
        )}
        {(awaitInstr > 0 || pipe > 0 || done > 0) && nr > 0 ? (
          <Badge variant="outline" className="inline-flex max-w-full gap-1 rounded-md border-violet-500/30 bg-violet-500/[0.08] text-left font-normal text-violet-900 dark:text-violet-200">
            <FileText className="mt-px h-3 w-3 shrink-0" aria-hidden />
            <span>
              <span className="font-semibold tabular-nums">{nr}</span> letters tracked
            </span>
          </Badge>
        ) : null}
      </div>
    )

    const metricsBlock = (
      <GuestCourseMetricsCard
        lettersTotal={nr}
        lettersDone={done}
        inPipeline={pipe}
        awaitingYou={awaitInstr}
        awaitingThem={awaitStudent}
      />
    )

    const timelineRow = (
      <div className="mt-4 min-w-0 space-y-2 text-[11px] text-slate-500 dark:text-slate-400">
        <p className="break-words">
          Applied{" "}
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {fmtDate(r.created_at)} <span className="tabular-nums opacity-75">({fmtRelativeHint(r.created_at)})</span>
          </span>
        </p>
        {!pending && String(r.status).toLowerCase() === "approved" ? (
          <p>
            Approved <span className="font-medium text-slate-700 dark:text-slate-200">{fmtDate(r.approved_at)}</span>
          </p>
        ) : null}
        {String(r.status).toLowerCase() === "rejected" ? (
          <p className="break-words text-red-700/90 dark:text-red-300">
            Rejected {fmtDate(r.rejected_at)}
            {r.rejection_reason ? <span className="mt-1 block italic opacity-95">Reason: {String(r.rejection_reason)}</span> : null}
          </p>
        ) : null}
        {nr > 0 ? (
          <div className="space-y-1.5">
            <p className="break-words">
              Last letter motion{" "}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {fmtDate(r.last_request_updated_at)}{" "}
                <span className="tabular-nums opacity-75">({fmtRelativeHint(r.last_request_updated_at)})</span>
              </span>
            </p>
            {r.newest_deadline ? (
              <p className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 break-words text-amber-800 dark:text-amber-300">
                <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />{" "}
                <span>Deadline on file:</span>
                <span className="font-medium">{fmtDate(r.newest_deadline)}</span>
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-[11px] italic leading-relaxed opacity-95">Letter activity appears after they submit a request with this email.</p>
        )}
      </div>
    )

    if (layout === "list") {
      return (
        <CardWrapper delay={0} hover={false} className="min-w-0 max-w-full overflow-hidden">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between lg:p-5">
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{r.full_name}</p>
              <p className="mt-1 flex min-w-0 items-start gap-1.5 text-xs leading-snug text-slate-600 dark:text-slate-300">
                <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                <span className="min-w-0 break-words [overflow-wrap:anywhere]">{r.email}</span>
              </p>
              {String(r.organization ?? "").trim() ? (
                <p className="mt-1 text-xs text-slate-500">{String(r.organization).trim()}</p>
              ) : null}
              {String(r.guest_purpose_detail ?? "").trim() ? (
                <blockquote className="mt-3 border-l-2 border-emerald-500/50 pl-3 text-xs italic text-slate-600 dark:text-slate-400">
                  {String(r.guest_purpose_detail).trim()}
                </blockquote>
              ) : null}
              {detailsBlock}
              {metricsBlock}
              {timelineRow}
            </div>
            <div className="flex w-full min-w-0 flex-col gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 sm:w-auto sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 md:max-w-[12rem]">
              {actions}
              <Link
                href="/instructor/dashboard-v2/recommendations/pending"
                className="mt-3 block text-center text-[10px] text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
              >
                Open pending letters queue →
              </Link>
            </div>
          </div>
        </CardWrapper>
      )
    }

    return (
      <CardWrapper delay={0} hover={false} className="flex h-full min-w-0 max-w-full flex-col overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5">
          <div className="flex min-w-0 items-start gap-3 border-b border-slate-100 pb-3 dark:border-white/[0.08]">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">{r.full_name}</p>
              <p className="break-words text-xs leading-snug text-slate-600 [overflow-wrap:anywhere] dark:text-slate-400">{r.email}</p>
            </div>
            <Badge variant="outline" className={cn("ml-auto shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 capitalize text-[10px] sm:text-xs", statusBadgeClass(r.status))}>
              {r.status}
            </Badge>
          </div>
          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <p className="flex min-w-0 gap-2">
              <span className="shrink-0 text-slate-400">Org</span>
              <span className={cn("min-w-0 break-words leading-snug", !String(r.organization ?? "").trim() && "italic text-slate-400")}>{String(r.organization ?? "").trim() || "—"}</span>
            </p>
          </div>
          {detailsBlock}
          {metricsBlock}
          {timelineRow}
          <div className="mt-auto border-t border-slate-100 pt-4 dark:border-white/[0.08]">{actions}</div>
          <Link
            href="/instructor/dashboard-v2/recommendations/pending"
            className="block text-center text-[10px] leading-snug text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
          >
            Pending letters queue →
          </Link>
        </div>
      </CardWrapper>
    )
  }

  const organizer = (
    <FacultyIntegratedToolbar
      moduleId="recommendations"
      search={search}
      onSearchChange={setSearch}
      onSearchClear={() => setSearch("")}
      searchPlaceholder="Search name, email, organization…"
      filters={
        <>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className={cn(facultyToolbarFilterButtonClass(statusFilter !== "all"), "h-9 min-w-[9rem] shadow-none")}>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className={cn(facultyToolbarFilterButtonClass(), "h-9 min-w-[10rem] shadow-none")}>
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="submitted_desc">Newest application</SelectItem>
              <SelectItem value="submitted_asc">Oldest application</SelectItem>
              <SelectItem value="letters_desc">Most letters in course</SelectItem>
              <SelectItem value="recent_activity_desc">Recent letter activity</SelectItem>
              <SelectItem value="name_asc">Applicant A–Z</SelectItem>
            </SelectContent>
          </Select>
        </>
      }
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      meta={
        busy ? null : (
          <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            Career Member requests · {filtered.length} applicant{filtered.length === 1 ? "" : "s"}
            {statusFilter !== "all" ? ` · ${statusFilter}` : ""}
          </span>
        )
      }
    />
  )

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full min-w-0 max-w-full space-y-3 overflow-x-hidden pb-4">
      {organizer}

      {busy ? (
        <CardWrapper hover={false} delay={0} className="flex items-center gap-3 p-8 text-sm text-slate-600 dark:text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading requests…
        </CardWrapper>
      ) : rows.length === 0 ? (
        <CardWrapper hover={false} delay={0} className="p-10 text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-slate-400" aria-hidden />
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">No Career Member recommendation-letter requests</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            When someone sends you a recommendation request from a Career Member account, it appears in Letters. Account creation is open — you gate the letter, not the platform.
          </p>
        </CardWrapper>
      ) : filtered.length === 0 ? (
        <CardWrapper hover={false} delay={0} className="p-10 text-center text-sm text-slate-600 dark:text-slate-300">
          No rows match your search or filters. Clear the search box or set status to &quot;All&quot;.
        </CardWrapper>
      ) : (
        <div
          className={cn(
            "grid gap-4",
            viewMode === "grid" && "grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3",
            viewMode === "list" && "grid-cols-1",
          )}
        >
          {filtered.map((r) => (
            <GuestRowCard key={r.id} r={r} layout={viewMode} />
          ))}
        </div>
      )}

      <AlertDialog open={rejectId != null} onOpenChange={(o) => !o && !rejectSubmitting && setRejectId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this Career Member request?</AlertDialogTitle>
            <AlertDialogDescription>
              Explain briefly so staff records stay clear. They will not gain access unless they apply again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason (optional)"
            className="rounded-xl text-sm min-h-[88px]"
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
              onClick={() => void submitReject()}
              disabled={rejectSubmitting}
            >
              {rejectSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
