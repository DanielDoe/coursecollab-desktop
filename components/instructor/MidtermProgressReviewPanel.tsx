"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Award,
  Bell,
  CalendarDays,
  CheckCircle2,
  Eye,
  GraduationCap,
  Loader2,
  Mail,
  Megaphone,
  Search,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { cn } from "@/lib/utils"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { AN_META, AN_PANEL, PORTAL_TEXT_MUTED } from "@/lib/analytics/analytics-instructor-ui"
import type { ProgressReviewSections } from "@/lib/midterm-progress-review/types"
import {
  REVIEW_PERIOD_OPTIONS,
  formatAsOfLabel,
  getReviewPeriodConfig,
  periodBadgeLabel,
  type ProgressReviewPeriod,
} from "@/lib/midterm-progress-review/review-period"

type ReviewRow = {
  id: number
  studentId: number
  fullName: string
  email: string
  section: string | null
  reviewPeriod: string
  asOfDate: string | null
  modelUsed: string | null
  emailSentAt: string | null
  createdAt: string
}

type BatchResult = {
  total: number
  generated: number
  dispatched: number
  emailsSent: number
  skipped: number
  errors: Array<{ studentId: number; error: string }>
  dryRun: boolean
  deliverSaved?: boolean
}

type StudentHit = {
  id: number
  fullName: string
  email: string
  section: string | null
}

type DeliveryPreview = {
  emailSubject: string
  emailHtml: string
  announcementTitle: string
  announcementContent: string
  notificationPreview: string
}

type PreviewContext = {
  mode: "draft" | "sent"
  studentName: string
  emailSentAt?: string | null
  createdAt?: string | null
}

const PERIOD_ICONS: Record<ProgressReviewPeriod, typeof GraduationCap> = {
  midterm: GraduationCap,
  final: Award,
  custom: CalendarDays,
}

