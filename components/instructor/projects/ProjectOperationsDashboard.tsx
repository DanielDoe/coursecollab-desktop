"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, ClipboardList, Download, ExternalLink, Gauge, Pencil, PenLine, RefreshCw, Send, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FacultyIntegratedToolbar, facultyToolbarFilterButtonClass } from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { cn } from "@/lib/utils"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { useToast } from "@/hooks/use-toast"

type Source = { key: string; label: string; weight: number }
type SectionCell = {
  section_key: string
  title: string
  points: number | null
  state: string
  updatedAt: string | null
}
type GroupRow = {
  projectId: number
  groupName: string
  session: string | null
  submissionStatus: string | null
  submittedAt: string | null
  updatedAt: string | null
  instructorPoints: number
  sections: SectionCell[]
}
type Activity = { at: string; actor: string; action: string; group: string; projectId: number }
type AssignmentInfo = {
  id: number
  title: string
  projectMode: string
  submissionMode: string
  dueAt: string | null
  maxPoints: number
  sources: Source[]
  presentationRequired: boolean
}

type PulseKey = "groups" | "progress" | "submitted" | "grading" | "average" | "attention"

const SUBMITTED = new Set(["SUBMITTED", "FINALIZED", "READY", "IN_REVIEW"])

function ago(iso: string | null) {
  if (!iso) return "no activity"
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (!Number.isFinite(mins)) return "no activity"
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function completion(row: GroupRow) {
  if (!row.sections.length) return row.submittedAt ? 1 : 0
  return row.sections.filter((s) => s.state === "complete").length / row.sections.length
}

function isSubmitted(row: GroupRow) {
  return Boolean(row.submittedAt) || SUBMITTED.has(String(row.submissionStatus || "").toUpperCase())
}

function submissionBucket(row: GroupRow): "not-started" | "progress" | "submitted" | "finalized" {
  const status = String(row.submissionStatus || "").toUpperCase()
  if (status === "FINALIZED") return "finalized"
  if (isSubmitted(row)) return "submitted"
  if (completion(row) > 0) return "progress"
  return "not-started"
}

function submissionLabel(bucket: ReturnType<typeof submissionBucket>) {
  if (bucket === "finalized") return "Finalized"
  if (bucket === "submitted") return "Submitted"
  if (bucket === "progress") return "In progress"
  return "Not started"
}

function attentionReasons(row: GroupRow, dueAt: string | null) {
  const reasons: string[] = []
  const flagged = row.sections.filter((s) => s.state === "attention")
  if (flagged.length) reasons.push(`${flagged.length} section${flagged.length === 1 ? "" : "s"} need attention`)
  const done = completion(row)
  if (dueAt) {
    const due = new Date(dueAt).getTime()
    const days = (due - Date.now()) / 86400000
    if (days < 0 && !isSubmitted(row)) reasons.push("Past the due date and not submitted")
    else if (days >= 0 && days <= 7 && done < 0.5) reasons.push("Due within 7 days and under halfway")
  }
  if (!isSubmitted(row) && row.sections.length > 0 && done === 0) reasons.push("Report not started")
  if (row.updatedAt) {
    const idleDays = (Date.now() - new Date(row.updatedAt).getTime()) / 86400000
    if (idleDays > 14 && done < 1 && !isSubmitted(row)) reasons.push("No report activity in 14 days")
  }
  if (isSubmitted(row) && row.instructorPoints <= 0) reasons.push("Submitted and waiting for a grade")
  return reasons
}

function stateMark(state: string) {
  if (state === "complete") return { mark: "✓", label: "Complete", className: "text-emerald-500" }
  if (state === "in_progress") return { mark: "◐", label: "In progress", className: "text-[var(--cc-accent)]" }
  if (state === "attention") return { mark: "!", label: "Needs attention", className: "text-amber-500" }
  return { mark: "○", label: "Not started", className: "text-[var(--cc-text-muted)]" }
}

export function ProjectOperationsDashboard({
  variant = "overview",
  onGrade,
}: {
  variant?: "overview" | "issues" | "submissions"
  onGrade: (projectId: number, title: string, groupName: string) => void
}) {
  const chrome = facultyEmbedChrome("projects")
  const { toast } = useToast()
  const router = useRouter()
  const { basePath } = useInstructorDashboardV2()
  const [options, setOptions] = useState<Array<{ id: number; title: string }>>([])
  const [assignmentId, setAssignmentId] = useState<number | null>(null)
  const [info, setInfo] = useState<AssignmentInfo | null>(null)
  const [rows, setRows] = useState<GroupRow[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [pulse, setPulse] = useState<PulseKey>("groups")
  const [cell, setCell] = useState<{ row: GroupRow; section: SectionCell } | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [issueQuery, setIssueQuery] = useState("")
  const [issueSession, setIssueSession] = useState<string | null>(null)
  const [issueKind, setIssueKind] = useState("all")
  const [submissionKind, setSubmissionKind] = useState("all")
  const [previewProjectId, setPreviewProjectId] = useState<number | null>(null)
  const [previewGroup, setPreviewGroup] = useState("")
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    void (async () => {
      const res = await instructorApiFetch("/api/instructor/project-assignments", {
        headers: buildInstructorApiHeaders(),
      })
      if (!res.ok) {
        setLoading(false)
        return
      }
      const data = await res.json()
      const list = (data.assignments ?? []) as Array<{ id: number; title: string; status?: string }>
      setOptions(list.map((a) => ({ id: a.id, title: a.title })))
      const published = list.find((a) => a.status === "published") ?? list[0]
      if (published) setAssignmentId(published.id)
      else setLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (!assignmentId) return
    setLoading(true)
    setCell(null)
    void (async () => {
      const res = await instructorApiFetch(
        `/api/instructor/projects/report-progress?assignmentId=${assignmentId}`,
        { headers: buildInstructorApiHeaders() },
      )
      if (!res.ok) {
        setRows([])
        setInfo(null)
        setActivity([])
        setLoading(false)
        return
      }
      const data = await res.json()
      setRows((data.matrix ?? []) as GroupRow[])
      setInfo((data.operations?.assignment ?? null) as AssignmentInfo | null)
      setActivity((data.operations?.activity ?? []) as Activity[])
      setLoading(false)
    })()
  }, [assignmentId, reloadKey])

  const structured = (info?.submissionMode ?? "").includes("STRUCTURED")
  const showAi = Boolean(info?.sources.some((s) => s.key === "ai"))
  const showVoting = Boolean(info?.sources.some((s) => s.key === "peer"))

  const attention = useMemo(
    () =>
      rows
        .map((row) => ({ row, reasons: attentionReasons(row, info?.dueAt ?? null) }))
        .filter((item) => item.reasons.length > 0),
    [rows, info?.dueAt],
  )

  const issueSessions = useMemo(
    () => [...new Set(rows.map((row) => row.session).filter((session): session is string => Boolean(session)))],
    [rows],
  )

  const visibleAttention = useMemo(() => {
    const query = issueQuery.trim().toLowerCase()
    return attention.filter((item) => {
      if (issueSession && item.row.session !== issueSession) return false
      const reasons = item.reasons.join(" ").toLowerCase()
      if (issueKind === "not-started" && !reasons.includes("not started")) return false
      if (issueKind === "idle" && !reasons.includes("activity")) return false
      if (issueKind === "due" && !reasons.includes("due")) return false
      if (issueKind === "grade" && !reasons.includes("grade")) return false
      if (issueKind === "sections" && !reasons.includes("section")) return false
      if (!query) return true
      return `${item.row.groupName} ${item.row.session ?? ""} ${reasons}`.toLowerCase().includes(query)
    })
  }, [attention, issueQuery, issueSession, issueKind])

  const visibleSubmissions = useMemo(() => {
    const query = issueQuery.trim().toLowerCase()
    return rows.filter((row) => {
      const bucket = submissionBucket(row)
      if (issueSession && row.session !== issueSession) return false
      if (submissionKind === "not-started" && bucket !== "not-started") return false
      if (submissionKind === "progress" && bucket !== "progress") return false
      if (submissionKind === "submitted" && bucket !== "submitted" && bucket !== "finalized") return false
      if (!query) return true
      return `${row.groupName} ${row.session ?? ""}`.toLowerCase().includes(query)
    })
  }, [rows, issueQuery, issueSession, submissionKind])

  const filtered = useMemo(() => {
    if (pulse === "progress") return rows.filter((row) => !isSubmitted(row) && completion(row) > 0 && completion(row) < 1)
    if (pulse === "submitted") return rows.filter(isSubmitted)
    if (pulse === "grading") return rows.filter((row) => isSubmitted(row) && row.instructorPoints <= 0)
    if (pulse === "attention") return attention.map((item) => item.row)
    return rows
  }, [pulse, rows, attention])

  const avg = rows.length ? Math.round((rows.reduce((sum, row) => sum + completion(row), 0) / rows.length) * 100) : 0
  const pulseItems: { key: PulseKey; label: string; value: string; icon: typeof Users }[] = [
    { key: "groups", label: info?.projectMode === "individual" ? "Students" : "Groups", value: String(rows.length), icon: Users },
    { key: "progress", label: "In progress", value: String(rows.filter((row) => !isSubmitted(row) && completion(row) > 0 && completion(row) < 1).length), icon: PenLine },
    { key: "submitted", label: "Submitted", value: String(rows.filter(isSubmitted).length), icon: Send },
    { key: "grading", label: "Need grading", value: String(rows.filter((row) => isSubmitted(row) && row.instructorPoints <= 0).length), icon: ClipboardList },
    { key: "average", label: "Avg progress", value: rows.length ? `${avg}%` : "—", icon: Gauge },
    { key: "attention", label: "Needs attention", value: String(attention.length), icon: AlertTriangle },
  ]

  const pipeline = [
    { label: "Not submitted", value: rows.filter((row) => !isSubmitted(row)).length },
    { label: "Submitted", value: rows.filter(isSubmitted).length },
    ...(showAi ? [] : []),
    { label: "Needs review", value: rows.filter((row) => isSubmitted(row) && row.instructorPoints <= 0).length },
    { label: "Graded", value: rows.filter((row) => row.instructorPoints > 0).length },
  ]

  const exportSubmissionReports = async () => {
    if (!rows.length || exporting) return
    setExporting(true)
    try {
      const JSZip = (await import("jszip")).default
      const zip = new JSZip()
      let added = 0
      for (const row of rows) {
        const res = await instructorApiFetch(`/api/projects/workspace/${row.projectId}/preview?format=pdf`)
        if (!res.ok) continue
        const slug = `${row.session || "session"}-${row.groupName}-${row.projectId}`
          .replace(/[^\w]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 80)
        zip.file(`${slug || `project-${row.projectId}`}.pdf`, await res.arrayBuffer())
        added += 1
      }
      if (!added) {
        toast({ title: "No reports to export", variant: "destructive" })
        return
      }
      const blob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "submission-reports.zip"
      link.click()
      URL.revokeObjectURL(url)
      toast({ title: "Reports exported", description: `${added} PDF${added === 1 ? "" : "s"} in the zip` })
    } catch (error) {
      toast({
        title: "Could not export reports",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  if (loading && !info && options.length === 0) {
    return <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Loading project operations…</p>
  }

  if (!assignmentId) {
    return <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Create a project in Project Setup to see operations here.</p>
  }

  if (variant === "submissions") {
    return (
      <div className="space-y-4">
        <FacultyIntegratedToolbar
          moduleId="projects"
          embedded
          searchCompact
          searchFill
          className="shrink-0"
          search={issueQuery}
          onSearchChange={setIssueQuery}
          onSearchClear={() => setIssueQuery("")}
          searchPlaceholder="Search groups…"
          filters={
            <>
              <Select value={issueSession || "all"} onValueChange={(value) => setIssueSession(value === "all" ? null : value)}>
                <SelectTrigger className={cn(facultyToolbarFilterButtonClass(Boolean(issueSession)), "h-9 w-[148px] shadow-none")}>
                  <SelectValue placeholder="Session" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sessions</SelectItem>
                  {issueSessions.map((session) => (
                    <SelectItem key={session} value={session}>{session}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={submissionKind} onValueChange={setSubmissionKind}>
                <SelectTrigger className={cn(facultyToolbarFilterButtonClass(submissionKind !== "all"), "h-9 w-[150px] shadow-none")}>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="not-started">Not started</SelectItem>
                  <SelectItem value="progress">In progress</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" size="sm" className={cn("h-9 gap-1.5 rounded-full px-4", chrome.quiet)} onClick={() => setReloadKey((key) => key + 1)}>
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                Refresh
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={exporting || rows.length === 0}
                className={cn("h-9 gap-1.5 rounded-full px-4", chrome.solid)}
                onClick={() => void exportSubmissionReports()}
              >
                <Download className={cn("h-3.5 w-3.5", exporting && "animate-pulse")} />
                {exporting ? "Exporting…" : "Export"}
              </Button>
            </>
          }
          meta={
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
              {visibleSubmissions.length} group{visibleSubmissions.length === 1 ? "" : "s"}
              {issueSession ? ` · ${issueSession}` : ""}
              {" · what has been turned in"}
            </p>
          }
        />
        <section className={cn(chrome.card, "overflow-hidden")}>
          {visibleSubmissions.length === 0 ? (
            <p className={cn("px-4 py-6 text-sm", PORTAL_TEXT_MUTED)}>
              {rows.length > 0 ? "No groups match this search." : "No groups have a project yet."}
            </p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {visibleSubmissions.map((row) => {
                const bucket = submissionBucket(row)
                const turnedIn = bucket === "submitted" || bucket === "finalized"
                const selected = previewProjectId === row.projectId
                return (
                  <div key={row.projectId} className={cn("flex items-center gap-3 px-4 py-3", selected && "bg-[var(--cc-accent-soft)]")}>
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-medium", PORTAL_TEXT)}>{row.groupName}</p>
                      <p className={cn("truncate text-xs", PORTAL_TEXT_MUTED)}>
                        {row.session ? `${row.session} · ` : ""}
                        {Math.round(completion(row) * 100)}% complete · {ago(row.updatedAt)}
                      </p>
                    </div>
                    <span className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      turnedIn ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : bucket === "progress" ? "bg-[var(--cc-accent-soft)] text-[var(--cc-accent)]" : "bg-[var(--muted)] text-[var(--cc-text-muted)]",
                    )}>
                      {submissionLabel(bucket)}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      className={chrome.solid}
                      onClick={() => {
                        setPreviewProjectId(row.projectId)
                        setPreviewGroup(row.groupName)
                      }}
                    >
                      Preview
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </section>
        <Dialog open={previewProjectId != null} onOpenChange={(open) => { if (!open) setPreviewProjectId(null) }}>
          <DialogContent className="grid h-[min(85vh,860px)] max-w-[calc(100%-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-4xl">
            <DialogHeader className="border-b border-[var(--border)] px-5 py-4 pr-12">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <DialogTitle>{previewGroup}</DialogTitle>
                  <DialogDescription>Read-only preview of the report. Scoring stays in Grading.</DialogDescription>
                </div>
                {previewProjectId ? (
                  <a
                    className={cn(chrome.solid, "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs")}
                    href={`/api/projects/workspace/${previewProjectId}/preview?format=pdf`}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                ) : null}
              </div>
            </DialogHeader>
            {previewProjectId ? (
              <iframe
                title={`${previewGroup} report preview`}
                className="h-full min-h-0 w-full bg-white"
                src={`/api/projects/workspace/${previewProjectId}/preview?format=html`}
              />
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  const dueLabel = info?.dueAt
    ? new Date(info.dueAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "No due date"

  return (
    <div className="space-y-4">
      {variant === "overview" ? (
        <section className={cn(chrome.card, "space-y-3 p-4")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              {options.length > 1 ? (
                <Select value={String(assignmentId)} onValueChange={(v) => setAssignmentId(Number(v))}>
                  <SelectTrigger className="h-9 max-w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((option) => (
                      <SelectItem key={option.id} value={String(option.id)}>
                        {option.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className={cn("text-base font-semibold", PORTAL_TEXT)}>{info?.title ?? "Project"}</p>
              )}
              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                {info?.projectMode === "individual" ? "Individual" : "Group"}
                {" · "}
                {structured ? "Structured report" : "Freeform submission"}
                {" · Due "}
                {dueLabel}
                {" · "}
                {info?.maxPoints ?? 0} pts
                {" · "}
                {rows.length} {info?.projectMode === "individual" ? "student" : "group"}
                {rows.length === 1 ? "" : "s"}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(info?.sources ?? []).filter((source) => source.key !== "ai" || showAi).filter((source) => source.key !== "peer" || showVoting).map((source) => (
                  <span key={source.key} className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-[11px] text-[var(--cc-text)]">
                    {source.label} {source.weight}%
                  </span>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                size="sm"
                className={chrome.solid}
                onClick={() => router.push(`${basePath}/management/projects/setup/${assignmentId}/edit`)}
              >
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Edit project
              </Button>
              <Button
                type="button"
                size="sm"
                className={chrome.quiet}
                disabled={!rows[0]}
                onClick={() => {
                  if (!rows[0]) return
                  window.open(`/api/projects/workspace/${rows[0].projectId}/preview?format=html`, "_blank", "noopener")
                }}
              >
                <ExternalLink className="mr-1 h-3.5 w-3.5" />
                Preview
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {variant === "overview" ? (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-[var(--border)] @[520px]/projects-panel:grid-cols-3 @[760px]/projects-panel:grid-cols-6">
          {pulseItems.map((item) => {
            const Icon = item.icon
            const selected = pulse === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setPulse(item.key)}
                className={cn(
                  "flex items-center gap-2.5 bg-[var(--card)] px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
                  selected && "bg-[var(--cc-accent-soft)]",
                )}
              >
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", selected ? "bg-[var(--cc-accent)] text-white" : "bg-[var(--muted)]")}>
                  <Icon className={cn("h-4 w-4", selected ? "!text-white" : "text-[var(--cc-text-muted)]")} />
                </span>
                <span className="min-w-0">
                  <span className={cn("block truncate text-[11px]", PORTAL_TEXT_MUTED)}>{item.label}</span>
                  <span className={cn("block text-base font-semibold tabular-nums leading-tight", PORTAL_TEXT)}>{item.value}</span>
                </span>
              </button>
            )
          })}
        </div>
      ) : null}

      {variant === "issues" ? (
        <FacultyIntegratedToolbar
          moduleId="projects"
          embedded
          searchCompact
          searchFill
          className="shrink-0"
          search={issueQuery}
          onSearchChange={setIssueQuery}
          onSearchClear={() => setIssueQuery("")}
          searchPlaceholder="Search groups…"
          filters={
            <>
              <Select value={issueSession || "all"} onValueChange={(value) => setIssueSession(value === "all" ? null : value)}>
                <SelectTrigger className={cn(facultyToolbarFilterButtonClass(Boolean(issueSession)), "h-9 w-[148px] shadow-none")}>
                  <SelectValue placeholder="Session" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sessions</SelectItem>
                  {issueSessions.map((session) => (
                    <SelectItem key={session} value={session}>{session}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={issueKind} onValueChange={setIssueKind}>
                <SelectTrigger className={cn(facultyToolbarFilterButtonClass(issueKind !== "all"), "h-9 w-[160px] shadow-none")}>
                  <SelectValue placeholder="Issue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All issues</SelectItem>
                  <SelectItem value="not-started">Not started</SelectItem>
                  <SelectItem value="sections">Section problems</SelectItem>
                  <SelectItem value="due">Deadline</SelectItem>
                  <SelectItem value="idle">No recent activity</SelectItem>
                  <SelectItem value="grade">Waiting for a grade</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                className={cn("h-9 gap-1.5 rounded-full px-4", chrome.quiet)}
                onClick={() => setReloadKey((key) => key + 1)}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                Refresh
              </Button>
            </>
          }
          meta={
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
              {visibleAttention.length} issue{visibleAttention.length === 1 ? "" : "s"}
              {issueSession ? ` · ${issueSession}` : ""}
            </p>
          }
        />
      ) : null}

      <section className={cn(chrome.card, "overflow-hidden")}>
        <div className="border-b border-[var(--border)] px-4 py-3">
          <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Needs attention</p>
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Groups that need a decision from you.</p>
        </div>
        {(variant === "issues" ? visibleAttention : attention).length === 0 ? (
          <p className={cn("px-4 py-6 text-sm", PORTAL_TEXT_MUTED)}>
            {variant === "issues" && attention.length > 0 ? "No issues match this search." : "Nothing is waiting on you right now."}
          </p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {(variant === "issues" ? visibleAttention : pulse === "attention" ? attention : attention.slice(0, 4)).map((item) => (
              <div key={item.row.projectId} className="flex items-start gap-3 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{item.row.groupName}</p>
                  <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{item.reasons.join(" · ")}</p>
                </div>
                <Button type="button" size="sm" className={chrome.solid} onClick={() => onGrade(item.row.projectId, info?.title ?? "Project", item.row.groupName)}>
                  Grade
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {variant === "issues" ? null : structured ? (
        <section className={cn(chrome.card, "overflow-hidden")}>
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Report progress</p>
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>✓ complete · ◐ in progress · ○ not started · ! needs attention</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className={cn("px-3 py-2 text-left font-medium", PORTAL_TEXT_MUTED)}>Group</th>
                  {(filtered[0]?.sections ?? rows[0]?.sections ?? []).map((section, index) => (
                    <th key={section.section_key} className={cn("px-2 py-2 text-center font-medium", PORTAL_TEXT_MUTED)} title={section.title}>
                      {index + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.projectId} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-3 py-2">
                      <button type="button" className={cn("text-left text-sm font-medium", PORTAL_TEXT)} onClick={() => onGrade(row.projectId, info?.title ?? "Project", row.groupName)}>
                        {row.groupName}
                      </button>
                      <p className={cn("text-[11px]", PORTAL_TEXT_MUTED)}>{Math.round(completion(row) * 100)}% · {ago(row.updatedAt)}</p>
                    </td>
                    {row.sections.map((section) => {
                      const mark = stateMark(section.state)
                      return (
                        <td key={section.section_key} className="px-1 py-2 text-center">
                          <button
                            type="button"
                            title={`${section.title}: ${mark.label}`}
                            className={cn("h-7 w-7 rounded-md hover:bg-muted/50", mark.className)}
                            onClick={() => setCell({ row, section })}
                          >
                            {mark.mark}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cell ? (
            <div className="border-t border-[var(--border)] px-4 py-3 text-sm">
              <p className={cn("font-medium", PORTAL_TEXT)}>{cell.section.title}</p>
              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                {cell.row.groupName}
                {" · "}
                {stateMark(cell.section.state).label}
                {cell.section.points ? ` · ${cell.section.points} pts` : ""}
                {" · "}
                {ago(cell.section.updatedAt)}
              </p>
              <Button type="button" size="sm" className={cn("mt-2", chrome.quiet)} onClick={() => onGrade(cell.row.projectId, info?.title ?? "Project", cell.row.groupName)}>
                Open report
              </Button>
            </div>
          ) : null}
        </section>
      ) : (
        <section className={cn(chrome.card, "divide-y divide-[var(--border)] overflow-hidden")}>
          <div className="px-4 py-3">
            <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Submission progress</p>
          </div>
          {filtered.map((row) => (
            <button
              key={row.projectId}
              type="button"
              onClick={() => onGrade(row.projectId, info?.title ?? "Project", row.groupName)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40"
            >
              <span>
                <span className={cn("block text-sm font-medium", PORTAL_TEXT)}>{row.groupName}</span>
                <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>{row.submissionStatus || "Not started"} · {ago(row.updatedAt)}</span>
              </span>
              <span className={cn("text-sm tabular-nums", PORTAL_TEXT)}>{isSubmitted(row) ? "Submitted" : "Open"}</span>
            </button>
          ))}
        </section>
      )}

      {variant === "overview" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <section className={cn(chrome.card, "p-4")}>
            <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Grading pipeline</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {pipeline.map((item) => (
                <div key={item.label}>
                  <p className={cn("text-[11px]", PORTAL_TEXT_MUTED)}>{item.label}</p>
                  <p className={cn("text-lg font-semibold tabular-nums", PORTAL_TEXT)}>{item.value}</p>
                </div>
              ))}
            </div>
            <p className={cn("mt-3 text-[11px]", PORTAL_TEXT_MUTED)}>
              {(info?.sources ?? []).map((source) => `${source.label} ${source.weight}%`).join(" · ") || "Instructor graded"}
            </p>
          </section>
          <section className={cn(chrome.card, "overflow-hidden")}>
            <div className="border-b border-[var(--border)] px-4 py-3">
              <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Recent activity</p>
            </div>
            {activity.length === 0 ? (
              <p className={cn("px-4 py-6 text-sm", PORTAL_TEXT_MUTED)}>No report edits or grading events yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {activity.map((item, index) => (
                  <li key={`${item.projectId}-${item.at}-${index}`} className="px-4 py-2.5">
                    <p className={cn("text-sm", PORTAL_TEXT)}>
                      <span className="font-medium">{item.actor}</span> {item.action}
                    </p>
                    <p className={cn("text-[11px]", PORTAL_TEXT_MUTED)}>{item.group} · {ago(item.at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </div>
  )
}
