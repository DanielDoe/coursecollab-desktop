"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarClock, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/use-toast"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { AvailabilityPicker, type SlotHeatmapCell, type TopMeetingWindow } from "@/components/schedule-adjustment/AvailabilityPicker"
import { ScheduleAdjustmentNoticeBanner } from "@/components/schedule-adjustment/ScheduleAdjustmentNoticeBanner"
import { StudentScheduleChangeCard } from "@/components/schedule-adjustment/StudentScheduleChangeCard"
import { ProposedArrangementCard } from "@/components/schedule-adjustment/ProposedArrangementCard"
import { DIRECT_PROPOSAL_CONSENT_INTRO, isDirectProposal } from "@/lib/schedule-adjustment/types"
import { formatMeetingWindow } from "@/lib/schedule-adjustment/arrangement"
import { ScheduleAdjustmentStepper } from "@/components/schedule-adjustment/ScheduleAdjustmentStepper"
import { ConsentProgressCard } from "@/components/schedule-adjustment/ConsentProgressCard"
import type { AvailabilitySlotState } from "@/lib/schedule-adjustment/types"
import { PORTAL_CTA } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { portalListStripe } from "@/lib/portal-module-themes"
import { getStudentAuthHeaders, studentApiFetch, getStudentData } from "@/lib/auth"
import { scheduleRequestMatchesSectionScope } from "@/lib/schedule-adjustment/section-scope"
import { ScheduleStatusPill } from "@/components/schedule-adjustment/schedule-adjustment-ui"
import { formatPollColumnLabel } from "@/lib/schedule-adjustment/poll-scope"
import { formatTime12h } from "@/lib/schedule-adjustment/time-slots"

function requestTitle(request: { section_code?: string | null; meeting_type?: string; reason?: string }) {
  const meeting = request.meeting_type ? String(request.meeting_type) : "meeting"
  const section = request.section_code?.trim() || "Course"
  return `${section} · ${meeting}`
}

function getStudentId(): string | null {
  if (typeof window === "undefined") return null
  try {
    const db = sessionStorage.getItem("studentDatabaseId")
    if (db?.trim()) return db.trim()
    const raw = localStorage.getItem("studentSession")
    if (!raw) return null
    const s = JSON.parse(raw) as { databaseId?: string; studentId?: string; id?: string }
    return s.databaseId ?? s.studentId ?? s.id ?? null
  } catch {
    return null
  }
}