function ReviewPreview({ sections }: { sections: ProgressReviewSections }) {
  return (
    <div className="space-y-4 text-sm max-h-[55vh] overflow-y-auto pr-1">
      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{sections.overallSummary}</p>
      <div>
        <p className="font-semibold text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
          <Sparkles className="size-4" /> Strengths
        </p>
        <ul className="space-y-1.5 pl-1">
          {sections.strengths.map((s, i) => (
            <li key={i} className="flex gap-2 text-slate-600 dark:text-slate-300">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-500 mt-0.5" />
              {s}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1.5">
          <Target className="size-4" /> Areas to improve
        </p>
        <ul className="space-y-1.5 pl-1">
          {sections.areasToImprove.map((s, i) => (
            <li key={i} className="text-slate-600 dark:text-slate-300">• {s}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/60 p-4 space-y-2 bg-slate-50/80 dark:bg-slate-900/40">
        <p><strong>Assessments:</strong> {sections.assessmentFeedback}</p>
        <p><strong>Practice:</strong> {sections.practiceFeedback}</p>
        <p><strong>Attendance:</strong> {sections.attendanceFeedback}</p>
        <p><strong>Classroom:</strong> {sections.classroomFeedback}</p>
      </div>
      {sections.actionPlan.length > 0 && (
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Action plan</p>
          <ul className="space-y-1.5 pl-1">
            {sections.actionPlan.map((s, i) => (
              <li key={i} className="text-slate-600 dark:text-slate-300">• {s}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="italic text-indigo-700 dark:text-indigo-300 border-l-4 border-indigo-400 pl-3">
        {sections.encouragement}
      </p>
    </div>
  )
}

function EmailPreview({ subject, html }: { subject: string; html: string }) {
  return (
    <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-900/40 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Subject</p>
        <p className="text-sm font-medium text-slate-900 dark:text-white">{subject}</p>
      </div>
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/60 overflow-hidden bg-white">
        <iframe
          title="Email preview"
          srcDoc={html}
          className="w-full min-h-[420px] border-0"
          sandbox=""
        />
      </div>
    </div>
  )
}

function AnnouncementPreview({ title, content }: { title: string; content: string }) {
  return (
    <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-900/40 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Title</p>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
      </div>
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white/80 dark:bg-slate-950/40 px-4 py-4">
        <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-sans leading-relaxed">
          {content}
        </pre>
      </div>
    </div>
  )
}

export function ProgressReviewPanel({
  fullPage = false,
  embedInHub = false,
}: {
  fullPage?: boolean
  embedInHub?: boolean
}) {
  const fp = embedInHub ? facultyEmbedChrome("progress-reviews").p : null
  const { toast } = useToast()
  const { courseScopeVersion } = useInstructorDashboardV2()
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [studentCount, setStudentCount] = useState(0)
  const [savedReviewCount, setSavedReviewCount] = useState(0)
  const [missingReviewCount, setMissingReviewCount] = useState(0)
  const [reviewPeriod, setReviewPeriod] = useState<ProgressReviewPeriod>("midterm")
  const [asOfDate, setAsOfDate] = useState("")
  const [dryRun, setDryRun] = useState(true)
  const [sendEmail, setSendEmail] = useState(true)
  const [createAnnouncement, setCreateAnnouncement] = useState(true)
  const [createNotification, setCreateNotification] = useState(true)
  const [lastResult, setLastResult] = useState<BatchResult | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deliverConfirmOpen, setDeliverConfirmOpen] = useState(false)
  const [deliveringSaved, setDeliveringSaved] = useState(false)
  const [studentSearch, setStudentSearch] = useState("")
  const [searchResults, setSearchResults] = useState<StudentHit[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewContext, setPreviewContext] = useState<PreviewContext | null>(null)
  const [previewSections, setPreviewSections] = useState<ProgressReviewSections | null>(null)
  const [previewDelivery, setPreviewDelivery] = useState<DeliveryPreview | null>(null)
  const [previewTab, setPreviewTab] = useState("review")

  const periodCfg = getReviewPeriodConfig(reviewPeriod)

  const headers = useMemo(
    () =>
      buildInstructorAuthorizedApiHeaders({
        "Content-Type": "application/json",
      }),
    [courseScopeVersion],
  )

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/instructor/progress-reviews?reviewPeriod=${encodeURIComponent(reviewPeriod)}`,
        { headers },
      )
      const data = await res.json()
      if (data.success) {
        setReviews(data.reviews ?? [])
        setStudentCount(data.studentCount ?? data.enrolledStudentCount ?? 0)
        setSavedReviewCount(Number(data.savedReviewCount ?? data.reviews?.length ?? 0))
        setMissingReviewCount(Number(data.missingReviewCount ?? 0))
      } else {
        toast({ title: data.error || "Failed to load", variant: "destructive" })
      }
    } catch {
      toast({ title: "Failed to load reviews", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [headers, toast, reviewPeriod])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  useEffect(() => {
    const q = studentSearch.trim()
    if (q.length < 2) {
      setSearchResults([])
      return
    }
    const t = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(
          `/api/instructor/reports/student?q=${encodeURIComponent(q)}`,
          { headers },
        )
        const data = await res.json()
        setSearchResults(data.students ?? [])
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [studentSearch, headers])

  const batchPayload = (studentIds?: number[], opts?: { onlyMissing?: boolean }) => ({
    dryRun,
    onlyMissing: opts?.onlyMissing === true,
    sendEmail,
    createAnnouncement,
    createNotification,
    reviewPeriod,
    asOfDate: reviewPeriod === "custom" ? asOfDate || undefined : undefined,
    ...(studentIds?.length ? { studentIds } : {}),
  })

  const runBatch = async (studentIds?: number[]) => {
    if (reviewPeriod === "custom" && !asOfDate) {
      toast({
        title: "Select an as-of date",
        description: "Custom progress reviews require a snapshot date.",
        variant: "destructive",
      })
      return
    }

    setRunning(true)
    setDeliveringSaved(false)
    setLastResult(null)
    setConfirmOpen(false)
    try {
      const res = await instructorApiFetch("/api/instructor/progress-reviews", {
        method: "POST",
        headers,
        body: JSON.stringify(batchPayload(studentIds)),
      })
      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error || "Request failed")
      }
      setLastResult(data.result)
      toast({
        title: dryRun ? "Reviews saved (dry run)" : "Progress reviews sent",
        description: dryRun
          ? `Saved ${data.result.dispatched} review(s) for ${data.result.total} student(s) — no emails sent · ${periodCfg.label}`
          : `${data.result.emailsSent} email(s), ${data.result.dispatched} review(s) · ${periodCfg.label}`,
      })
      await fetchReviews()
    } catch (e) {
      toast({
        title: "Failed to run progress reviews",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
    } finally {
      setRunning(false)
      setDeliveringSaved(false)
    }
  }

  const runDeliverSaved = async (studentIds?: number[]) => {
    setRunning(true)
    setDeliveringSaved(true)
    setLastResult(null)
    setDeliverConfirmOpen(false)
    try {
      const res = await instructorApiFetch("/api/instructor/progress-reviews", {
        method: "POST",
        headers,
        body: JSON.stringify({
          deliverSaved: true,
          dryRun: false,
          sendEmail,
          createAnnouncement,
          createNotification,
          reviewPeriod,
          asOfDate: reviewPeriod === "custom" ? asOfDate || undefined : undefined,
          ...(studentIds?.length ? { studentIds } : {}),
        }),
      })
      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error || "Request failed")
      }
      setLastResult(data.result)
      toast({
        title: "Delivery complete",
        description: `${data.result.emailsSent} email(s) sent · ${data.result.dispatched} delivered · ${data.result.skipped} skipped (already sent or none saved)`,
      })
      await fetchReviews()
    } catch (e) {
      toast({
        title: "Failed to deliver saved reviews",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
    } finally {
      setRunning(false)
      setDeliveringSaved(false)
    }
  }

  const runFillMissing = async () => {
    if (missingReviewCount <= 0) return
    setRunning(true)
    setLastResult(null)
    try {
      const res = await instructorApiFetch("/api/instructor/progress-reviews", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...batchPayload(undefined, { onlyMissing: true }), dryRun: true }),
      })
      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error || "Request failed")
      }
      setLastResult(data.result)
      toast({
        title: "Missing reviews saved",
        description: `Saved ${data.result.dispatched} of ${data.result.total} missing review(s) · ${periodCfg.label}`,
      })
      await fetchReviews()
    } catch (e) {
      toast({
        title: "Failed to save missing reviews",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
    } finally {
      setRunning(false)
    }
  }

  const handleSendClick = () => {
    if (reviewPeriod === "custom" && !asOfDate) {
      toast({
        title: "Select an as-of date",
        description: "Pick the date through which student activity should be included.",
        variant: "destructive",
      })
      return
    }
    if (dryRun) {
      void runBatch()
      return
    }
    setConfirmOpen(true)
  }

  const openPreviewDialog = () => {
    setPreviewSections(null)
    setPreviewDelivery(null)
    setPreviewTab("review")
    setPreviewOpen(true)
  }

  const previewStudentReview = async (student: StudentHit) => {
    if (reviewPeriod === "custom" && !asOfDate) {
      toast({
        title: "Select an as-of date first",
        variant: "destructive",
      })
      return
    }
    setPreviewContext({ mode: "draft", studentName: student.fullName })
    openPreviewDialog()
    setPreviewLoading(true)
    try {
      const res = await instructorApiFetch("/api/instructor/progress-reviews", {
        method: "POST",
        headers,
        body: JSON.stringify({
          previewOnly: true,
          dryRun: true,
          reviewPeriod,
          asOfDate: reviewPeriod === "custom" ? asOfDate : undefined,
          studentIds: [student.id],
        }),
      })
      const data = await res.json()
      if (data.success && data.review?.sections) {
        setPreviewSections(data.review.sections)
        setPreviewDelivery(data.delivery ?? null)
      } else {
        throw new Error(data.error || "Preview failed")
      }
    } catch (e) {
      toast({
        title: "Preview failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
      setPreviewOpen(false)
    } finally {
      setPreviewLoading(false)
    }
  }

  const viewSentReview = async (row: ReviewRow) => {
    setPreviewContext({
      mode: "sent",
      studentName: row.fullName,
      emailSentAt: row.emailSentAt,
      createdAt: row.createdAt,
    })
    openPreviewDialog()
    setPreviewLoading(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/progress-reviews?reviewId=${row.id}`, { headers })
      const data = await res.json()
      if (data.success && data.review?.sections) {
        setPreviewSections(data.review.sections)
        setPreviewDelivery(data.review.delivery ?? null)
      } else {
        throw new Error(data.error || "Could not load review")
      }
    } catch (e) {
      toast({
        title: "Could not load review",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
      setPreviewOpen(false)
    } finally {
      setPreviewLoading(false)
    }
  }

  const savedReviewCountDisplay = Math.max(savedReviewCount, reviews.length)
  const emailedCount = reviews.filter((r) => r.emailSentAt).length
  const pendingEmailCount = reviews.filter((r) => !r.emailSentAt).length
  const periodLabel = periodBadgeLabel(reviewPeriod, asOfDate || null)

  return (
    <div className={cn("space-y-6", !fullPage && "mt-2")}>
      {fullPage && !embedInHub && (
        <div className="relative overflow-hidden rounded-3xl border border-orange-200/40 dark:border-orange-500/20 bg-gradient-to-br from-orange-50 via-white to-amber-50/80 dark:from-orange-950/30 dark:via-slate-900 dark:to-amber-950/20 p-6 sm:p-8 shadow-sm">
          <div className="absolute -right-8 -top-8 size-40 rounded-full bg-orange-400/10 blur-3xl" />
          <div className="absolute -left-4 bottom-0 size-32 rounded-full bg-amber-400/10 blur-2xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300 mb-3">
                <TrendingUp className="size-3.5" />
                Analytics
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Progress Reviews
              </h1>
              <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                Generate tailored feedback from assessments, practice hub, lecture practice, classroom
                points, and attendance — then deliver by email, private announcement, and notification.
              </p>
            </div>
            <Badge className="w-fit shrink-0 bg-orange-600 hover:bg-orange-600 text-white px-3 py-1">
              {periodLabel}
            </Badge>
          </div>
        </div>
      )}

      {embedInHub ? (
        <FacultyIntegratedToolbar
          moduleId="progress-reviews"
          search={studentSearch}
          onSearchChange={setStudentSearch}
          onSearchClear={() => {
            setStudentSearch("")
            setSearchResults([])
          }}
          searchPlaceholder="Preview one student — name, email, or ID…"
          meta={
            <p className={AN_META}>
              {periodLabel} · {savedReviewCountDisplay} saved · {emailedCount} emailed
            </p>
          }
          trailing={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void fetchReviews()}
              disabled={loading}
              className={facultyToolbarFilterButtonClass()}
            >
              <Loader2 className={cn("h-3.5 w-3.5 opacity-70", loading && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          }
        />
      ) : null}

      {embedInHub && (searchLoading || searchResults.length > 0) ? (
        <div className={cn(AN_PANEL, "p-4")}>
          {searchLoading ? (
            <p className={cn("text-xs flex items-center gap-1", PORTAL_TEXT_MUTED)}>
              <Loader2 className="size-3 animate-spin" /> Searching…
            </p>
          ) : null}
          {searchResults.length > 0 ? (
            <ul className="divide-y rounded-lg border border-[var(--sidebar-border)] max-h-44 overflow-y-auto">
              {searchResults.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                  <div>
                    <span className="font-medium">{s.fullName}</span>
                    {s.section ? <span className={cn("ml-2", PORTAL_TEXT_MUTED)}>{s.section}</span> : null}
                  </div>
                  <Button size="sm" variant="outline" className="gap-1 shrink-0 rounded-lg" onClick={() => previewStudentReview(s)}>
                    <Eye className="size-3.5" /> Preview
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className={cn(embedInHub ? AN_PANEL : "rounded-3xl border border-slate-200/70 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm shadow-sm overflow-hidden")}>
        <div className={cn("border-b px-5 sm:px-6 py-5", embedInHub ? "border-[var(--sidebar-border)]" : "border-slate-200/70 dark:border-slate-700/50")}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Review period
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {REVIEW_PERIOD_OPTIONS.map((opt) => {
              const Icon = PERIOD_ICONS[opt.id]
              const active = reviewPeriod === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setReviewPeriod(opt.id)}
                  className={cn(
                    "group relative rounded-2xl border p-4 text-left transition-all duration-200",
                    active
                      ? embedInHub
                        ? cn("ring-2 shadow-md", fp?.tabActive, "border-[var(--cc-accent)]/30 bg-[var(--sidebar-accent)]/40")
                        : "border-orange-400/80 bg-orange-50/90 dark:bg-orange-950/30 ring-2 ring-orange-400/30 shadow-md"
                      : embedInHub
                        ? "border-[var(--sidebar-border)] bg-[var(--sidebar-accent)]/20 hover:border-[var(--cc-accent)]/25 hover:shadow-sm"
                        : "border-slate-200/80 dark:border-slate-700/60 bg-white/80 dark:bg-slate-950/40 hover:border-orange-300/60 hover:shadow-sm",
                  )}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon
                      className={cn(
                        "size-4",
                        active
                          ? embedInHub
                            ? "text-[var(--cc-accent-dark)]"
                            : "text-orange-600 dark:text-orange-400"
                          : "text-slate-400",
                      )}
                    />
                    <span
                      className={cn(
                        "font-semibold text-sm",
                        active
                          ? embedInHub
                            ? "text-[var(--cc-text)]"
                            : "text-orange-900 dark:text-orange-100"
                          : "text-slate-800 dark:text-slate-200",
                      )}
                    >
                      {opt.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {opt.description}
                  </p>
                </button>
              )
            })}
          </div>

          {reviewPeriod === "custom" && (
            <div className="mt-4 max-w-xs">
              <Label htmlFor="as-of-date" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                As-of date
              </Label>
              <Input
                id="as-of-date"
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="mt-1.5 rounded-xl border-slate-200 dark:border-slate-700"
              />
              {asOfDate && (
                <p className="mt-1.5 text-xs text-slate-500">
                  Includes activity through {formatAsOfLabel(asOfDate)}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-5">
          {!embedInHub ? (
          <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-950/30 p-4">
            <Label htmlFor="student-preview-search" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Preview one student
            </Label>
            <div className="relative mt-2 max-w-lg">
              <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
              <Input
                id="student-preview-search"
                placeholder="Search by name, email, or ID…"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="pl-9 rounded-xl bg-white dark:bg-slate-900"
              />
            </div>
            {searchLoading && (
              <p className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> Searching…
              </p>
            )}
            {searchResults.length > 0 && (
              <ul className="mt-3 divide-y rounded-xl border bg-white dark:bg-slate-950 max-h-44 overflow-y-auto">
                {searchResults.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                    <div>
                      <span className="font-medium">{s.fullName}</span>
                      {s.section && <span className="text-slate-500 ml-2">{s.section}</span>}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 shrink-0 rounded-lg"
                      onClick={() => previewStudentReview(s)}
                    >
                      <Eye className="size-3.5" /> Preview
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          ) : null}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Delivery channels
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
              Used by <strong>Send reviews</strong> and <strong>Deliver saved</strong> — ignored during dry run.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  id: "dry-run",
                  label: "Dry run (save only)",
                  icon: Eye,
                  checked: dryRun,
                  onChange: setDryRun,
                  disabled: false,
                },
                { id: "send-email", label: "Email", icon: Mail, checked: sendEmail, onChange: setSendEmail, disabled: false },
                { id: "announcement", label: "Announcement", icon: Megaphone, checked: createAnnouncement, onChange: setCreateAnnouncement, disabled: false },
                { id: "notification", label: "Notification", icon: Bell, checked: createNotification, onChange: setCreateNotification, disabled: false },
              ].map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-4 py-3 transition-colors",
                    item.checked
                      ? "border-orange-300/60 bg-orange-50/50 dark:bg-orange-950/20"
                      : "border-slate-200/80 dark:border-slate-700/60 bg-white/70 dark:bg-slate-950/40",
                  )}
                >
                  <Label htmlFor={item.id} className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                    <item.icon className="size-4 text-slate-500" />
                    {item.label}
                  </Label>
                  <Switch
                    id={item.id}
                    checked={item.checked}
                    onCheckedChange={item.onChange}
                    disabled={item.disabled}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white/60 dark:bg-slate-950/30 p-4 text-xs text-slate-600 dark:text-slate-300 space-y-2">
            <p className="font-semibold text-slate-800 dark:text-slate-100">Three ways to run</p>
            <ul className="space-y-1.5 list-none pl-0">
              <li>
                <strong>Dry run ON → Generate &amp; save</strong> — AI writes reviews and saves to the DB. No
                email/announcement/notification. Students can already read them in the dashboard.
              </li>
              <li>
                <strong>Deliver saved</strong> — Uses the exact saved text from dry run. Only sends the channels
                you toggled. Fast; skips students already emailed.
              </li>
              <li>
                <strong>Dry run OFF → Send reviews</strong> — Regenerates everything from scratch (new AI text),
                saves, and sends. Use when grades changed since dry run or you want fresh wording.
              </li>
            </ul>
          </div>

          {dryRun ? (
            <div className="flex items-start gap-2 rounded-xl bg-sky-50 dark:bg-sky-950/25 border border-sky-200/80 dark:border-sky-800/50 p-4 text-sm text-sky-900 dark:text-sky-100">
              <Eye className="size-4 shrink-0 mt-0.5" />
              <span>
                <strong>Dry run</strong> generates and saves personalized reviews with updated grade
                snapshots (including &ldquo;In progress&rdquo; where applicable). Students can see them in
                their dashboard. No emails, announcements, or notifications are sent.
              </span>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-800/50 p-4 text-sm text-amber-900 dark:text-amber-100">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>
                Sending <strong>{periodCfg.label}</strong> reviews to {studentCount} students — each gets a
                personalized email, private dashboard post, and notification.
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <Button
              onClick={handleSendClick}
              disabled={running || studentCount === 0}
              size="lg"
              className="w-full sm:w-auto gap-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-500/20"
            >
              {running ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {running
                ? "Processing students…"
                : dryRun
                  ? `Generate & save (no send) · ${studentCount} students`
                  : `Send ${periodCfg.label} reviews · ${studentCount} students`}
            </Button>

            {missingReviewCount > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="lg"
                disabled={running || loading}
                onClick={() => void runFillMissing()}
                className="w-full sm:w-auto gap-2 rounded-xl"
              >
                {running ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
                Save {missingReviewCount} missing (dry run)
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={running || loading || savedReviewCountDisplay === 0}
              onClick={() => setDeliverConfirmOpen(true)}
              className="w-full sm:w-auto gap-2 rounded-xl border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 disabled:opacity-50"
            >
              <Mail className="size-4" />
              Deliver saved reviews
              {savedReviewCountDisplay > 0
                ? pendingEmailCount > 0
                  ? ` · ${savedReviewCountDisplay} saved, ${pendingEmailCount} pending`
                  : ` · ${savedReviewCountDisplay} saved`
                : ""}
            </Button>
          </div>

          {running && (
            <p className="text-xs text-slate-500 animate-pulse">
              {deliveringSaved
                ? "Sending saved reviews — much faster than regenerating."
                : "Generating AI reviews — may take several minutes for large classes."}
            </p>
          )}

          {lastResult && (
            <div className="rounded-2xl border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 mb-3">
                {lastResult.deliverSaved
                  ? "Deliver saved results"
                  : lastResult.dryRun
                    ? "Dry run results"
                    : "Send results"}{" "}
                · {periodCfg.label}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ["Total", lastResult.total],
                  ...(lastResult.deliverSaved
                    ? [
                        ["Delivered", lastResult.dispatched],
                        ["Emails", lastResult.emailsSent],
                        ["Skipped", lastResult.skipped],
                      ]
                    : [
                        ["Generated", lastResult.generated],
                        [lastResult.dryRun ? "Saved" : "Dispatched", lastResult.dispatched],
                        ...(lastResult.dryRun ? [] : [["Emails", lastResult.emailsSent]]),
                      ]),
                ].map(([label, val]) => (
                  <div key={String(label)} className="rounded-xl bg-white/80 dark:bg-slate-900/50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-7 animate-spin text-orange-500" />
            </div>
          ) : reviews.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Saved · {periodCfg.label}
                {studentCount > 0 && (
                  <span className="font-normal normal-case tracking-normal text-slate-400">
                    {" "}
                    ({savedReviewCountDisplay} of {studentCount} enrolled
                    {missingReviewCount > 0 ? ` · ${missingReviewCount} missing` : ""})
                  </span>
                )}
              </h3>
              <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
                {reviews.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 dark:border-slate-700/50 bg-white/80 dark:bg-slate-950/40 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.fullName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {r.section && `${r.section} · `}
                        {new Date(r.createdAt).toLocaleDateString()}
                        {r.asOfDate && ` · as of ${formatAsOfLabel(r.asOfDate)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 rounded-lg text-xs"
                        onClick={() => void viewSentReview(r)}
                      >
                        <Eye className="size-3.5" /> View
                      </Button>
                      <Badge variant="secondary" className="text-[10px]">
                        {periodBadgeLabel(r.reviewPeriod as ProgressReviewPeriod, r.asOfDate)}
                      </Badge>
                      {r.emailSentAt ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">Emailed</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">No email</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {!fullPage && (
        <p className="text-xs text-slate-500 text-center">
          Open Analytics → Progress Reviews for the full experience.
        </p>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Send {periodCfg.label} reviews to {studentCount} students?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Each student receives a personalized {periodCfg.label.toLowerCase()} review
              {reviewPeriod === "custom" && asOfDate
                ? ` (data through ${formatAsOfLabel(asOfDate)})`
                : ""}{" "}
              via email{sendEmail ? "" : " (disabled)"}, dashboard announcement
              {createAnnouncement ? "" : " (disabled)"}, and notification
              {createNotification ? "" : " (disabled)"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void runBatch()}
              className="rounded-xl bg-orange-600 hover:bg-orange-700"
            >
              Yes, send all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deliverConfirmOpen} onOpenChange={setDeliverConfirmOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Deliver saved {periodCfg.label} reviews?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have <strong>{savedReviewCountDisplay}</strong> saved {periodCfg.label.toLowerCase()} review(s).
              {pendingEmailCount > 0 ? (
                <>
                  {" "}
                  <strong>{pendingEmailCount}</strong> have not been emailed yet and will receive the channels
                  you enabled.
                </>
              ) : (
                <>
                  {" "}
                  All have been emailed already — delivery will only run for any missing announcements or
                  notifications, then skip the rest.
                </>
              )}{" "}
              AI text is <strong>not</strong> regenerated. Channels: email{sendEmail ? "" : " (off)"},
              announcement{createAnnouncement ? "" : " (off)"}, notification
              {createNotification ? "" : " (off)"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void runDeliverSaved()}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
            >
              Deliver saved reviews
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {periodCfg.label} — {previewContext?.studentName}
            </DialogTitle>
            <DialogDescription>
              {previewContext?.mode === "sent"
                ? `Published ${previewContext.createdAt ? new Date(previewContext.createdAt).toLocaleString() : ""}${
                    previewContext.emailSentAt ? " · Email sent" : ""
                  }`
                : "Generated from current submissions — not saved until you send."}
            </DialogDescription>
          </DialogHeader>
          {previewLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-8 animate-spin text-orange-500" />
            </div>
          ) : previewSections ? (
            <Tabs value={previewTab} onValueChange={setPreviewTab} className="gap-4">
              <TabsList className="grid w-full grid-cols-3 rounded-xl">
                <TabsTrigger value="review" className="gap-1.5 rounded-lg">
                  <Sparkles className="size-3.5" /> Review
                </TabsTrigger>
                <TabsTrigger value="email" className="gap-1.5 rounded-lg" disabled={!previewDelivery}>
                  <Mail className="size-3.5" /> Email
                </TabsTrigger>
                <TabsTrigger value="announcement" className="gap-1.5 rounded-lg" disabled={!previewDelivery}>
                  <Megaphone className="size-3.5" /> Announcement
                </TabsTrigger>
              </TabsList>
              <TabsContent value="review">
                <ReviewPreview sections={previewSections} />
              </TabsContent>
              <TabsContent value="email">
                {previewDelivery ? (
                  <EmailPreview subject={previewDelivery.emailSubject} html={previewDelivery.emailHtml} />
                ) : null}
              </TabsContent>
              <TabsContent value="announcement">
                {previewDelivery ? (
                  <AnnouncementPreview
                    title={previewDelivery.announcementTitle}
                    content={previewDelivery.announcementContent}
                  />
                ) : null}
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** @deprecated Use ProgressReviewPanel */
export const MidtermProgressReviewPanel = ProgressReviewPanel
