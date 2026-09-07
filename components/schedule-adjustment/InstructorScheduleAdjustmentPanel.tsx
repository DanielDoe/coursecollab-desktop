"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CalendarClock, CheckCircle2, Clock3, Loader2, Plus, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/use-toast"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { INSTRUCTOR_CALENDAR_INVALIDATE_EVENT } from "@/lib/calendar/instructor-calendar-events"
import { ScheduleAdjustmentStepper } from "@/components/schedule-adjustment/ScheduleAdjustmentStepper"
import { AvailabilityHeatmap, AvailabilityPicker } from "@/components/schedule-adjustment/AvailabilityPicker"
import { ScheduleAdjustmentNoticeBanner } from "@/components/schedule-adjustment/ScheduleAdjustmentNoticeBanner"
import { DAY_CODE_LABELS, formatTime12h } from "@/lib/schedule-adjustment/time-slots"

const TIME_OPTIONS = Array.from({ length: 29 }, (_, i) => {
  const minutes = 7 * 60 + i * 30
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0")
  const mm = String(minutes % 60).padStart(2, "0")
  return { value: `${hh}:${mm}`, label: formatTime12h(`${hh}:${mm}:00`) }
})

const POLL_DAY_CODES = ["MO", "TU", "WE", "TH"] as const
const DURATION_OPTIONS = [50, 60, 75, 80, 90, 110, 120, 150, 180]

