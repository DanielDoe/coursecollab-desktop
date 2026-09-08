"use client"

import { getFacultyModuleTheme } from "@/lib/faculty-module-themes"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

import { useState, useEffect, type ReactNode } from "react"
import Link from "next/link"
import {
  Clock,
  Loader2,
  Calendar,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  MapPin,
  Link2,
  Settings2,
  Plus,
  Trash2,
  ArrowLeft,
  Filter,
  Search,
  ArrowUpDown,
  LayoutGrid,
  List,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { AM_PANEL, AM_PANEL_FILL, AM_PANEL_SCROLL } from "@/lib/assessments/assessment-management-surface-classes"

const DAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
]

export function InstructorOfficeHoursContent({ embedInDashboard }: { embedInDashboard?: boolean }) {
  const fp = getFacultyModuleTheme("office-hours").page
  const cardBase = PORTAL_CARD
  const { toast } = useToast()
  const { courseScopeVersion } = useInstructorDashboardV2()

  const apiHeaders = () => ({
    ...buildInstructorApiHeaders(),
    "Content-Type": "application/json",
  })
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({
    status: "scheduled",
    scheduledDate: "",
    meetingLink: "",
    meetingVenue: "",
    instructorNotes: "",
  })
  const [regularHours, setRegularHours] = useState<any[]>([])
  const [configOpen, setConfigOpen] = useState(false)
  const [configSlots, setConfigSlots] = useState<{ dayOfWeek: number; startTime: string; endTime: string }[]>([])
  const [savingConfig, setSavingConfig] = useState(false)

  // View organizer
  const [statusFilter, setStatusFilter] = usePersistedState("instructor-office-hours-status", "all")
  const [sortOrder, setSortOrder] = usePersistedState<"newest" | "oldest">("instructor-office-hours-sort", "newest")
  const [searchQuery, setSearchQuery] = usePersistedState("instructor-office-hours-search", "")
  const [viewMode, setViewMode] = usePersistedState<"grid" | "list">("instructor-office-hours-view", "grid")

  const loadRegularHours = async () => {
    try {
      const res = await instructorApiFetch("/api/instructor/office-hours/regular", {
        headers: buildInstructorApiHeaders(),
      })
      const data = await res.json()
      if (res.ok && data.regularHours) {
        setRegularHours(data.regularHours)
        setConfigSlots(
          data.regularHours.map((h: any) => ({
            dayOfWeek: h.dayOfWeek,
            startTime: h.startTime || "12:00",
            endTime: h.endTime || "13:00",
          }))
        )
      }
    } catch (e) {
      console.error(e)
      setRegularHours([])
    }
  }

  const loadRequests = async () => {
    try {
      const res = await instructorApiFetch("/api/instructor/office-hours", {
        headers: buildInstructorApiHeaders(),
      })
      const data = await res.json()
      if (res.ok && data.requests) setRequests(data.requests)
      else setRequests([])
    } catch (e) {
      console.error(e)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetch("/api/setup/office-hours", { method: "POST" }).catch(() => {})
    setLoading(true)
    loadRequests()
    loadRegularHours()
  }, [courseScopeVersion])

  const handleSaveRegularHours = async () => {
    setSavingConfig(true)
    try {
      const res = await instructorApiFetch("/api/instructor/office-hours/regular", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ slots: configSlots, semesterLabel: "current" }),
      })
      const data = await res.json()
      if (res.ok && data.regularHours) {
        setRegularHours(data.regularHours)
        setConfigOpen(false)
        toast({ title: "Saved", description: "Regular office hours updated." })
      } else {
        toast({ title: "Error", description: data.error || "Failed to save", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" })
    } finally {
      setSavingConfig(false)
    }
  }

  const addConfigSlot = () => {
    setConfigSlots((p) => [...p, { dayOfWeek: 1, startTime: "12:00", endTime: "13:00" }])
  }

  const removeConfigSlot = (i: number) => {
    setConfigSlots((p) => p.filter((_, j) => j !== i))
  }

  const updateConfigSlot = (i: number, field: string, value: number | string) => {
    setConfigSlots((p) => p.map((s, j) => (j === i ? { ...s, [field]: value } : s)))
  }

  const handleApprove = async (id: number) => {
    setSaving(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/office-hours/${id}`, {
        method: "PATCH",
        headers: apiHeaders(),
        body: JSON.stringify({ status: "approved" }),
      })
      if (res.ok) {
        toast({ title: "Approved", description: "Student has been notified." })
        loadRequests()
        setEditingId(null)
      } else {
        const d = await res.json()
        toast({ title: "Error", description: d.error || "Failed", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to approve", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleSchedule = async (id: number) => {
    setSaving(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/office-hours/${id}`, {
        method: "PATCH",
        headers: apiHeaders(),
        body: JSON.stringify({
          status: scheduleForm.status,
          scheduledDate: scheduleForm.scheduledDate || undefined,
          meetingLink: scheduleForm.meetingLink || undefined,
          meetingVenue: scheduleForm.meetingVenue || undefined,
          instructorNotes: scheduleForm.instructorNotes || undefined,
        }),
      })
      if (res.ok) {
        toast({ title: "Scheduled", description: "Student has been notified with details." })
        setScheduleForm({ status: "scheduled", scheduledDate: "", meetingLink: "", meetingVenue: "", instructorNotes: "" })
        setEditingId(null)
        loadRequests()
      } else {
        const d = await res.json()
        toast({ title: "Error", description: d.error || "Failed", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to schedule", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleReject = async (id: number) => {
    setSaving(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/office-hours/${id}`, {
        method: "PATCH",
        headers: apiHeaders(),
        body: JSON.stringify({ status: "rejected" }),
      })
      if (res.ok) {
        toast({ title: "Rejected", description: "Request has been declined." })
        loadRequests()
        setEditingId(null)
      }
    } catch {
      toast({ title: "Error", description: "Failed to reject", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const statusColor = (s: string) => {
    switch (s) {
      case "approved":
      case "scheduled":
      case "completed":
        return "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300/60 dark:border-emerald-500/40"
      case "rejected":
      case "cancelled":
        return "bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-300/60 dark:border-red-500/40"
      default:
        return "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300/60 dark:border-amber-500/40"
    }
  }

  const pendingCount = requests.filter((r: any) => r.status === "pending").length

  const filteredRequests = (() => {
    let filtered = requests.filter((r: any) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        (r.topic ?? "").toLowerCase().includes(q) ||
        (r.full_name ?? "").toLowerCase().includes(q) ||
        (r.student_code ?? "").toLowerCase().includes(q) ||
        (r.area_of_concern ?? "").toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q)
      )
    })
    const getDate = (r: any) => {
      if (r.created_at) return new Date(r.created_at).getTime()
      if (r.requested_at) return new Date(r.requested_at).getTime()
      if (r.scheduled_date) return new Date(r.scheduled_date).getTime()
      if (r.preferredDates?.[0]) return new Date(r.preferredDates[0]).getTime()
      return r.id ?? 0
    }
    return filtered.sort((a: any, b: any) => {
      const da = getDate(a)
      const db = getDate(b)
      return sortOrder === "newest" ? db - da : da - db
    })
  })()

  const scheduledThisWeek = requests.filter((r: any) => {
    if (r.status !== "scheduled" && r.status !== "approved") return false
    const d = r.scheduledDate || r.preferredDates?.[0]
    if (!d) return false
    const date = new Date(d)
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 7)
    return date >= startOfWeek && date < endOfWeek
  }).length

  const completedCount = requests.filter((r: any) => r.status === "completed").length

  const renderPanelEmpty = (title: string, description: string, action?: ReactNode) => (
    <div className={cn(AM_PANEL, "flex min-h-0 flex-1 flex-col overflow-hidden")}>
      <div className={cn(AM_PANEL_FILL, "gap-3 px-4 py-16 text-center")}>
        <div className={cn("mx-auto flex h-14 w-14 items-center justify-center rounded-xl", fp.iconBg)}>
          <Clock className={cn("h-7 w-7", fp.iconText)} />
        </div>
        <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>{title}</p>
        <p className={cn("max-w-md text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>{description}</p>
        {action}
      </div>
    </div>
  )

  const renderPanelLoading = () => (
    <div className={cn(AM_PANEL, "flex min-h-0 flex-1 flex-col overflow-hidden")}>
      <div className={cn(AM_PANEL_FILL, "gap-3 px-4 py-16")}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--cc-accent)] border-t-transparent" />
        <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Loading requests…</p>
      </div>
    </div>
  )

  return (
    <div
      className={cn(
        embedInDashboard ? "flex min-h-0 flex-1 flex-col overflow-hidden gap-3" : "space-y-3 sm:space-y-4",
      )}
    >
      {embedInDashboard ? (
        <FacultyIntegratedToolbar
          moduleId="office-hours"
          search={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchClear={() => setSearchQuery("")}
          searchPlaceholder="Search topic, student…"
          filters={
            <>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className={cn(facultyToolbarFilterButtonClass(statusFilter !== "all"), "h-9 min-w-[9rem] shadow-none")}>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "newest" | "oldest")}>
                <SelectTrigger className={cn(facultyToolbarFilterButtonClass(), "h-9 min-w-[9rem] shadow-none")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          meta={
            <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>
              {filteredRequests.length === requests.length
                ? `${filteredRequests.length} request${filteredRequests.length === 1 ? "" : "s"}`
                : `${filteredRequests.length} of ${requests.length} requests`}
              {pendingCount > 0 ? ` · ${pendingCount} pending` : ""}
              {scheduledThisWeek > 0 ? ` · ${scheduledThisWeek} this week` : ""}
            </span>
          }
          trailing={
            <Dialog
              open={configOpen}
              onOpenChange={(open) => {
                setConfigOpen(open)
                if (open && regularHours.length > 0) {
                  setConfigSlots(
                    regularHours.map((h: { dayOfWeek: number; startTime?: string; endTime?: string }) => ({
                      dayOfWeek: h.dayOfWeek,
                      startTime: h.startTime || "12:00",
                      endTime: h.endTime || "13:00",
                    })),
                  )
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className={facultyToolbarFilterButtonClass()}>
                  <Settings2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Regular hours</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Regular office hours</DialogTitle>
                  <DialogDescription>
                    Set your recurring office hours. Students will be scheduled during these times if no preferred date works.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {configSlots.map((slot, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--sidebar-accent)]/30 p-3">
                      <Select
                        value={String(slot.dayOfWeek)}
                        onValueChange={(v) => updateConfigSlot(i, "dayOfWeek", parseInt(v, 10))}
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAY_OPTIONS.map((d) => (
                            <SelectItem key={d.value} value={String(d.value)}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => updateConfigSlot(i, "startTime", e.target.value)}
                        className="w-[120px]"
                      />
                      <span className="text-slate-400">–</span>
                      <Input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => updateConfigSlot(i, "endTime", e.target.value)}
                        className="w-[120px]"
                      />
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeConfigSlot(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addConfigSlot}>
                    <Plus className="h-4 w-4 mr-2" /> Add slot
                  </Button>
                </div>
                <DialogFooter>
                  <Button variant="secondary" onClick={() => setConfigOpen(false)}>Cancel</Button>
                  <Button onClick={handleSaveRegularHours} disabled={savingConfig || configSlots.length === 0} className={fp.cta}>
                    {savingConfig ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          }
        />
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/instructor/dashboard">
              <Button variant="outline" size="sm" className="border-slate-200 dark:border-white/10 rounded-lg sm:rounded-xl text-xs sm:text-sm h-9">
                <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
                <Clock className="h-6 w-6 sm:h-7 sm:w-7 fp.iconText" />
                Office Hours
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Review and schedule student office hour requests
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {regularHours.length > 0 && (
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 hidden sm:block">
                Regular: {regularHours.map((h) => `${h.dayName} ${h.startTime}-${h.endTime}`).join(", ")}
              </p>
            )}
            <Dialog
              open={configOpen}
              onOpenChange={(open) => {
                setConfigOpen(open)
                if (open && regularHours.length > 0) {
                  setConfigSlots(
                    regularHours.map((h: { dayOfWeek: number; startTime?: string; endTime?: string }) => ({
                      dayOfWeek: h.dayOfWeek,
                      startTime: h.startTime || "12:00",
                      endTime: h.endTime || "13:00",
                    })),
                  )
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="border-slate-200 dark:border-white/10 rounded-lg sm:rounded-xl text-xs sm:text-sm h-9">
                  <Settings2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  Regular hours
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Regular office hours</DialogTitle>
                  <DialogDescription>
                    Set your recurring office hours. Students will be scheduled during these times if no preferred date works.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {configSlots.map((slot, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-white/5">
                      <Select
                        value={String(slot.dayOfWeek)}
                        onValueChange={(v) => updateConfigSlot(i, "dayOfWeek", parseInt(v, 10))}
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAY_OPTIONS.map((d) => (
                            <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => updateConfigSlot(i, "startTime", e.target.value)}
                        className="w-[100px]"
                      />
                      <span className="text-slate-500">to</span>
                      <Input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => updateConfigSlot(i, "endTime", e.target.value)}
                        className="w-[100px]"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-slate-500 hover:text-destructive"
                        onClick={() => removeConfigSlot(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addConfigSlot}>
                    <Plus className="h-4 w-4 mr-2" /> Add slot
                  </Button>
                </div>
                <DialogFooter>
                  <Button variant="secondary" onClick={() => setConfigOpen(false)}>Cancel</Button>
                  <Button onClick={handleSaveRegularHours} disabled={savingConfig || configSlots.length === 0}>
                    {savingConfig ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {pendingCount > 0 && (
              <Badge variant="secondary" className="rounded-lg text-xs font-medium bg-teal-500/10 fp.iconText border-teal-300/50">
                {pendingCount} pending
              </Badge>
            )}
          </div>
        </div>
      )}

      <div className={cn(embedInDashboard && "flex min-h-0 flex-1 flex-col overflow-hidden")}>
      {loading ? (
        embedInDashboard ? (
          renderPanelLoading()
        ) : (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Loading requests...</p>
        </div>
        )
      ) : requests.length === 0 ? (
        embedInDashboard ? (
          renderPanelEmpty(
            "No office hour requests yet",
            "Students can request from Support → Office Hours.",
          )
        ) : (
        <div className="bg-white/80 dark:bg-white/[0.02] backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.08] rounded-xl sm:rounded-2xl shadow-sm p-8 sm:p-12 text-center">
          <div className="p-3 sm:p-4 rounded-xl fp.iconBg w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 flex items-center justify-center">
            <Clock className="h-7 w-7 sm:h-8 sm:w-8 fp.iconText" />
          </div>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            No office hour requests yet. Students can request from Support → Office Hours.
          </p>
        </div>
        )
      ) : (
        <div className={cn(embedInDashboard && cn(AM_PANEL, "flex min-h-0 flex-1 flex-col overflow-hidden"))}>
        <>
          {!embedInDashboard && (
          <div className="bg-white/80 dark:bg-white/[0.02] backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.08] rounded-xl sm:rounded-2xl shadow-sm overflow-hidden">
            <div className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:flex-wrap">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-[140px] sm:w-[160px] text-xs sm:text-sm rounded-lg">
                    <Filter className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "newest" | "oldest")}>
                  <SelectTrigger className="h-9 w-[130px] sm:w-[150px] text-xs sm:text-sm rounded-lg">
                    <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest first</SelectItem>
                    <SelectItem value="oldest">Oldest first</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative flex-1 min-w-[140px] sm:min-w-[180px] max-w-[240px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Search topic, student..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-8 text-xs sm:text-sm rounded-lg"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 p-1 rounded-lg shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className={`rounded-md h-8 w-8 p-0 ${
                    viewMode === "grid" ? "bg-teal-500/20 fp.iconText" : "hover:bg-white/50 dark:hover:bg-white/5"
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className={`rounded-md h-8 w-8 p-0 ${
                    viewMode === "list" ? "bg-teal-500/20 fp.iconText" : "hover:bg-white/50 dark:hover:bg-white/5"
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {(statusFilter !== "all" || searchQuery) && (
              <div className="px-3 sm:px-4 pb-3 text-xs text-slate-500 dark:text-slate-400">
                Showing {filteredRequests.length} of {requests.length} requests
              </div>
            )}
          </div>
          )}

          {filteredRequests.length === 0 ? (
            embedInDashboard ? (
              renderPanelEmpty(
                "No requests match your filters",
                "Try clearing filters or searching with different keywords.",
                (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1"
                    onClick={() => {
                      setStatusFilter("all")
                      setSearchQuery("")
                    }}
                  >
                    Clear filters
                  </Button>
                ),
              )
            ) : (
            <div className="bg-white/80 dark:bg-white/[0.02] backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.08] rounded-xl sm:rounded-2xl shadow-sm p-8 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">No requests match your filters.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => { setStatusFilter("all"); setSearchQuery(""); }}>
                Clear filters
              </Button>
            </div>
            )
          ) : viewMode === "grid" ? (
        <div className={cn("grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4", embedInDashboard && cn(AM_PANEL_SCROLL, "min-h-0 flex-1 p-4 sm:p-5"))}>
          {filteredRequests.map((r: any) => (
            <div
              key={r.id}
              className="group bg-white/80 dark:bg-white/[0.02] backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.08] rounded-xl sm:rounded-2xl shadow-sm overflow-hidden hover:shadow-md hover:border-teal-300/50 dark:hover:border-teal-500/30 transition-all flex flex-col"
            >
              <div
                className="cursor-pointer p-4 sm:p-5 flex-1 min-w-0"
                onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`p-2.5 rounded-xl shrink-0 ${
                    r.status === "pending"
                      ? "bg-amber-500/10 dark:bg-amber-500/20"
                      : r.status === "approved" || r.status === "scheduled" || r.status === "completed"
                        ? "bg-emerald-500/10 dark:bg-emerald-500/20"
                        : "bg-slate-100/80 dark:bg-white/5"
                  }`}>
                    <Clock className={`h-5 w-5 shrink-0 ${
                      r.status === "pending"
                        ? "text-amber-600 dark:text-amber-400"
                        : r.status === "approved" || r.status === "scheduled" || r.status === "completed"
                          ? "fp.iconText"
                          : "text-slate-500 dark:text-slate-400"
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {r.topic}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {r.full_name || r.student_code}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Badge variant="outline" className={`rounded-lg text-xs capitalize ${statusColor(r.status)}`}>
                        {r.status}
                      </Badge>
                      {r.priority && (
                        <Badge variant="outline" className="rounded-lg text-xs font-normal">
                          {r.priority}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpandedId(expandedId === r.id ? null : r.id)
                    }}
                    aria-label={expandedId === r.id ? "Collapse" : "Expand"}
                  >
                    {expandedId === r.id ? (
                      <ChevronUp className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    )}
                  </button>
                </div>
                {r.area_of_concern && expandedId !== r.id && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-1">
                    {r.area_of_concern}
                  </p>
                )}
              </div>
              {expandedId === r.id && (
                <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 space-y-4 border-t border-slate-200/60 dark:border-white/[0.08] bg-slate-50/30 dark:bg-white/[0.02]">
                  {r.area_of_concern && (
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Area</span>
                      <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{r.area_of_concern}</p>
                    </div>
                  )}
                  {r.description && (
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Description</span>
                      <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap mt-0.5">{r.description}</p>
                    </div>
                  )}
                  {r.preferredDates?.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Preferred times</span>
                      <ul className="list-disc list-inside mt-1 text-sm text-slate-600 dark:text-slate-400 space-y-0.5">
                        {r.preferredDates.map((d: string, i: number) => (
                          <li key={i}>{new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.attachments?.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Attachments</span>
                      {r.attachments.map((a: any) => (
                        <pre
                          key={a.id}
                          className="text-xs bg-slate-100 dark:bg-white/5 p-3 rounded-lg overflow-x-auto max-h-32 overflow-y-auto border border-slate-200/60 dark:border-white/[0.08]"
                        >
                          {a.content || "(file)"}
                        </pre>
                      ))}
                    </div>
                  )}
                  {r.scheduled_date && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Calendar className="h-4 w-4 shrink-0 text-teal-500" />
                      Scheduled: {new Date(r.scheduled_date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </div>
                  )}
                  {r.meeting_link && (
                    <a
                      href={r.meeting_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm fp.iconText flex items-center gap-2 hover:underline"
                    >
                      <Link2 className="h-4 w-4 shrink-0" /> Meeting link
                    </a>
                  )}
                  {r.meeting_venue && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <MapPin className="h-4 w-4 shrink-0 text-teal-500" />
                      {r.meeting_venue}
                    </div>
                  )}
                  {r.instructor_notes && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 italic border-l-2 border-slate-200 dark:border-slate-700 pl-3">
                      {r.instructor_notes}
                    </p>
                  )}

                  {r.status === "pending" && editingId !== r.id && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button size="sm" onClick={() => handleApprove(r.id)} disabled={saving} className={fp.cta}>
                        <CheckCircle2 className="h-4 w-4 mr-1.5 shrink-0" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingId(r.id)
                          setScheduleForm({
                            status: "scheduled",
                            scheduledDate: "",
                            meetingLink: "",
                            meetingVenue: "",
                            instructorNotes: "",
                          })
                        }}
                        disabled={saving}
                      >
                        <Calendar className="h-4 w-4 mr-1.5 shrink-0" /> Schedule
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleReject(r.id)} disabled={saving} className="border-red-200 dark:border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10">
                        <XCircle className="h-4 w-4 mr-1.5 shrink-0" /> Reject
                      </Button>
                    </div>
                  )}

                  {editingId === r.id && (
                    <div className="space-y-4 p-4 bg-slate-100/80 dark:bg-white/5 rounded-xl border border-slate-200/60 dark:border-white/[0.08]">
                      <h4 className="font-medium text-slate-800 dark:text-slate-100">Schedule meeting</h4>
                      {r.preferredDates?.length > 0 && (
                        <p className="text-xs text-slate-500">
                          Student preferred: {r.preferredDates.map((d: string) => new Date(d).toLocaleString()).join("; ")}
                        </p>
                      )}
                      {regularHours.length > 0 && (
                        <p className="text-xs text-slate-500">
                          Your regular hours: {regularHours.map((h) => `${h.dayName} ${h.startTime}-${h.endTime}`).join(", ")}
                        </p>
                      )}
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Date & time</Label>
                          <Input
                            type="datetime-local"
                            value={scheduleForm.scheduledDate}
                            onChange={(e) => setScheduleForm((p) => ({ ...p, scheduledDate: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Meeting link</Label>
                          <Input
                            placeholder="https://meet.google.com/..."
                            value={scheduleForm.meetingLink}
                            onChange={(e) => setScheduleForm((p) => ({ ...p, meetingLink: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Venue (if in-person)</Label>
                        <Input
                          placeholder="Room 101, Building A"
                          value={scheduleForm.meetingVenue}
                          onChange={(e) => setScheduleForm((p) => ({ ...p, meetingVenue: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Notes for student</Label>
                        <Textarea
                          placeholder="Optional message..."
                          value={scheduleForm.instructorNotes}
                          onChange={(e) => setScheduleForm((p) => ({ ...p, instructorNotes: e.target.value }))}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => handleSchedule(r.id)} disabled={saving} className={fp.cta}>
                          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                          Save & notify student
                        </Button>
                        <Button variant="outline" onClick={() => setEditingId(null)} disabled={saving}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
          ) : (
            <div className={cn(
              "bg-white/80 dark:bg-white/[0.02] backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.08] rounded-xl sm:rounded-2xl shadow-sm overflow-hidden",
              embedInDashboard && cn(AM_PANEL, "min-h-0 flex-1"),
            )}>
              <div className={cn(embedInDashboard && AM_PANEL_SCROLL)}>
              {filteredRequests.map((r: any) => (
                <div key={r.id} className="border-b border-slate-200/60 dark:border-white/[0.08] last:border-0">
                  <div
                    className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 sm:p-5 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 ${
                        r.status === "pending" ? "bg-amber-500/10" : "bg-slate-100/80 dark:bg-white/5"
                      }`}>
                        <Clock className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate">{r.topic}</h3>
                        <p className="text-xs text-slate-500 truncate">{r.full_name || r.student_code}</p>
                      </div>
                      <Badge variant="outline" className={`rounded-lg text-xs capitalize shrink-0 ${statusColor(r.status)}`}>
                        {r.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0">
                      {r.scheduled_date ? (
                        <span>{new Date(r.scheduled_date).toLocaleDateString()}</span>
                      ) : r.preferredDates?.[0] ? (
                        <span>{new Date(r.preferredDates[0]).toLocaleDateString()}</span>
                      ) : null}
                      {expandedId === r.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                  {expandedId === r.id && (
                    <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 space-y-4 bg-slate-50/30 dark:bg-white/[0.02] border-t border-slate-200/60 dark:border-white/[0.08]">
                      {r.area_of_concern && (
                        <div>
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Area</span>
                          <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{r.area_of_concern}</p>
                        </div>
                      )}
                      {r.description && (
                        <div>
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Description</span>
                          <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap mt-0.5">{r.description}</p>
                        </div>
                      )}
                      {r.preferredDates?.length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Preferred times</span>
                          <ul className="list-disc list-inside mt-1 text-sm text-slate-600 dark:text-slate-400 space-y-0.5">
                            {r.preferredDates.map((d: string, i: number) => (
                              <li key={i}>{new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {r.scheduled_date && (
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <Calendar className="h-4 w-4 shrink-0 text-teal-500" />
                          Scheduled: {new Date(r.scheduled_date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                        </div>
                      )}
                      {r.meeting_link && (
                        <a href={r.meeting_link} target="_blank" rel="noopener noreferrer" className="text-sm fp.iconText flex items-center gap-2 hover:underline">
                          <Link2 className="h-4 w-4 shrink-0" /> Meeting link
                        </a>
                      )}
                      {r.meeting_venue && (
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <MapPin className="h-4 w-4 shrink-0 text-teal-500" />
                          {r.meeting_venue}
                        </div>
                      )}
                      {r.status === "pending" && editingId !== r.id && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          <Button size="sm" onClick={() => handleApprove(r.id)} disabled={saving} className={fp.cta}>
                            <CheckCircle2 className="h-4 w-4 mr-1.5 shrink-0" /> Approve
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => { setEditingId(r.id); setScheduleForm({ status: "scheduled", scheduledDate: "", meetingLink: "", meetingVenue: "", instructorNotes: "" }); }} disabled={saving}>
                            <Calendar className="h-4 w-4 mr-1.5 shrink-0" /> Schedule
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleReject(r.id)} disabled={saving} className="border-red-200 dark:border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10">
                            <XCircle className="h-4 w-4 mr-1.5 shrink-0" /> Reject
                          </Button>
                        </div>
                      )}
                      {editingId === r.id && (
                        <div className="space-y-4 p-4 bg-slate-100/80 dark:bg-white/5 rounded-xl border border-slate-200/60 dark:border-white/[0.08]">
                          <h4 className="font-medium text-slate-800 dark:text-slate-100">Schedule meeting</h4>
                          {r.preferredDates?.length > 0 && (
                            <p className="text-xs text-slate-500">Student preferred: {r.preferredDates.map((d: string) => new Date(d).toLocaleString()).join("; ")}</p>
                          )}
                          <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Date & time</Label>
                              <Input type="datetime-local" value={scheduleForm.scheduledDate} onChange={(e) => setScheduleForm((p) => ({ ...p, scheduledDate: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <Label>Meeting link</Label>
                              <Input placeholder="https://meet.google.com/..." value={scheduleForm.meetingLink} onChange={(e) => setScheduleForm((p) => ({ ...p, meetingLink: e.target.value }))} />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Venue (if in-person)</Label>
                            <Input placeholder="Room 101, Building A" value={scheduleForm.meetingVenue} onChange={(e) => setScheduleForm((p) => ({ ...p, meetingVenue: e.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label>Notes for student</Label>
                            <Textarea placeholder="Optional message..." value={scheduleForm.instructorNotes} onChange={(e) => setScheduleForm((p) => ({ ...p, instructorNotes: e.target.value }))} />
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={() => handleSchedule(r.id)} disabled={saving} className={fp.cta}>
                              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                              Save & notify student
                            </Button>
                            <Button variant="outline" onClick={() => setEditingId(null)} disabled={saving}>Cancel</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              </div>
            </div>
          )}
        </>
        </div>
      )}
      </div>
    </div>
  )
}
