"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Award,
  Briefcase,
  CalendarDays,
  ChevronRight,
  Clock,
  FilePenLine,
  FlaskConical,
  GraduationCap,
  Loader2,
  Mail,
  UserRound,
} from "lucide-react"
import { StudentModuleHubLayout } from "@/components/student/dashboard-v2/StudentModuleHubLayout"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { NewRecommendationRequestForm } from "@/components/student/recommendations/new-recommendation-request-form"
import { getStudentRecommendationJourney } from "@/lib/recommendation-student-journey"
import { RecommendationStudentJourneyBadge } from "@/components/student/recommendations/recommendation-student-journey-badge"
import { useRecommendationNav } from "@/components/student/recommendations/recommendation-nav-context"
import { cn } from "@/lib/utils"

const PURPOSE_LABELS: Record<string, string> = {
  scholarship: "Scholarship",
  internship: "Internship",
  graduate_school: "Graduate school",
  job_application: "Job application",
  research_opportunity: "Research opportunity",
  other: "Other",
}

function purposeLabel(purpose: string) {
  return PURPOSE_LABELS[purpose] ?? purpose.replace(/_/g, " ")
}

function purposeIcon(purpose: string) {
  const map: Record<string, typeof FilePenLine> = {
    scholarship: Award,
    internship: Briefcase,
    graduate_school: GraduationCap,
    job_application: Mail,
    research_opportunity: FlaskConical,
  }
  return map[purpose] ?? FilePenLine
}

function formatListDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return typeof iso === "string" ? iso : null
  }
  return d.toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" })
}

type RecRow = {
  id: number
  status: string
  purpose: string
  deadline: string | null
  course_code: string
  course_description?: string | null
  instructor_name: string
  created_at: string
  draft_count?: number
  rejection_reason?: string | null
  student_request_description?: string | null
  letter_intake_mode?: string | null
  has_questionnaire_profile?: boolean
}