function defaultDeadlineDate() {
  const d = new Date()
  d.setDate(d.getDate() + 3)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
import { formatPollColumnLabel } from "@/lib/schedule-adjustment/poll-scope"
import { cn } from "@/lib/utils"
import { portalListStripe } from "@/lib/portal-module-themes"
import { ScheduleStatusPill, scheduleChoiceCardClass, scheduleDayPillClass, scheduleFormHelp, scheduleFormLabel, scheduleFormSelect, scheduleFormSelectCompact } from "@/components/schedule-adjustment/schedule-adjustment-ui"
import { ProposedArrangementCard } from "@/components/schedule-adjustment/ProposedArrangementCard"
import { ConsentRosterPanel } from "@/components/schedule-adjustment/ConsentRosterPanel"
import { isDirectProposal } from "@/lib/schedule-adjustment/types"

type RequestSummary = {
  id: number
  status: string
  meeting_type: string
  reason: string
  section_code: string | null
  created_at: string
  archived_at?: string | null
}

function timeInputValue(value: unknown) {
  return String(value ?? "").slice(0, 5)
}

function deadlineFromIso(iso: unknown) {
  const d = new Date(String(iso))
  if (Number.isNaN(d.getTime())) {
    return { deadlineDate: defaultDeadlineDate(), deadlineTime: "17:00" }
  }
  return {
    deadlineDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    deadlineTime: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  }
}

function draftPayloadFromForm(form: typeof initialForm) {
  return {
    pollKind: form.pollKind,
    meetingType: form.meetingType,
    reason: form.reason,
    availabilityEndsAt: `${form.deadlineDate}T${form.deadlineTime}:00`,
    candidateStartTime: `${form.candidateStartTime}:00`,
    candidateEndTime: `${form.candidateEndTime}:00`,
    meetingDurationMinutes: form.meetingDurationMinutes,
    slotIncrementMinutes: form.slotIncrementMinutes,
    instructorNotes: form.instructorNotes,
    candidateDays: form.pollKind === "recurring" ? form.candidateDays : [],
    candidateDates: form.pollKind === "one_off" ? form.makeupDates : [],
    missedClassDate: form.pollKind === "one_off" ? form.missedClassDate : null,
  }
}

const initialForm = {
  pollKind: "recurring" as "recurring" | "one_off",
  meetingType: "lecture",
  reason: "",
  deadlineDate: defaultDeadlineDate(),
  deadlineTime: "17:00",
  candidateStartTime: "08:00",
  candidateEndTime: "17:00",
  meetingDurationMinutes: 110,
  slotIncrementMinutes: 30,
  instructorNotes: "",
  candidateDays: ["MO", "TU", "WE", "TH"] as string[],
  missedClassDate: "",
  makeupDates: [] as string[],
  pendingMakeupDate: "",
}

function requestTitle(request: { section_code?: string | null; meeting_type?: string; reason?: string }) {
  const meeting = request.meeting_type ? String(request.meeting_type) : "meeting"
  const section = request.section_code?.trim() || "Course"
  return `${section} · ${meeting}`
}

export function InstructorScheduleAdjustmentPanel() {
  const { toast } = useToast()
  const { courseScopeVersion } = useInstructorDashboardV2()
  const chrome = facultyEmbedChrome("course-settings")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedId = searchParams.get("id") ? Number(searchParams.get("id")) : null
  const isCreate = searchParams.get("new") === "1"

  const goList = useCallback(() => router.replace(pathname), [router, pathname])
  const goCreate = useCallback(() => router.replace(`${pathname}?new=1`), [router, pathname])
  const goDetail = useCallback((id: number) => router.replace(`${pathname}?id=${id}`), [router, pathname])

  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<RequestSummary[]>([])
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null)
  const [candidates, setCandidates] = useState<Array<Record<string, unknown>>>([])
  const [liveAggregate, setLiveAggregate] = useState<Record<string, unknown> | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState(initialForm)
  const [showArchived, setShowArchived] = useState(false)

  const [confirmText, setConfirmText] = useState("")
  const [cancelReason, setCancelReason] = useState("")

  const [deptForm, setDeptForm] = useState({
    approvalStatus: "approved",
    approvedBy: "",
    building: "",
    room: "",
    effectiveDate: "",
    confirmationChecked: false,
    notes: "",
  })
  const [directForm, setDirectForm] = useState({
    instructorLedDay: "TH",
    instructorLedStartTime: "13:00",
    instructorLedEndTime: "14:30",
    structuredSessionDay: "TU",
    structuredSessionStartTime: "17:00",
    structuredSessionEndTime: "18:50",
    effectiveDate: defaultDeadlineDate(),
    departmentNote: "",
    confirmed: false,
  })

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const qs = showArchived ? "?includeArchived=1" : ""
      const res = await instructorApiFetch(`/api/instructor/schedule-adjustments${qs}`, {
        headers: buildInstructorApiHeaders(),
      })
      const data = await res.json()
      setRequests(data.requests ?? [])
    } finally {
      setLoading(false)
    }
  }, [showArchived])

  const loadDetail = useCallback(async (id: number): Promise<boolean> => {
    try {
      const [mainRes, candRes, aggregateRes] = await Promise.all([
        instructorApiFetch(`/api/instructor/schedule-adjustments/${id}`, { headers: buildInstructorApiHeaders() }),
        instructorApiFetch(`/api/instructor/schedule-adjustments/${id}/actions?view=candidates`, {
          headers: buildInstructorApiHeaders(),
        }),
        instructorApiFetch(`/api/instructor/schedule-adjustments/${id}/actions?view=aggregate`, {
          headers: buildInstructorApiHeaders(),
        }),
      ])
      const main = await mainRes.json()
      if (!mainRes.ok || !main?.request) {
        setDetail(null)
        setCandidates([])
        setLiveAggregate(null)
        return false
      }
      const cand = await candRes.json()
      const aggregateData = await aggregateRes.json()
      setDetail(main)
      setCandidates(cand.candidates ?? [])
      setLiveAggregate(aggregateData.aggregate ?? null)
      return true
    } catch {
      setDetail(null)
      setCandidates([])
      setLiveAggregate(null)
      return false
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList, courseScopeVersion])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      setCandidates([])
      setLiveAggregate(null)
      return
    }
    let cancelled = false
    void (async () => {
      setDetail(null)
      setCandidates([])
      setLiveAggregate(null)
      const ok = await loadDetail(selectedId)
      if (!cancelled && !ok) goList()
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId, loadDetail, courseScopeVersion, goList])

  useEffect(() => {
    if (!isCreate) return
    setForm(initialForm)
  }, [courseScopeVersion, isCreate])

  const postAction = async (body: Record<string, unknown>) => {
    if (!selectedId) return
    setSaving(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/schedule-adjustments/${selectedId}/actions`, {
        method: "POST",
        headers: { ...buildInstructorApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Action failed")
      toast({ title: "Saved" })
      await loadDetail(selectedId)
      await loadList()
      if (body.action === "finalize") {
        window.dispatchEvent(new Event(INSTRUCTOR_CALENDAR_INVALIDATE_EVENT))
      }
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Action failed",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const req = detail?.request as Record<string, unknown> | undefined
    if (!req || String(req.status) !== "DRAFT") return
    const deadline = deadlineFromIso(req.availability_ends_at)
    setForm({
      pollKind: req.poll_kind === "one_off" ? "one_off" : "recurring",
      meetingType: String(req.meeting_type ?? "lecture"),
      reason: String(req.reason ?? ""),
      ...deadline,
      candidateStartTime: timeInputValue(req.candidate_start_time),
      candidateEndTime: timeInputValue(req.candidate_end_time),
      meetingDurationMinutes: Number(req.meeting_duration_minutes ?? 110),
      slotIncrementMinutes: Number(req.slot_increment_minutes ?? 30),
      instructorNotes: String(req.instructor_notes ?? ""),
      candidateDays: Array.isArray(req.candidate_days)
        ? (req.candidate_days as string[])
        : ["MO", "TU", "WE", "TH", "FR"],
      missedClassDate: String(req.missed_class_date ?? "").slice(0, 10),
      makeupDates: Array.isArray(req.candidate_dates) ? (req.candidate_dates as string[]) : [],
      pendingMakeupDate: "",
    })
  }, [detail])

  const createRequest = async () => {
    setCreating(true)
    try {
      const res = await instructorApiFetch("/api/instructor/schedule-adjustments", {
        method: "POST",
        headers: { ...buildInstructorApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(draftPayloadFromForm(form)),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Create failed")
      toast({ title: "Draft saved" })
      await loadList()
      if (data.request?.id) {
        goDetail(data.request.id as number)
        await loadDetail(data.request.id as number)
      }
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Create failed",
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  const saveDraftChanges = async () => {
    if (!selectedId) return
    setSaving(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/schedule-adjustments/${selectedId}/actions`, {
        method: "POST",
        headers: { ...buildInstructorApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", ...draftPayloadFromForm(form) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Save failed")
      toast({ title: "Draft updated" })
      await loadDetail(selectedId)
      await loadList()
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Save failed",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const deleteDraft = async () => {
    if (!selectedId) return
    if (!window.confirm("Delete this draft permanently? This cannot be undone.")) return
    setSaving(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/schedule-adjustments/${selectedId}/actions`, {
        method: "POST",
        headers: { ...buildInstructorApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Delete failed")
      toast({ title: "Draft deleted" })
      goList()
      await loadList()
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Delete failed",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const request = detail?.request as Record<string, unknown> | undefined
  const consent = detail?.consent as { total: number; agreed: number; pending: number; declined: number } | undefined
  const enrollmentDelta = detail?.enrollmentDelta as { changed: boolean; added: unknown[]; dropped: unknown[] } | undefined

  if ((loading && !detail) || (selectedId && !detail && !isCreate)) {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center gap-2 text-sm text-[var(--muted-foreground)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading schedule adjustments…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ScheduleAdjustmentNoticeBanner audience="faculty" />

      {isCreate ? (
            <div className={cn("space-y-4 rounded-xl border border-[var(--cc-ui-border,var(--border))] p-4", chrome.card)}>
              <h3 className="font-semibold text-[var(--cc-text)]">Create schedule adjustment</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className={scheduleChoiceCardClass(form.pollKind === "recurring")}
                  onClick={() => setForm((f) => ({ ...f, pollKind: "recurring" }))}
                >
                  <p className="font-semibold text-[var(--cc-text)]">Weekly meeting change</p>
                  <p className={cn("mt-1 text-xs", scheduleFormHelp)}>
                    Poll weekdays such as Mondays 8:00 AM–5:00 PM. Changes the regular class time.
                  </p>
                </button>
                <button
                  type="button"
                  className={scheduleChoiceCardClass(form.pollKind === "one_off")}
                  onClick={() => setForm((f) => ({ ...f, pollKind: "one_off" }))}
                >
                  <p className="font-semibold text-[var(--cc-text)]">Makeup / missed class</p>
                  <p className={cn("mt-1 text-xs", scheduleFormHelp)}>
                    Poll specific dates to reschedule one missed meeting. Weekly time stays the same.
                  </p>
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className={scheduleFormLabel}>Meeting type</Label>
                  <select
                    className={scheduleFormSelect}
                    value={form.meetingType}
                    onChange={(e) => setForm((f) => ({ ...f, meetingType: e.target.value }))}
                  >
                    <option value="lecture">Lecture</option>
                    <option value="laboratory">Laboratory</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div>
                  <Label className={scheduleFormLabel}>Poll deadline</Label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={form.deadlineDate}
                      onChange={(e) => setForm((f) => ({ ...f, deadlineDate: e.target.value }))}
                    />
                    <select
                      className={scheduleFormSelectCompact}
                      value={form.deadlineTime}
                      onChange={(e) => setForm((f) => ({ ...f, deadlineTime: e.target.value }))}
                    >
                      {TIME_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label className={scheduleFormLabel}>Earliest start</Label>
                  <select
                    className={scheduleFormSelect}
                    value={form.candidateStartTime}
                    onChange={(e) => setForm((f) => ({ ...f, candidateStartTime: e.target.value }))}
                  >
                    {TIME_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className={scheduleFormLabel}>Latest end</Label>
                  <select
                    className={scheduleFormSelect}
                    value={form.candidateEndTime}
                    onChange={(e) => setForm((f) => ({ ...f, candidateEndTime: e.target.value }))}
                  >
                    {TIME_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className={scheduleFormLabel}>Class length</Label>
                  <select
                    className={scheduleFormSelect}
                    value={form.meetingDurationMinutes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, meetingDurationMinutes: Number(e.target.value) }))
                    }
                  >
                    {DURATION_OPTIONS.map((mins) => (
                      <option key={mins} value={mins}>
                        {mins} minutes
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className={scheduleFormLabel}>Time slots</Label>
                  <select
                    className={scheduleFormSelect}
                    value={form.slotIncrementMinutes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, slotIncrementMinutes: Number(e.target.value) }))
                    }
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </div>
                {form.pollKind === "recurring" ? (
                  <div className="sm:col-span-2">
                    <Label className={scheduleFormLabel}>Weekdays to poll</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {POLL_DAY_CODES.map((day) => {
                        const on = form.candidateDays.includes(day)
                        return (
                          <button
                            key={day}
                            type="button"
                            className={scheduleDayPillClass(on)}
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                candidateDays: on
                                  ? f.candidateDays.filter((d) => d !== day)
                                  : [...f.candidateDays, day],
                              }))
                            }
                          >
                            {DAY_CODE_LABELS[day]}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label className={scheduleFormLabel}>Missed class date</Label>
                      <Input
                        type="date"
                        value={form.missedClassDate}
                        onChange={(e) => setForm((f) => ({ ...f, missedClassDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className={scheduleFormLabel}>Makeup dates to poll</Label>
                      <div className="mt-1 flex gap-2">
                        <Input
                          type="date"
                          value={form.pendingMakeupDate}
                          onChange={(e) => setForm((f) => ({ ...f, pendingMakeupDate: e.target.value }))}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            if (!form.pendingMakeupDate || form.makeupDates.includes(form.pendingMakeupDate)) return
                            setForm((f) => ({
                              ...f,
                              makeupDates: [...f.makeupDates, f.pendingMakeupDate].sort(),
                              pendingMakeupDate: "",
                            }))
                          }}
                        >
                          Add
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {form.makeupDates.map((date) => (
                          <button
                            key={date}
                            type="button"
                            className={cn(
                              scheduleDayPillClass(true),
                              "hover:opacity-80",
                            )}
                            onClick={() =>
                              setForm((f) => ({ ...f, makeupDates: f.makeupDates.filter((d) => d !== date) }))
                            }
                          >
                            {formatPollColumnLabel(date)} ×
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div>
                <Label className={scheduleFormLabel}>Reschedule name</Label>
                <Textarea
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. Move lecture to a later afternoon window"
                />
              </div>
              <div>
                <Label className={scheduleFormLabel}>Instructor notes (optional)</Label>
                <Textarea
                  value={form.instructorNotes}
                  onChange={(e) => setForm((f) => ({ ...f, instructorNotes: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <Button className={cn(chrome.solid, "!text-white")} disabled={creating} onClick={() => void createRequest()}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save draft"}
                </Button>
                <Button variant="outline" onClick={goList}>
                  Cancel
                </Button>
              </div>
            </div>
      ) : selectedId ? (
        <div className="space-y-6">
          {request ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold capitalize text-[var(--cc-text)]">{requestTitle(request)}</h2>
                {request.reason ? (
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">{String(request.reason)}</p>
                ) : null}
              </div>
              <ScheduleStatusPill
                status={String(request.status)}
                adjustmentMode={String(request.adjustment_mode ?? "")}
              />
            </div>
          ) : null}

          {request ? (
            <>
              <ScheduleAdjustmentStepper
                status={request.status as never}
                adjustmentMode={String(request.adjustment_mode ?? "")}
              />

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {String(request.status) === "CANCELLED" ? (
                  <Button
                    className={cn(chrome.solid, "w-full !text-white sm:w-auto")}
                    disabled={saving}
                    onClick={() => void postAction({ action: "reactivate" })}
                  >
                    Reactivate request
                  </Button>
                ) : null}
                {String(request.status) === "DRAFT" ? (
                  <>
                    <Button
                      className={cn(chrome.solid, "w-full !text-white sm:w-auto")}
                      disabled={saving}
                      onClick={() => void postAction({ action: "start_availability" })}
                    >
                      Start availability poll
                    </Button>
                    <Button variant="outline" disabled={saving} onClick={() => void saveDraftChanges()}>
                      Save changes
                    </Button>
                    <Button variant="destructive" disabled={saving} onClick={() => void deleteDraft()}>
                      Delete draft
                    </Button>
                  </>
                ) : null}
                {String(request.status) === "COLLECTING_AVAILABILITY" && !isDirectProposal(request.adjustment_mode) ? (
                  <>
                    <Button
                      className={cn(chrome.solid, "w-full !text-white sm:w-auto")}
                      disabled={saving}
                      onClick={() => void postAction({ action: "close_availability" })}
                    >
                      Close poll and analyze
                    </Button>
                    <Button variant="outline" disabled={saving} onClick={() => void postAction({ action: "remind_availability" })}>
                      Remind students
                    </Button>
                  </>
                ) : null}
              </div>

              {String(request.status) === "DRAFT" ? (
                <div className={cn("space-y-4 rounded-xl border border-[var(--cc-ui-border,var(--border))] p-4", chrome.card)}>
                  <div>
                    <h3 className="font-semibold text-[var(--cc-text)]">Edit draft settings</h3>
                    <p className={cn("mt-1 text-sm", scheduleFormHelp)}>
                      Update the reschedule name or poll time window before students can respond.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label className={scheduleFormLabel}>Reschedule name</Label>
                      <Textarea
                        value={form.reason}
                        onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className={scheduleFormLabel}>Meeting type</Label>
                      <select
                        className={scheduleFormSelect}
                        value={form.meetingType}
                        onChange={(e) => setForm((f) => ({ ...f, meetingType: e.target.value }))}
                      >
                        <option value="lecture">Lecture</option>
                        <option value="laboratory">Laboratory</option>
                        <option value="both">Both</option>
                      </select>
                    </div>
                    <div>
                      <Label className={scheduleFormLabel}>Poll deadline</Label>
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        <Input
                          type="date"
                          value={form.deadlineDate}
                          onChange={(e) => setForm((f) => ({ ...f, deadlineDate: e.target.value }))}
                        />
                        <select
                          className={scheduleFormSelectCompact}
                          value={form.deadlineTime}
                          onChange={(e) => setForm((f) => ({ ...f, deadlineTime: e.target.value }))}
                        >
                          {TIME_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <Label className={scheduleFormLabel}>Earliest start</Label>
                      <select
                        className={scheduleFormSelect}
                        value={form.candidateStartTime}
                        onChange={(e) => setForm((f) => ({ ...f, candidateStartTime: e.target.value }))}
                      >
                        {TIME_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className={scheduleFormLabel}>Latest end</Label>
                      <select
                        className={scheduleFormSelect}
                        value={form.candidateEndTime}
                        onChange={(e) => setForm((f) => ({ ...f, candidateEndTime: e.target.value }))}
                      >
                        {TIME_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className={scheduleFormLabel}>Class length</Label>
                      <select
                        className={scheduleFormSelect}
                        value={form.meetingDurationMinutes}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, meetingDurationMinutes: Number(e.target.value) }))
                        }
                      >
                        {DURATION_OPTIONS.map((mins) => (
                          <option key={mins} value={mins}>
                            {mins} minutes
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className={scheduleFormLabel}>Time slots</Label>
                      <select
                        className={scheduleFormSelect}
                        value={form.slotIncrementMinutes}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, slotIncrementMinutes: Number(e.target.value) }))
                        }
                      >
                        <option value={15}>15 minutes</option>
                        <option value={30}>30 minutes</option>
                        <option value={60}>60 minutes</option>
                      </select>
                    </div>
                    {form.pollKind === "recurring" ? (
                      <div className="sm:col-span-2">
                        <Label className={scheduleFormLabel}>Weekdays to poll</Label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {POLL_DAY_CODES.map((day) => {
                            const on = form.candidateDays.includes(day)
                            return (
                              <button
                                key={day}
                                type="button"
                                className={scheduleDayPillClass(on)}
                                onClick={() =>
                                  setForm((f) => ({
                                    ...f,
                                    candidateDays: on
                                      ? f.candidateDays.filter((d) => d !== day)
                                      : [...f.candidateDays, day],
                                  }))
                                }
                              >
                                {DAY_CODE_LABELS[day]}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                    <div className="sm:col-span-2">
                      <Label className={scheduleFormLabel}>Instructor notes (optional)</Label>
                      <Textarea
                        value={form.instructorNotes}
                        onChange={(e) => setForm((f) => ({ ...f, instructorNotes: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {enrollmentDelta?.changed ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  Enrollment has changed since this schedule adjustment began. Refresh participants before consent.
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-3"
                    onClick={() => void postAction({ action: "refresh_enrollment" })}
                  >
                    Refresh participants
                  </Button>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: "Response rate",
                    value: `${detail?.responseRate as number}%`,
                    icon: Clock3,
                  },
                  {
                    label: "Consent",
                    value: `${consent?.agreed ?? 0}/${consent?.total ?? 0}`,
                    icon: CheckCircle2,
                  },
                  {
                    label: "Department",
                    value: String(request.department_approval_status),
                    icon: ShieldCheck,
                  },
                ].map((stat, index) => {
                  const stripe = portalListStripe(index, chrome.theme.family)
                  const Icon = stat.icon
                  return (
                    <div key={stat.label} className={cn("rounded-xl border p-4", chrome.card)}>
                      <div className={cn("mb-3 flex size-9 items-center justify-center rounded-xl", stripe.iconBg, stripe.iconText)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className="text-xs text-[var(--cc-text-muted)]">{stat.label}</p>
                      <p className="mt-1 text-2xl font-semibold capitalize text-[var(--cc-text)]">{stat.value}</p>
                    </div>
                  )
                })}
              </div>

              {((request.original_schedules as { lecture?: { scheduleText?: string } } | undefined)?.lecture
                ?.scheduleText ||
                request.instructor_notes) ? (
                <div className={cn("rounded-xl border p-4 text-sm", chrome.card, chrome.p.softBg, chrome.p.border)}>
                  <p className={cn("font-semibold", chrome.p.iconText)}>Current schedule</p>
                  <p className="mt-1 whitespace-pre-line">
                    {(request.original_schedules as { lecture?: { scheduleText?: string } })?.lecture?.scheduleText ||
                      "See course syllabus"}
                  </p>
                  {request.instructor_notes ? (
                    <p className="mt-2 text-[var(--muted-foreground)]">{String(request.instructor_notes)}</p>
                  ) : null}
                </div>
              ) : null}

              {String(request.status) === "COLLECTING_AVAILABILITY" && !isDirectProposal(request.adjustment_mode) ? (
                <div className={cn("space-y-3 rounded-xl border p-4", chrome.card)}>
                  <h3 className="font-semibold">Convert to Direct Proposal</h3>
                  <p className="text-sm text-[var(--cc-text-muted)]">
                    This will close the current availability poll and replace it with an instructor selected proposed
                    schedule. Existing availability responses will be archived but will not determine the proposed
                    meeting time.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className={scheduleFormLabel}>Instructor led day</Label>
                      <select
                        className={scheduleFormSelect}
                        value={directForm.instructorLedDay}
                        onChange={(e) => setDirectForm((f) => ({ ...f, instructorLedDay: e.target.value }))}
                      >
                        {POLL_DAY_CODES.map((day) => (
                          <option key={day} value={day}>
                            {DAY_CODE_LABELS[day]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className={scheduleFormLabel}>Start</Label>
                        <select
                          className={scheduleFormSelect}
                          value={directForm.instructorLedStartTime}
                          onChange={(e) => setDirectForm((f) => ({ ...f, instructorLedStartTime: e.target.value }))}
                        >
                          {TIME_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className={scheduleFormLabel}>End</Label>
                        <select
                          className={scheduleFormSelect}
                          value={directForm.instructorLedEndTime}
                          onChange={(e) => setDirectForm((f) => ({ ...f, instructorLedEndTime: e.target.value }))}
                        >
                          {TIME_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <Label className={scheduleFormLabel}>Structured session day</Label>
                      <select
                        className={scheduleFormSelect}
                        value={directForm.structuredSessionDay}
                        onChange={(e) => setDirectForm((f) => ({ ...f, structuredSessionDay: e.target.value }))}
                      >
                        {POLL_DAY_CODES.map((day) => (
                          <option key={day} value={day}>
                            {DAY_CODE_LABELS[day]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className={scheduleFormLabel}>Start</Label>
                        <select
                          className={scheduleFormSelect}
                          value={directForm.structuredSessionStartTime}
                          onChange={(e) => setDirectForm((f) => ({ ...f, structuredSessionStartTime: e.target.value }))}
                        >
                          {TIME_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className={scheduleFormLabel}>End</Label>
                        <select
                          className={scheduleFormSelect}
                          value={directForm.structuredSessionEndTime}
                          onChange={(e) => setDirectForm((f) => ({ ...f, structuredSessionEndTime: e.target.value }))}
                        >
                          {TIME_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <Label className={scheduleFormLabel}>Effective date</Label>
                      <Input
                        type="date"
                        value={directForm.effectiveDate}
                        onChange={(e) => setDirectForm((f) => ({ ...f, effectiveDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className={scheduleFormLabel}>Department note (optional)</Label>
                      <Textarea
                        value={directForm.departmentNote}
                        onChange={(e) => setDirectForm((f) => ({ ...f, departmentNote: e.target.value }))}
                      />
                    </div>
                  </div>
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={directForm.confirmed}
                      onCheckedChange={(v) => setDirectForm((f) => ({ ...f, confirmed: v === true }))}
                    />
                    <span>
                      I confirm that I have reviewed the proposed instructional schedule and want to submit it to
                      enrolled students for acknowledgment and consent.
                    </span>
                  </label>
                  <Button
                    className={cn(chrome.solid, "w-full !text-white sm:w-auto")}
                    disabled={saving || !directForm.confirmed}
                    onClick={() =>
                      void postAction({
                        action: "convert_to_direct_proposal",
                        ...directForm,
                        reason: request.reason,
                        instructorNotes: request.instructor_notes,
                      })
                    }
                  >
                    Proceed Directly to Student Consent
                  </Button>
                </div>
              ) : null}

              {isDirectProposal(request.adjustment_mode) ? (
                <div className="space-y-3">
                  <ProposedArrangementCard request={request as never} />
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-sm">
                    <p className="font-semibold text-[var(--cc-text)]">Student-facing consent preview</p>
                    <p className="mt-2 text-[var(--cc-text)]">
                      You are being asked to review the revised instructional meeting arrangement for this course.
                      The revised schedule maintains scheduled instructional activity while organizing one weekly
                      meeting as an instructor led session and the other as a structured CourseCollab session.
                    </p>
                  </div>
                </div>
              ) : null}

              {String(request.status) === "COLLECTING_AVAILABILITY" && liveAggregate && !isDirectProposal(request.adjustment_mode) ? (
                <div className="space-y-3">
                  <h3 className="font-semibold">Live availability heatmap</h3>
                  <p className="text-sm text-[var(--cc-text-muted)]">
                    {Number(liveAggregate.responded ?? 0)} of {Number(liveAggregate.totalEnrolled ?? 0)} students
                    responded. Darker cells show times more students marked; popular blocks require a full{" "}
                    {Number(liveAggregate.meetingDurationMinutes ?? 60)}-minute window.
                  </p>
                  <AvailabilityPicker
                    candidateDays={(liveAggregate.candidateDays as string[]) ?? []}
                    timeSlots={(liveAggregate.timeSlots as string[]) ?? []}
                    mode="binary"
                    value={{}}
                    onChange={() => {}}
                    readOnly
                    slotHeatmap={(liveAggregate.slotHeatmap as Record<string, { available: number; preferred: number }>) ?? null}
                    totalEnrolled={Number(liveAggregate.totalEnrolled ?? 0)}
                    topWindows={(liveAggregate.topWindows as never[]) ?? null}
                    meetingDurationMinutes={Number(liveAggregate.meetingDurationMinutes ?? 60)}
                  />
                </div>
              ) : null}

              {["REVIEWING_RESULTS", "AWAITING_DEPARTMENT_APPROVAL"].includes(String(request.status)) &&
              !isDirectProposal(request.adjustment_mode) ? (
                <div className="space-y-3">
                  <h3 className="font-semibold">Availability analysis</h3>
                  <AvailabilityHeatmap
                    candidates={candidates as never}
                    totalEnrolled={Number(detail?.enrollmentTotal ?? 0)}
                    onSelect={(id) => void postAction({ action: "select_candidate", candidateId: id })}
                  />
                </div>
              ) : null}

              {(String(request.status) === "AWAITING_DEPARTMENT_APPROVAL" ||
                String(request.status) === "DEPARTMENT_APPROVED") &&
              !isDirectProposal(request.adjustment_mode) ? (
                <div className={cn("space-y-3 rounded-xl border p-4", chrome.card)}>
                  <h3 className="font-semibold">Department & classroom confirmation</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      placeholder="Approved by"
                      value={deptForm.approvedBy}
                      onChange={(e) => setDeptForm((f) => ({ ...f, approvedBy: e.target.value }))}
                    />
                    <Input
                      type="date"
                      value={deptForm.effectiveDate}
                      onChange={(e) => setDeptForm((f) => ({ ...f, effectiveDate: e.target.value }))}
                    />
                    <Input
                      placeholder="Building"
                      value={deptForm.building}
                      onChange={(e) => setDeptForm((f) => ({ ...f, building: e.target.value }))}
                    />
                    <Input
                      placeholder="Room"
                      value={deptForm.room}
                      onChange={(e) => setDeptForm((f) => ({ ...f, room: e.target.value }))}
                    />
                  </div>
                  <Textarea
                    placeholder="Instructor notes"
                    value={deptForm.notes}
                    onChange={(e) => setDeptForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={deptForm.confirmationChecked}
                      onCheckedChange={(v) => setDeptForm((f) => ({ ...f, confirmationChecked: v === true }))}
                    />
                    <span>
                      I confirm that the department has approved this proposed meeting time and that the required
                      classroom or meeting location is available.
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className={cn(chrome.solid, "w-full !text-white sm:w-auto")}
                      disabled={saving}
                      onClick={() =>
                        void postAction({
                          action: "record_department",
                          ...deptForm,
                          approvalStatus: "approved",
                        })
                      }
                    >
                      Save department approval
                    </Button>
                    {String(request.status) === "DEPARTMENT_APPROVED" ? (
                      <Button
                        className={cn(chrome.solid, "w-full !text-white sm:w-auto")}
                        disabled={saving}
                        onClick={() => void postAction({ action: "start_consent" })}
                      >
                        Open student consent
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {String(request.status) === "COLLECTING_CONSENT" ||
              String(request.status) === "CONSENT_COMPLETE" ||
              String(request.status) === "READY_TO_FINALIZE" ? (
                <div className="space-y-3">
                  <ConsentRosterPanel
                    requestId={Number(request.id)}
                    counts={consent ?? { total: 0, agreed: 0, declined: 0, pending: 0 }}
                    sectionCode={String(request.section_code ?? "")}
                    onRemind={() => void postAction({ action: "remind_consent" })}
                  />
                  {String(request.status) === "READY_TO_FINALIZE" || isDirectProposal(request.adjustment_mode) ? (
                    <div className="space-y-2 rounded-xl border border-[var(--border)] p-4">
                      <p className="font-semibold">Final Review</p>
                      <p className="text-sm text-[var(--cc-text-muted)]">
                        {String(request.section_code ?? "")} · Effective {String(request.effective_date ?? "")}
                      </p>
                      <Label>Type CONFIRM to finalize</Label>
                      <Input
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="CONFIRM"
                      />
                      <Button
                        className={cn(chrome.solid, "w-full !text-white sm:w-auto")}
                        disabled={confirmText !== "CONFIRM" || saving}
                        onClick={() => void postAction({ action: "finalize", confirmText })}
                      >
                        Finalize Revised Schedule
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {request.proposed_day ? (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/15">
                  <p className="font-semibold text-emerald-800 dark:text-emerald-300">Proposed time</p>
                  <p className="mt-1 text-[var(--cc-text)]">
                    {formatPollColumnLabel(String(request.proposed_day))}{" "}
                    {formatTime12h(String(request.proposed_start_time))} –{" "}
                    {formatTime12h(String(request.proposed_end_time))}
                  </p>
                </div>
              ) : null}

              {!["FINALIZED", "COMPLETED", "CANCELLED"].includes(String(request.status)) ? (
                <div className="space-y-2">
                  <Label>Cancellation reason</Label>
                  <Textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Why is this request being cancelled?"
                  />
                  <Button
                    variant="destructive"
                    disabled={!cancelReason.trim() || saving}
                    onClick={() => void postAction({ action: "cancel", reason: cancelReason.trim() })}
                  >
                    Cancel request
                  </Button>
                </div>
              ) : null}

              {request.archived_at ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={saving} onClick={() => void postAction({ action: "unarchive" })}>
                    Restore from archive
                  </Button>
                </div>
              ) : !["COLLECTING_AVAILABILITY", "COLLECTING_CONSENT"].includes(String(request.status)) ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={saving} onClick={() => void postAction({ action: "archive" })}>
                    Archive
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-[var(--cc-text)]">Schedule Adjustments</h2>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <Checkbox checked={showArchived} onCheckedChange={(v) => setShowArchived(v === true)} />
                Show archived
              </label>
              <Button className={cn(chrome.solid, "w-full !text-white sm:w-auto")} onClick={goCreate}>
                <Plus className="mr-2 h-4 w-4" />
                New request
              </Button>
            </div>
          </div>

          <div className={cn("overflow-hidden rounded-xl border divide-y divide-[var(--border)]", chrome.card)}>
            {requests.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]">
                  <CalendarClock className="h-5 w-5" />
                </div>
                <p className="text-sm text-[var(--muted-foreground)]">No schedule adjustments yet.</p>
                <Button className={cn(chrome.solid, "!text-white")} onClick={goCreate}>
                  New request
                </Button>
              </div>
            ) : (
              requests.map((r, index) => {
                const stripe = portalListStripe(index, chrome.theme.family)
                return (
                <button
                  key={r.id}
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left hover:bg-[var(--muted)]/40 sm:items-center sm:py-2.5"
                  onClick={() => goDetail(r.id)}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl", stripe.iconBg, stripe.iconText)}>
                      <CalendarClock className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium capitalize text-[var(--cc-text)]">{requestTitle(r)}</p>
                      <p className="truncate text-sm text-[var(--cc-text-muted)]">{r.reason || "No name provided"}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {r.archived_at ? (
                      <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                        Archived
                      </span>
                    ) : null}
                    <ScheduleStatusPill status={r.status} />
                  </div>
                </button>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}

export function ScheduleAdjustmentDashboardCard() {
  const { courseScopeVersion } = useInstructorDashboardV2()
  const [item, setItem] = useState<RequestSummary | null>(null)

  useEffect(() => {
    void instructorApiFetch("/api/instructor/schedule-adjustments", { headers: buildInstructorApiHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const active = (data?.requests ?? []).find(
          (r: RequestSummary) =>
            !r.archived_at &&
            !["FINALIZED", "COMPLETED", "CANCELLED", "REJECTED"].includes(r.status),
        )
        setItem(active ?? null)
      })
      .catch(() => setItem(null))
  }, [courseScopeVersion])

  if (!item) return null

  return (
    <Link
      href="/faculty/dashboard/administration/schedule-adjustment"
      className="block rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 hover:bg-[var(--muted)]/30"
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <CalendarClock className="h-4 w-4" /> Schedule Adjustment
      </div>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">{item.section_code ?? "Course"}</p>
      <p className="mt-1 text-xs uppercase tracking-wide">{item.status.replace(/_/g, " ")}</p>
    </Link>
  )
}