export function StudentScheduleAdjustmentPanel({
  requestId,
  hubLayout = false,
}: {
  requestId?: number
  hubLayout?: boolean
}) {
  const { toast } = useToast()
  const studentId = getStudentId()
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null)
  const [grid, setGrid] = useState<{
    candidateDays: string[]
    timeSlots: string[]
    mode: "binary" | "ternary"
    meetingDurationMinutes?: number
  } | null>(null)
  const [slotHeatmap, setSlotHeatmap] = useState<Record<string, SlotHeatmapCell> | null>(null)
  const [topWindows, setTopWindows] = useState<TopMeetingWindow[] | null>(null)
  const [enrolledTotal, setEnrolledTotal] = useState(0)
  const [blockedSlotKeys, setBlockedSlotKeys] = useState<string[]>([])
  const [signatureName, setSignatureName] = useState("")
  const [acknowledged, setAcknowledged] = useState(false)
  const [declineReason, setDeclineReason] = useState("")
  const [declineCategory, setDeclineCategory] = useState("other")
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [slots, setSlots] = useState<Record<string, AvailabilitySlotState>>({})

  const authHeaders = () => ({ ...getStudentAuthHeaders() })

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (!studentId) {
      setLoading(false)
      setLoadError("Sign in to see schedule adjustments.")
      return
    }
    if (!opts?.soft) {
      setLoading(true)
      setLoadError(null)
    }
    try {
      const headers = authHeaders()
      if (requestId) {
        const dRes = await studentApiFetch(
          `/api/student/schedule-adjustments/${requestId}?studentId=${encodeURIComponent(studentId)}`,
          {
            credentials: "include",
            headers,
          },
        )
        const d = await dRes.json()
        if (!dRes.ok) throw new Error(d.error ?? "Failed to load request")
        const studentSection = getStudentData()?.section
        const req = d.request as { section_code?: string | null; section_id?: number | null } | undefined
        if (
          req &&
          studentSection &&
          !scheduleRequestMatchesSectionScope(
            { section_code: req.section_code, section_id: req.section_id ?? null },
            { sectionCode: studentSection },
          )
        ) {
          throw new Error("This schedule adjustment belongs to another section.")
        }
        setDetail(d)
        try {
          const gRes = await fetch(
            `/api/student/schedule-adjustments/${requestId}/availability?studentId=${encodeURIComponent(studentId)}`,
            { credentials: "include", headers },
          )
          const g = gRes.ok ? await gRes.json() : {}
          setGrid({
            candidateDays: g.candidateDays ?? [],
            timeSlots: g.timeSlots ?? [],
            mode: g.availabilityMode ?? "binary",
            meetingDurationMinutes: g.meetingDurationMinutes ?? 60,
          })
          setSlotHeatmap(g.slotHeatmap ?? null)
          setTopWindows(g.topWindows ?? null)
          setBlockedSlotKeys(Array.isArray(g.blockedSlotKeys) ? g.blockedSlotKeys : [])
          setEnrolledTotal(Number(g.pollStats?.enrolled ?? d.pollStats?.enrolled ?? 0))
        } catch {
          setEnrolledTotal(Number(d.pollStats?.enrolled ?? 0))
        }
        const existing = (d.myAvailability as { availability_data?: { slots?: Record<string, AvailabilitySlotState> } })
          ?.availability_data?.slots
        if (existing) setSlots(existing)
      } else {
        const listRes = await studentApiFetch("/api/student/schedule-adjustments", {
          credentials: "include",
          headers,
        })
        const list = await listRes.json()
        if (!listRes.ok) throw new Error(list.error ?? "Failed to load schedule adjustments")
        setDetail({ list: list.requests ?? [] })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load"
      if (opts?.soft) {
        toast({ title: "Could not refresh", description: message, variant: "destructive" })
      } else {
        setLoadError(message)
        setDetail(requestId ? null : { list: [] })
      }
    } finally {
      if (!opts?.soft) setLoading(false)
    }
  }, [requestId, studentId, toast])

  useEffect(() => {
    void load()
  }, [load])

  const submitAvailability = async () => {
    if (!requestId || !studentId) return
    setSaving(true)
    try {
      const res = await fetch(
        `/api/student/schedule-adjustments/${requestId}/availability?studentId=${encodeURIComponent(studentId)}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ availability: { slots } }),
        },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Submit failed")
      toast({ title: "Availability submitted" })
      await load()
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Submit failed",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const submitConsent = async (agreed: boolean, category = declineCategory) => {
    if (!requestId || !studentId) return
    if (!agreed && !declineReason.trim()) {
      toast({
        title: "Missing explanation",
        description: "A brief explanation is required to record a concern.",
        variant: "destructive",
      })
      return
    }
    setSaving(true)
    try {
      const res = await studentApiFetch(
        `/api/student/schedule-adjustments/${requestId}/consent?studentId=${encodeURIComponent(studentId)}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            agreed,
            acknowledged,
            signatureName,
            declineReason,
            declineCategory: category,
          }),
        },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Consent failed")
      if (agreed) {
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                myConsent: {
                  status: "agreed",
                  signature_name: signatureName.trim(),
                },
              }
            : prev,
        )
      }
      toast({ title: agreed ? "Consent recorded" : "Response recorded" })
      await load({ soft: true })
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Consent failed",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    const loader = (
      <div className="flex min-h-[40vh] w-full items-center justify-center gap-2 text-sm text-[var(--muted-foreground)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    )
    return hubLayout ? loader : loader
  }

  if (!requestId) {
    const list =
      (detail?.list as Array<{
        id: number
        status: string
        reason: string
        section_code?: string | null
        meeting_type?: string
      }>) ?? []
    const listBody = (
          <div className="w-full min-w-0">
            {!hubLayout ? (
              <>
                <h1 className="text-lg font-semibold sm:text-xl">Schedule Adjustment</h1>
                <p className="mt-1 text-sm text-[var(--cc-text-muted)]">
                  Review availability polls and sign consent for proposed class time changes.
                </p>
              </>
            ) : null}
            <div className={hubLayout ? "mt-0" : "mt-3"}>
              <ScheduleAdjustmentNoticeBanner audience="student" />
            </div>
            <div className="mt-4 divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
              {loadError ? (
                <div className="p-4 text-sm text-[var(--muted-foreground)]">
                  <p>{loadError}</p>
                  {/auth|sign in|session/i.test(loadError) ? (
                    <a href="/student/login" className="mt-2 inline-block font-medium text-[var(--cc-accent)]">
                      Sign in again
                    </a>
                  ) : null}
                </div>
              ) : list.length === 0 ? (
                <p className="p-4 text-sm text-[var(--muted-foreground)]">No active schedule adjustments.</p>
              ) : (
                list.map((item, index) => {
                  const stripe = portalListStripe(index, "sky")
                  return (
                  <a
                    key={item.id}
                    href={`/student/dashboard-v2/schedule-adjustment/${item.id}`}
                    className="flex items-start justify-between gap-3 p-3 hover:bg-[var(--muted)]/40 sm:p-4"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl", stripe.iconBg, stripe.iconText)}>
                        <CalendarClock className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium capitalize text-[var(--cc-text)]">{requestTitle(item)}</p>
                        <p className="truncate text-sm text-[var(--cc-text-muted)]">
                          {item.reason || "No reason provided"}
                        </p>
                      </div>
                    </div>
                    <ScheduleStatusPill status={item.status} />
                  </a>
                  )
                })
              )}
            </div>
          </div>
    )
    return hubLayout ? listBody : (
      <PageEnter className={dashboardV2PageRootClass}>
        <EmbedModuleCard>
          <div className="w-full min-w-0 p-3 sm:p-4 md:p-5">{listBody}</div>
        </EmbedModuleCard>
      </PageEnter>
    )
  }

  const request = detail?.request as Record<string, unknown> | undefined
  const pollStats = detail?.pollStats as { responded: number; enrolled: number } | undefined
  const myConsent = detail?.myConsent as { status?: string } | undefined
  const consentStats = detail?.consentStats as
    | {
        agreed: number
        declined: number
        pending: number
        total: number
        thresholdPercent: number
        required: number
        remaining: number
        percentOfClass: number
        percentTowardThreshold: number
        thresholdMet: boolean
      }
    | undefined
  const status = String(request?.status ?? "")

  const detailBody = (
        <div className={cn("w-full min-w-0 space-y-6", !hubLayout && "p-3 sm:p-4 md:p-5")}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold capitalize text-[var(--cc-text)] sm:text-xl">
                {request ? requestTitle(request) : "Schedule Adjustment"}
              </h1>
              {request?.reason ? (
                <p className="mt-1 text-sm text-[var(--cc-text-muted)]">{String(request.reason)}</p>
              ) : null}
            </div>
            {status ? (
              <ScheduleStatusPill status={status} adjustmentMode={String(request?.adjustment_mode ?? "")} />
            ) : null}
          </div>

          {request ? (
            <ScheduleAdjustmentStepper
              status={request.status as never}
              adjustmentMode={String(request.adjustment_mode ?? "")}
            />
          ) : null}

          <ScheduleAdjustmentNoticeBanner audience="student" />

          {loadError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              <p>{loadError}</p>
              {/auth|sign in|session/i.test(loadError) ? (
                <a href="/auth/university" className="mt-2 inline-block font-medium text-[var(--cc-accent)]">
                  Sign in again
                </a>
              ) : null}
            </div>
          ) : null}

          {request && !isDirectProposal(request.adjustment_mode) ? (
            <StudentScheduleChangeCard
              request={request}
              consentStatus={myConsent?.status}
            />
          ) : null}

          {isDirectProposal(request?.adjustment_mode) ? (
            <ProposedArrangementCard request={request as never} />
          ) : null}

          {status === "COLLECTING_AVAILABILITY" && grid && !isDirectProposal(request?.adjustment_mode) ? (
            <div className="space-y-4">
              {String(request?.poll_kind) === "one_off" ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  Makeup poll for the missed class on {String(request?.missed_class_date ?? "")}. Mark when you
                  can meet on the dates below.
                </p>
              ) : (
                <p className="text-sm text-[var(--muted-foreground)]">
                  Mark your weekly availability on the selected days.
                </p>
              )}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/15 p-3 text-sm text-[var(--cc-text-muted)]">
                <p className="font-medium text-[var(--cc-text)]">How scheduling works</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs sm:text-sm">
                  <li>Numbers on each cell show how many classmates marked that time (anonymous totals only).</li>
                  <li>
                    Popular meeting times rank full {grid.meetingDurationMinutes ?? 60}-minute blocks where the most
                    students can attend together.
                  </li>
                  <li>
                    After the poll closes, the instructor picks the best window; cross-course conflicts are flagged
                    before final approval.
                  </li>
                </ul>
              </div>
              <p className="text-sm text-[var(--cc-text-muted)]">
                {pollStats?.responded ?? 0} of {pollStats?.enrolled ?? enrolledTotal} students responded
              </p>
              {topWindows?.[0] ? (
                <div
                  className={cn(
                    "rounded-xl border p-4",
                    "border-[color-mix(in_srgb,var(--cc-accent)_35%,var(--border))]",
                    "bg-[color-mix(in_srgb,var(--cc-accent)_8%,var(--card))]",
                  )}
                >
                  <p className="text-sm font-semibold text-[var(--cc-text)]">Likely proposed schedule</p>
                  <p className="mt-1 text-base font-medium text-[var(--cc-text)]">
                    {formatPollColumnLabel(topWindows[0].dayOfWeek)}{" "}
                    {formatTime12h(topWindows[0].startTime)} – {formatTime12h(topWindows[0].endTime)}
                  </p>
                  <p className="mt-1 text-sm text-[var(--cc-text-muted)]">
                    {topWindows[0].availableCount} of {enrolledTotal || pollStats?.enrolled || 0} students available (
                    {topWindows[0].agreementPercentage}%) ·{" "}
                    {topWindows[0].consensusCategory.replace(/_/g, " ")}
                  </p>
                  <p className="mt-2 text-xs text-[var(--cc-text-muted)]">
                    Based on current class responses. The instructor confirms the final time after the poll closes.
                  </p>
                </div>
              ) : null}
              <AvailabilityPicker
                candidateDays={grid.candidateDays}
                timeSlots={grid.timeSlots}
                mode={grid.mode}
                value={slots}
                onChange={setSlots}
                slotHeatmap={slotHeatmap}
                totalEnrolled={enrolledTotal || pollStats?.enrolled || 0}
                topWindows={topWindows}
                meetingDurationMinutes={grid.meetingDurationMinutes}
                blockedSlotKeys={blockedSlotKeys}
              />
              <div className="flex justify-end">
                <Button className={cn(PORTAL_CTA, "w-full !text-white sm:w-auto")} onClick={() => void submitAvailability()} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit availability"}
                </Button>
              </div>
            </div>
          ) : null}

          {(status === "COLLECTING_CONSENT" ||
            myConsent?.status === "agreed" ||
            myConsent?.status === "concern" ||
            myConsent?.status === "declined") ? (
            <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
              <h2 className="text-base font-semibold text-[var(--cc-text)]">
                Schedule Change Review and Student Consent
              </h2>
              <p className="text-sm text-[var(--cc-text)]">
                {String(detail?.consentIntro ?? DIRECT_PROPOSAL_CONSENT_INTRO)}
              </p>
              {Array.isArray(detail?.consentAffirmations) ? (
                <ul className="list-inside list-disc space-y-1 text-sm text-[var(--cc-text)]">
                  {(detail.consentAffirmations as string[]).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm">{String(detail?.consentStatement ?? "")}</p>
              )}
              <p className="text-xs text-[var(--muted-foreground)]">{String(detail?.conflictDisclaimer ?? "")}</p>
              <p className="text-xs text-[var(--cc-text-muted)]">
                Course {String(request?.section_code ?? "")} · Section {String(request?.section_code ?? "")} ·
                Instructor {String(detail?.instructorName ?? "")} · Student {String(detail?.studentName ?? "")} ·
                Effective {String(request?.effective_date ?? "").slice(0, 10)}
              </p>

              {consentStats ? <ConsentProgressCard stats={consentStats} requestStatus={status} /> : null}

              {myConsent?.status === "agreed" ? (
                <p className="text-sm font-medium text-[var(--cc-success)]">You have agreed to this schedule change.</p>
              ) : myConsent?.status === "concern" || myConsent?.status === "declined" ? (
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  Your concern has been recorded. This is not treated as consent.
                </p>
              ) : status === "COLLECTING_CONSENT" ? (
                <>
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox checked={acknowledged} onCheckedChange={(v) => setAcknowledged(v === true)} />
                    <span>I acknowledge and agree to the revised instructional arrangement described above.</span>
                  </label>
                  <div className="space-y-2">
                    <Label>Type your full name</Label>
                    <Input value={signatureName} onChange={(e) => setSignatureName(e.target.value)} />
                  </div>
                  <Button
                    className={cn(PORTAL_CTA, "w-full !text-white sm:w-auto")}
                    disabled={!acknowledged || !signatureName.trim() || saving}
                    onClick={() => void submitConsent(true)}
                  >
                    Agree and Sign
                  </Button>
                  <div className="space-y-3 border-t pt-4">
                    <Label>I Have a Concern</Label>
                    {isDirectProposal(request?.adjustment_mode) ? (
                      <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 p-3 text-sm text-[var(--cc-text)]">
                        <p className="font-medium">Please review this arrangement before submitting a concern.</p>
                        <p>
                          <span className="font-medium">Instructor Led Session: </span>
                          {formatMeetingWindow({
                            day: String(request?.instructor_led_day ?? ""),
                            startTime: String(request?.instructor_led_start_time ?? ""),
                            endTime: String(request?.instructor_led_end_time ?? ""),
                          })}
                          . This is the in-person or instructor-taught weekly meeting.
                        </p>
                        <p>
                          <span className="font-medium">Structured CourseCollab Session: </span>
                          {formatMeetingWindow({
                            day: String(request?.structured_session_day ?? ""),
                            startTime: String(request?.structured_session_start_time ?? ""),
                            endTime: String(request?.structured_session_end_time ?? ""),
                          })}
                          . This remains a required course session.
                        </p>
                        <p>
                          During the structured session you must open CourseCollab and use{" "}
                          <span className="font-medium">Attendance Check In</span> to record yourself present.
                          Check in within the first {Number(request?.attendance_late_threshold_minutes ?? 20) || 20}{" "}
                          minutes to be marked Present. After that window, check in is still open but you will be
                          marked Late. Students who do not check in are marked Absent unless the instructor later
                          excuses the absence.
                        </p>
                      </div>
                    ) : null}
                    <Textarea
                      placeholder="Describe your concern about the instructor led meeting, structured session time, or self check-in requirement."
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                    />
                    <Button variant="outline" disabled={!declineReason.trim() || saving} onClick={() => void submitConsent(false, "concern")}>
                      Submit concern
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
  )

  return hubLayout ? detailBody : (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>{detailBody}</EmbedModuleCard>
    </PageEnter>
  )
}