export function RecommendationsDashboardV2() {
  const { base: BASE } = useRecommendationNav()
  const router = useRouter()
  const [studentKey, setStudentKey] = useState<string | null>(null)
  const [items, setItems] = useState<RecRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const loadList = useCallback(async (sid: string) => {
    const res = await studentApiFetch(`/api/student/recommendations?studentDatabaseId=${encodeURIComponent(sid)}`)
    const j = await res.json()
    if (!res.ok) throw new Error(j.error || "Failed to load")
    setItems(j.requests || [])
  }, [])

  useEffect(() => {
    const data = getStudentData()
    if (!data?.databaseId && !data?.id) {
      setErr("Please log in as a student.")
      setLoading(false)
      return
    }
    const sid = data.databaseId ?? data.id
    setStudentKey(sid)
    ;(async () => {
      try {
        await loadList(sid)
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to load")
      } finally {
        setLoading(false)
      }
    })()
  }, [loadList])

  const onCreated = useCallback(
    (requestId: number) => {
      router.push(`${BASE}/${requestId}`)
    },
    [router, BASE],
  )

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((r) => {
      const hay = [
        purposeLabel(r.purpose),
        r.course_code,
        r.course_description,
        r.instructor_name,
        r.student_request_description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return hay.includes(q)
    })
  }, [items, search])

  if (!studentKey && !err) {
    return null
  }

  if (!studentKey) {
    return <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
  }

  const desktopChrome = isDesktopAppShell()
  const metaLine =
    items.length > 0
      ? `${filteredItems.length} shown · ${items.length} total`
      : "Submit course, instructor, purpose, and deadline"

  const toolbar = (
    <>
      <div className="relative h-10 min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
        <Input
          placeholder="Search requests…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={cn(
            "h-10 w-full pl-10 text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] shadow-none focus-visible:ring-1 focus-visible:ring-[var(--cc-accent)]/30",
            desktopChrome
              ? "rounded-full border-0 bg-[var(--sidebar-accent)]/50 focus-visible:bg-[var(--sidebar-accent)]/70"
              : "rounded-xl border border-[var(--border)] bg-[var(--muted)]/40",
          )}
        />
      </div>
      <span className="hidden sm:inline text-xs text-[var(--cc-text-muted)] tabular-nums px-2 shrink-0">
        {filteredItems.length} of {items.length}
      </span>
    </>
  )

  return (
    <StudentModuleHubLayout
      moduleId="recommendations"
      title="Recommendation Letters"
      metaLine={metaLine}
      metaSuffix="questionnaire, drafts, and PDF when ready"
      hideSideMenu
      toolbar={toolbar}
      loading={loading && items.length === 0}
      menuView="recommendations"
      onMenuSelect={() => {}}
      menuItems={[]}
      footer={
        <div className="grid gap-3 sm:grid-cols-3 text-sm rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-4">
          <div className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--cc-accent-soft)] text-xs font-semibold text-[var(--cc-accent-dark)]">1</span>
            <div>
              <p className="font-medium text-[var(--cc-text)]">Submit</p>
              <p className="text-xs text-[var(--cc-text-muted)]">Course, instructor, purpose, and deadline.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--cc-accent-soft)] text-xs font-semibold text-[var(--cc-accent-dark)]">2</span>
            <div>
              <p className="font-medium text-[var(--cc-text)]">Review</p>
              <p className="text-xs text-[var(--cc-text-muted)]">Your instructor approves the request.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--cc-accent-soft)] text-xs font-semibold text-[var(--cc-accent-dark)]">3</span>
            <div>
              <p className="font-medium text-[var(--cc-text)]">Letter</p>
              <p className="text-xs text-[var(--cc-text-muted)]">Questionnaire, drafts, and PDF when ready.</p>
            </div>
          </div>
        </div>
      }
    >
      {err ? (
        <p
          className="text-sm text-red-600 dark:text-red-400 rounded-lg border border-red-200/80 dark:border-red-900/40 bg-red-50/90 dark:bg-red-950/25 px-3 py-2.5 mb-4"
          role="alert"
        >
          {err}
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
        <section className="rounded-xl bg-[var(--muted)]/30 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-[var(--cc-text)]">New request</h2>
          <p className="mt-0.5 mb-4 text-xs text-[var(--cc-text-muted)]">
            Your instructor approves before any letter or PDF is shared.
          </p>
          <NewRecommendationRequestForm studentKey={studentKey} listHref={BASE} onCreated={onCreated} />
        </section>

        <section className="rounded-xl bg-[var(--muted)]/30 min-h-[320px] flex flex-col overflow-hidden">
          <div className="px-4 pt-4 pb-2 sm:px-5">
            <h2 className="text-sm font-semibold text-[var(--cc-text)]">Your requests</h2>
            <p className="text-xs text-[var(--cc-text-muted)]">Newest first — open to continue questionnaire, drafts, or download</p>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2 sm:px-3 sm:pb-3">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-[var(--cc-text-muted)]">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading...
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center sm:px-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)] mb-3">
                  <FilePenLine className="h-5 w-5" aria-hidden />
                </div>
                <p className="text-sm font-medium text-[var(--cc-text)]">No requests yet</p>
                <p className="mt-1 max-w-xs text-xs text-[var(--cc-text-muted)]">
                  Submit a new request using the form. Completed letters appear here when ready.
                </p>
              </div>
            ) : filteredItems.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-[var(--cc-text-muted)]">No requests match your search.</p>
            ) : (
              <ul className="space-y-2">
                {filteredItems.map((r) => {
                  const PurposeIcon = purposeIcon(r.purpose)
                  const dueLabel = formatListDate(r.deadline)
                  const submittedLabel = formatListDate(r.created_at)
                  const drafts = Number(r.draft_count ?? 0)
                  const listJourney = getStudentRecommendationJourney({
                    status: r.status,
                    hasQuestionnaireProfile: Boolean(r.has_questionnaire_profile),
                    letterIntakeMode: typeof r.letter_intake_mode === "string" ? r.letter_intake_mode.trim() : null,
                    aiDraftCount: drafts,
                  })
                  const courseLine = [r.course_code?.trim(), r.course_description?.trim()].filter(Boolean).join(" · ")

                  return (
                    <li key={r.id}>
                      <Link
                        href={`${BASE}/${r.id}`}
                        className="group flex gap-3 rounded-xl px-3 py-3 sm:px-4 sm:py-3.5 transition-colors hover:bg-[var(--muted)]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]/40"
                        aria-label={`${purposeLabel(r.purpose)}, ${listJourney.headline}, request ${r.id}`}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]">
                          <PurposeIcon className="h-5 w-5" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="font-medium text-[var(--cc-text)] group-hover:text-[var(--cc-accent-dark)] transition-colors">
                              {purposeLabel(r.purpose)}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              {drafts > 0 ? (
                                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]">
                                  {drafts} draft{drafts === 1 ? "" : "s"}
                                </span>
                              ) : null}
                              <RecommendationStudentJourneyBadge compact className="max-w-[14rem]" journey={listJourney} />
                            </div>
                          </div>
                          {courseLine ? (
                            <p className="mt-0.5 text-xs text-[var(--cc-text-muted)] line-clamp-1">{courseLine}</p>
                          ) : null}
                          {String(r.student_request_description ?? "").trim() ? (
                            <p className="mt-1 text-xs text-[var(--cc-text-muted)] line-clamp-2">
                              {String(r.student_request_description).trim()}
                            </p>
                          ) : null}
                          {r.status === "rejected" && String(r.rejection_reason ?? "").trim() ? (
                            <p className="mt-1 text-xs text-red-700 dark:text-red-300 line-clamp-2">
                              {String(r.rejection_reason).trim()}
                            </p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--cc-text-muted)]">
                            <span className="inline-flex items-center gap-1 min-w-0">
                              <UserRound className="h-3 w-3 shrink-0" aria-hidden />
                              <span className="truncate">{r.instructor_name}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 shrink-0">
                              <CalendarDays className="h-3 w-3 shrink-0" aria-hidden />
                              {dueLabel ? `Due ${dueLabel}` : "No deadline"}
                            </span>
                            {submittedLabel ? (
                              <span className="inline-flex items-center gap-1 shrink-0">
                                <Clock className="h-3 w-3 shrink-0" aria-hidden />
                                Submitted {submittedLabel}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <ChevronRight
                          className="h-4 w-4 shrink-0 self-center text-[var(--cc-text-muted)] group-hover:text-[var(--cc-accent-dark)] transition-colors"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
        </div>
    </StudentModuleHubLayout>
  )
}
