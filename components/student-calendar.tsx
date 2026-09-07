"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  CheckCircle,
  Circle,
  Trash2,
  Edit,
  Bell,
  Sparkles,
  Target,
  Brain,
  ArrowLeft,
  Loader2,
  AlertCircle,
  TrendingUp,
  Zap,
  GraduationCap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { getStudentAuthHeaders } from "@/lib/auth"
import { PORTAL_CTA, PORTAL_OUTLINE_BTN } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { CalendarFeedSettingsCard } from "@/components/calendar/CalendarFeedSettingsCard"
import { SyllabusAddToCalendarMenu } from "@/components/syllabus/SyllabusAddToCalendarMenu"
import { importSyllabusDeadlinesToCalendar } from "@/lib/calendar/import-syllabus-deadlines-client"
import type {
  ParsedClassSchedule,
  SyllabusCalendarContext,
} from "@/lib/syllabus/calendar-export"

interface CalendarEvent {
  id: number
  title: string
  description?: string
  event_type: string
  start_time: string
  end_time?: string
  all_day: boolean
  location?: string
  color: string
  is_completed: boolean
  reminder_minutes: number
  isClassMeeting?: boolean
}

interface StudyGoal {
  id: number
  title: string
  description?: string
  target_date: string
  is_completed: boolean
  progress: number
  priority: string
}

interface StudentCalendarProps {
  studentId: string
  embedInDashboard?: boolean
  hubLayout?: boolean
}

const EVENT_CONFIG = {
  study_session: {
    color: "var(--cc-accent)",
    icon: Clock,
    label: "Study session",
  },
  quiz: {
    color: "var(--cc-warning)",
    icon: Edit,
    label: "Quiz",
  },
  exam: {
    color: "var(--cc-danger)",
    icon: AlertCircle,
    label: "Exam",
  },
  assignment: {
    color: "var(--cc-warning)",
    icon: Edit,
    label: "Assignment",
  },
  office_hours: {
    color: "var(--cc-success)",
    icon: MapPin,
    label: "Office hours",
  },
  group_study: {
    color: "var(--cc-accent)",
    icon: Brain,
    label: "Group study",
  },
  ai_reminder: {
    color: "var(--cc-accent)",
    icon: Bell,
    label: "Reminder",
  },
  class_meeting: {
    color: "var(--cc-accent)",
    icon: GraduationCap,
    label: "Class",
  },
}

const THEMED_EVENT_ROW =
  "rounded-lg border border-[var(--border)] border-l-[3px] border-l-[var(--cc-accent)] bg-[var(--muted)]/40 hover:bg-[var(--cc-accent-soft)]/50 transition-colors cursor-pointer"
const THEMED_EVENT_PILL =
  "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
const THEMED_EVENT_ICON_WRAP = "p-1.5 rounded-lg shrink-0 bg-[var(--cc-accent-soft)]"
const THEMED_EVENT_ICON = "w-4 h-4 text-[var(--cc-accent-dark)]"
const THEMED_EVENT_TYPE_BADGE =
  "text-xs font-medium border-[var(--cc-accent-border)] text-[var(--cc-accent-dark)] bg-[var(--cc-accent-soft)]"
const THEMED_PANEL_SUBTEXT = "text-sm text-white/85"

function isClassMeetingEvent(event: CalendarEvent): boolean {
  return event.isClassMeeting === true || event.event_type === "class_meeting"
}

export function StudentCalendar({ studentId, embedInDashboard = false, hubLayout = false }: StudentCalendarProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [studyGoals, setStudyGoals] = useState<StudyGoal[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showEventDialog, setShowEventDialog] = useState(false)
  const [showGoalDialog, setShowGoalDialog] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [importingSyllabusDeadlines, setImportingSyllabusDeadlines] = useState(false)
  const [classMeetings, setClassMeetings] = useState<CalendarEvent[]>([])
  const [classScheduleInfo, setClassScheduleInfo] = useState<{
    hasSchedule: boolean
    scheduleText: string
    location: string
    schedule: ParsedClassSchedule | null
    context: SyllabusCalendarContext | null
  }>({
    hasSchedule: false,
    scheduleText: "",
    location: "",
    schedule: null,
    context: null,
  })
  const [showClassMeetingDialog, setShowClassMeetingDialog] = useState(false)
  const [viewingClassMeeting, setViewingClassMeeting] = useState<CalendarEvent | null>(null)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'study_session',
    start_time: '',
    end_time: '',
    all_day: false,
    location: '',
    reminder_minutes: 30
  })

  const [goalFormData, setGoalFormData] = useState({
    title: '',
    description: '',
    target_date: '',
    priority: 'medium'
  })

  useEffect(() => {
    if (studentId) {
      void fetchEventsAndClassSchedule()
      fetchStudyGoals()
    }
  }, [currentDate, studentId])

  useEffect(() => {
    if (!studentId) return
    const refresh = () => {
      void fetchEventsAndClassSchedule()
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh()
    }
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [studentId])

  const fetchEventsAndClassSchedule = async () => {
    setLoading(true)
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 3, 0)

      const response = await fetch(
        `/api/calendar/events?studentId=${studentId}&startDate=${startOfMonth.toISOString()}&endDate=${endDate.toISOString()}`
      )
      const data = await response.json()

      const loadedEvents = data.success ? (data.events || []) : []
      setEvents(loadedEvents)
      await fetchClassSchedule(startOfMonth, endDate)
    } catch (error) {
      console.error("Failed to fetch calendar:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchClassSchedule = async (startOfMonth: Date, endDate: Date) => {
    try {
      const response = await fetch(
        `/api/calendar/class-schedule?studentId=${studentId}&startDate=${startOfMonth.toISOString()}&endDate=${endDate.toISOString()}`,
        { headers: getStudentAuthHeaders() },
      )
      const data = await response.json()

      if (data.success) {
        setClassMeetings([
          ...(data.events || []).map((e: CalendarEvent) => ({ ...e, isClassMeeting: true })),
          ...(Array.isArray(data.officeHoursEvents)
            ? data.officeHoursEvents.map((e: CalendarEvent) => ({ ...e, isClassMeeting: false }))
            : []),
        ])
        setClassScheduleInfo({
          hasSchedule: Boolean(data.hasSchedule),
          scheduleText: data.scheduleText || "",
          location: data.location || "",
          schedule: data.schedule || null,
          context: data.context || null,
        })
      }
    } catch (error) {
      console.error("Failed to fetch class schedule:", error)
    }
  }

  const fetchEvents = async () => {
    await fetchEventsAndClassSchedule()
  }

  const fetchStudyGoals = async () => {
    try {
      const response = await fetch(`/api/calendar/goals?studentId=${studentId}`)
      const data = await response.json()

      if (data.success) {
        setStudyGoals(data.goals || [])
      }
    } catch (error) {
      console.error('Failed to fetch study goals:', error)
    }
  }

  const createEvent = async () => {
    if (!formData.title || !formData.start_time) {
      toast({
        title: "Missing Information",
        description: "Please provide a title and start time",
        variant: "destructive"
      })
      return
    }

    try {
      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          ...formData,
          color: EVENT_CONFIG[formData.event_type as keyof typeof EVENT_CONFIG].color
        })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "✅ Event Created!",
          description: formData.title
        })
        
        setEvents(prev => [...prev, data.event])
        setShowEventDialog(false)
        resetForm()
        setTimeout(() => fetchEvents(), 500)
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to create event",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create event",
        variant: "destructive"
      })
    }
  }

  const toggleEventComplete = async (eventId: number, isCompleted: boolean) => {
    try {
      await fetch('/api/calendar/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, isCompleted: !isCompleted })
      })
      fetchEvents()
    } catch (error) {
      toast({ title: "Error", description: "Failed to update event", variant: "destructive" })
    }
  }

  const deleteEvent = async (eventId: number) => {
    try {
      await fetch(`/api/calendar/events?eventId=${eventId}`, { method: 'DELETE' })
      toast({ title: "Event deleted" })
      fetchEvents()
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete event", variant: "destructive" })
    }
  }

  const importSyllabusDeadlines = async () => {
    setImportingSyllabusDeadlines(true)
    try {
      const result = await importSyllabusDeadlinesToCalendar({
        studentId,
        importAll: true,
      })
      if (!result.success) {
        toast({
          title: "Import failed",
          description: result.error || "Could not import syllabus due dates.",
          variant: "destructive",
        })
        return
      }
      toast({
        title: result.imported ? "Syllabus due dates added" : "Already up to date",
        description: result.message,
      })
      if (result.imported) fetchEvents()
    } finally {
      setImportingSyllabusDeadlines(false)
    }
  }

  const generateStudyPlan = async () => {
    setGeneratingPlan(true)
    try {
      const response = await fetch('/api/calendar/study-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          examDate: '2025-11-15',
          availableHoursPerDay: 2
        })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "🎉 Study Plan Generated!",
          description: `${data.eventsCreated} study sessions added to your calendar`
        })
        fetchEvents()
      } else {
        toast({
          title: "Generation Complete",
          description: data.error || "Study plan created",
          variant: "default"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate study plan",
        variant: "destructive"
      })
    } finally {
      setGeneratingPlan(false)
    }
  }

  const createGoal = async () => {
    if (!goalFormData.title) {
      toast({ title: "Missing Information", description: "Please provide a goal title", variant: "destructive" })
      return
    }

    try {
      const response = await fetch('/api/calendar/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, ...goalFormData, goal_type: 'custom' })
      })

      const data = await response.json()

      if (data.success) {
        toast({ title: "🎯 Goal Created!", description: goalFormData.title })
        setShowGoalDialog(false)
        setGoalFormData({ title: '', description: '', target_date: '', priority: 'medium' })
        fetchStudyGoals()
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create goal", variant: "destructive" })
    }
  }

  const toggleGoalComplete = async (goalId: number, isCompleted: boolean) => {
    try {
      await fetch('/api/calendar/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId, isCompleted: !isCompleted, progress: !isCompleted ? 100 : 0 })
      })
      fetchStudyGoals()
    } catch (error) {
      toast({ title: "Error", description: "Failed to update goal", variant: "destructive" })
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      event_type: 'study_session',
      start_time: '',
      end_time: '',
      all_day: false,
      location: '',
      reminder_minutes: 30
    })
    setEditingEvent(null)
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month - 1, prevMonthLastDay - i), isCurrentMonth: false })
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push({ date: new Date(year, month, day), isCurrentMonth: true })
    }

    const remainingDays = 42 - days.length
    for (let day = 1; day <= remainingDays; day++) {
      days.push({ date: new Date(year, month + 1, day), isCurrentMonth: false })
    }

    return days
  }

  const getEventsForDate = (date: Date) => {
    return allEvents.filter(event => {
      const eventDate = new Date(event.start_time)
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      )
    })
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  const calendarDays = getDaysInMonth(currentDate)
  const monthNames = ["January", "February", "March", "April", "May", "June", 
                      "July", "August", "September", "October", "November", "December"]

  const allEvents = [
    ...events.filter(
      (e) => e.event_type !== "class_meeting" && e.related_type !== "class_meeting",
    ),
    ...classMeetings,
  ].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  )

  const todayEvents = allEvents.filter(e => {
    const eventDate = new Date(e.start_time)
    return isToday(eventDate) && !e.is_completed
  }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

  const upcomingEvents = allEvents.filter(e => {
    const eventDate = new Date(e.start_time)
    const now = new Date()
    return eventDate > now && !e.is_completed
  }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

  const activeGoals = studyGoals.filter(g => !g.is_completed)
  const completedToday = allEvents.filter(e => isToday(new Date(e.start_time)) && e.is_completed).length
  const totalEvents = allEvents.filter(e => !e.is_completed).length

  const openEventEditor = (event: CalendarEvent) => {
    if (isClassMeetingEvent(event)) {
      setViewingClassMeeting(event)
      setShowClassMeetingDialog(true)
      return
    }
    setEditingEvent(event)
    setFormData({
      title: event.title,
      description: event.description || "",
      event_type: event.event_type,
      start_time: new Date(event.start_time).toISOString().slice(0, 16),
      end_time: event.end_time ? new Date(event.end_time).toISOString().slice(0, 16) : "",
      all_day: event.all_day,
      location: event.location || "",
      reminder_minutes: event.reminder_minutes,
    })
    setShowEventDialog(true)
  }

  const monthLabel = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`

  const renderCalendarGrid = (compact = false) => {
    if (loading) {
      return (
        <div className="flex min-h-[320px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--cc-accent)]" />
        </div>
      )
    }
    return (
      <>
        <div className="mb-2 grid grid-cols-7 gap-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-center text-[10px] font-medium uppercase tracking-wide text-[var(--cc-text-muted)]">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            const dayEvents = getEventsForDate(day.date)
            const isTodayDate = isToday(day.date)
            return (
              <button
                key={index}
                type="button"
                disabled={!day.isCurrentMonth}
                onClick={() => {
                  if (!day.isCurrentMonth) return
                  setSelectedDate(day.date)
                  setFormData({
                    ...formData,
                    start_time: new Date(day.date.setHours(14, 0)).toISOString().slice(0, 16),
                  })
                  setShowEventDialog(true)
                }}
                className={cn(
                  "min-h-[52px] rounded-lg p-1 text-left transition-colors sm:min-h-[58px] sm:p-1.5",
                  !day.isCurrentMonth && "cursor-default opacity-35",
                  isTodayDate
                    ? "bg-[var(--cc-accent-soft)] ring-1 ring-[var(--cc-accent-border)]"
                    : "hover:bg-[var(--muted)]/80",
                )}
              >
                <div
                  className={cn(
                    "mb-0.5 flex items-center justify-center text-xs font-semibold sm:text-sm",
                    isTodayDate ? "text-[var(--cc-accent)]" : "text-[var(--cc-text)]",
                  )}
                >
                  {day.date.getDate()}
                </div>
                <div className="flex flex-wrap items-center gap-0.5">
                  {dayEvents.slice(0, compact ? 3 : 4).map((event) => {
                    const tone =
                      EVENT_CONFIG[event.event_type as keyof typeof EVENT_CONFIG]?.color ??
                      "var(--cc-accent)"
                    return (
                      <span
                        key={event.id}
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: tone }}
                        title={event.title}
                        onClick={(e) => {
                          e.stopPropagation()
                          openEventEditor(event)
                        }}
                      />
                    )
                  })}
                  {dayEvents.length > (compact ? 3 : 4) && (
                    <span className="text-[9px] font-medium text-[var(--cc-text-muted)]">
                      +{dayEvents.length - (compact ? 3 : 4)}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </>
    )
  }

  const renderAgendaItem = (event: CalendarEvent) => {
    const config = EVENT_CONFIG[event.event_type as keyof typeof EVENT_CONFIG]
    const IconComponent = config?.icon || Clock
    const start = new Date(event.start_time)
    const isTodayEvent = isToday(start)
    return (
      <button
        key={event.id}
        type="button"
        onClick={() => openEventEditor(event)}
        className="flex w-full items-center gap-3 border-b border-[var(--border)] px-4 py-3 text-left last:border-b-0 hover:bg-[var(--muted)]/40"
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: "color-mix(in srgb, var(--cc-accent-soft) 80%, transparent)",
            color: config?.color ?? "var(--cc-accent)",
          }}
        >
          <IconComponent className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--cc-text)]">{event.title}</p>
          <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">
            {config?.label ?? "Event"}
            {" · "}
            {isTodayEvent ? "Today" : start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            {" · "}
            {start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
      </button>
    )
  }

  return (
    <div className={cn(embedInDashboard ? "space-y-3" : "space-y-6 sm:space-y-8")}>
      {embedInDashboard ? (
        <>
          {!hubLayout ? (
          <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
            <div className="flex min-w-0 items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
                  Calendar
                </p>
                <p className="mt-0.5 truncate text-sm text-[var(--cc-text)]">
                  {todayEvents.length} today
                  <span className="text-[var(--cc-text-muted)]">
                    {" "}
                    · {upcomingEvents.length} upcoming
                    {classScheduleInfo.hasSchedule ? ` · ${classScheduleInfo.scheduleText}` : ""}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 rounded-xl px-2.5 text-[var(--cc-text)]"
                  onClick={generateStudyPlan}
                  disabled={generatingPlan}
                >
                  {generatingPlan ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Brain className="h-4 w-4" />
                  )}
                  <span className="ml-1.5 hidden sm:inline">Study plan</span>
                </Button>
                <Button
                  type="button"
                  className="h-9 rounded-xl border-0 px-3 shadow-none hover:opacity-90"
                  style={{ backgroundColor: "var(--cc-accent)", color: "#FFFFFF" }}
                  onClick={() => {
                    setFormData({ ...formData, start_time: new Date().toISOString().slice(0, 16) })
                    setShowEventDialog(true)
                  }}
                >
                  <Plus className="h-4 w-4" />
                  <span className="ml-1.5 hidden sm:inline">Add event</span>
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowGoalDialog(true)}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: "var(--muted)", color: "var(--cc-text-muted)" }}
              >
                New goal
              </button>
              <button
                type="button"
                disabled={importingSyllabusDeadlines}
                onClick={() => void importSyllabusDeadlines()}
                className="rounded-full px-3 py-1 text-xs font-medium disabled:opacity-50"
                style={{ backgroundColor: "var(--muted)", color: "var(--cc-text-muted)" }}
              >
                {importingSyllabusDeadlines ? "Importing…" : "Import syllabus dates"}
              </button>
            </div>
          </div>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-xl px-2.5 text-[var(--cc-text)]"
                onClick={generateStudyPlan}
                disabled={generatingPlan}
              >
                {generatingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                <span className="ml-1.5 hidden sm:inline">Study plan</span>
              </Button>
              <Button
                type="button"
                className="h-9 rounded-xl border-0 px-3 shadow-none hover:opacity-90"
                style={{ backgroundColor: "var(--cc-accent)", color: "#FFFFFF" }}
                onClick={() => {
                  setFormData({ ...formData, start_time: new Date().toISOString().slice(0, 16) })
                  setShowEventDialog(true)
                }}
              >
                <Plus className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">Add event</span>
              </Button>
              <button
                type="button"
                onClick={() => setShowGoalDialog(true)}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: "var(--muted)", color: "var(--cc-text-muted)" }}
              >
                New goal
              </button>
              <button
                type="button"
                disabled={importingSyllabusDeadlines}
                onClick={() => void importSyllabusDeadlines()}
                className="rounded-full px-3 py-1 text-xs font-medium disabled:opacity-50"
                style={{ backgroundColor: "var(--muted)", color: "var(--cc-text-muted)" }}
              >
                {importingSyllabusDeadlines ? "Importing…" : "Import syllabus dates"}
              </button>
            </div>
          )}

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] xl:items-start">
            <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
                <h3 className="text-sm font-semibold text-[var(--cc-text)]">{monthLabel}</h3>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentDate((p) => new Date(p.getFullYear(), p.getMonth() - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => setCurrentDate(new Date())}
                  >
                    Today
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentDate((p) => new Date(p.getFullYear(), p.getMonth() + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="p-3 sm:p-4">{renderCalendarGrid(true)}</div>
            </section>

            <section className="flex min-h-[360px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
              <div className="border-b border-[var(--border)] px-4 py-3">
                <h3 className="text-sm font-semibold text-[var(--cc-text)]">Agenda</h3>
                <p className="text-xs text-[var(--cc-text-muted)]">Today, then what’s next</p>
              </div>
              <ScrollArea className="flex-1">
                <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
                  Today
                </p>
                {todayEvents.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-[var(--cc-text-muted)]">Nothing scheduled today.</p>
                ) : (
                  todayEvents.map(renderAgendaItem)
                )}
                <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
                  Coming up
                </p>
                {upcomingEvents.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-[var(--cc-text-muted)]">No upcoming events.</p>
                ) : (
                  upcomingEvents.slice(0, 10).map(renderAgendaItem)
                )}
                <div className="border-t border-[var(--border)] px-4 py-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
                      Goals
                    </p>
                    <button
                      type="button"
                      className="text-xs font-medium text-[var(--cc-accent)]"
                      onClick={() => setShowGoalDialog(true)}
                    >
                      Add
                    </button>
                  </div>
                  {activeGoals.length === 0 ? (
                    <p className="text-sm text-[var(--cc-text-muted)]">No active goals.</p>
                  ) : (
                    <ul className="space-y-2">
                      {activeGoals.slice(0, 4).map((goal) => (
                        <li key={goal.id} className="flex items-start gap-2 text-sm">
                          <button
                            type="button"
                            className="mt-0.5 shrink-0"
                            onClick={() => toggleGoalComplete(goal.id, goal.is_completed)}
                          >
                            <Circle className="h-4 w-4 text-[var(--cc-accent)]" />
                          </button>
                          <span className="line-clamp-2 text-[var(--cc-text)]">{goal.title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </ScrollArea>
            </section>
          </div>
        </>
      ) : (
      <>
      {/* Legacy layout (non dashboard-v2 embed) */}
      <div className="space-y-6">
        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        >
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-[var(--cc-text-muted)] mb-1">Today</p>
                <p className="text-2xl sm:text-3xl font-bold text-[var(--cc-accent-dark)] tabular-nums">{todayEvents.length}</p>
              </div>
              <Clock className="w-8 h-8 text-[var(--cc-accent)]/30 shrink-0" />
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-[var(--cc-text-muted)] mb-1">Upcoming</p>
                <p className="text-2xl sm:text-3xl font-bold text-[var(--cc-accent-dark)] tabular-nums">{upcomingEvents.length}</p>
              </div>
              <Bell className="w-8 h-8 text-[var(--cc-accent)]/30 shrink-0" />
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-[var(--cc-text-muted)] mb-1">Completed</p>
                <p className="text-2xl sm:text-3xl font-bold text-[var(--cc-accent-dark)] tabular-nums">{completedToday}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-[var(--cc-accent)]/30 shrink-0" />
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-[var(--cc-text-muted)] mb-1">Goals</p>
                <p className="text-2xl sm:text-3xl font-bold text-[var(--cc-accent-dark)] tabular-nums">{activeGoals.length}</p>
              </div>
              <Target className="w-8 h-8 text-[var(--cc-accent)]/30 shrink-0" />
            </div>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
          {/* Calendar - Enhanced Design */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm overflow-hidden min-h-[480px] sm:min-h-[600px] lg:h-[780px] max-h-[calc(100dvh-10rem)] flex flex-col">
              <div className="border-b border-[var(--border)] sticky top-0 z-10 bg-[var(--cc-accent)] text-white p-4 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <CalendarIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold">
                        {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                      </h3>
                      <p className="text-sm text-white/85 mt-0.5">{totalEvents} active events</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}
                      className="text-white hover:bg-white/20 rounded-xl"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentDate(new Date())}
                      className="text-white hover:bg-white/20 px-4 rounded-xl"
                    >
                      Today
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}
                      className="text-white hover:bg-white/20 rounded-xl"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                    <div className="w-px h-6 bg-white/30 mx-2" />
                    <Button
                      size="sm"
                      onClick={() => {
                        setFormData({ ...formData, start_time: new Date().toISOString().slice(0, 16) })
                        setShowEventDialog(true)
                      }}
                      className="bg-white/95 text-[var(--cc-accent-dark)] hover:bg-white rounded-xl font-semibold"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Event
                    </Button>
                  </div>
                </div>
              </div>

              {/* Scrollable Calendar Content */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 animate-spin text-[var(--cc-accent-dark)] mx-auto mb-3 sm:mb-4" />
                      <p className="text-xs sm:text-sm text-[var(--cc-text-muted)] break-words">Loading your calendar...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 sm:mb-3 sticky top-0 bg-[var(--card)]/95 py-1.5 sm:py-2 backdrop-blur-sm">
                      {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                        <div key={day} className="text-center text-[10px] sm:text-xs font-bold text-[var(--cc-text-muted)] uppercase tracking-wide break-words">
                          {day.slice(0, 3)}
                        </div>
                      ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-1 sm:gap-2">
                      {calendarDays.map((day, index) => {
                        const dayEvents = getEventsForDate(day.date)
                        const isTodayDate = isToday(day.date)
                        const hasEvents = dayEvents.length > 0

                        return (
                          <motion.div
                            key={index}
                            whileHover={{ scale: day.isCurrentMonth ? 1.03 : 1 }}
                            whileTap={{ scale: day.isCurrentMonth ? 0.98 : 1 }}
                            className={`
                              min-h-[60px] sm:min-h-[70px] md:min-h-[75px] p-1.5 sm:p-2 rounded-lg sm:rounded-xl border-2 cursor-pointer transition-all
                              ${isTodayDate 
                                ? 'bg-[var(--cc-accent-soft)] border-[var(--cc-accent)] ring-2 ring-[var(--cc-accent-border)]' 
                                : hasEvents
                                ? 'bg-[var(--card)] border-[var(--border)] hover:shadow-md hover:border-[var(--cc-accent-border)]'
                                : 'bg-[var(--muted)] border-[var(--border)] hover:bg-[var(--muted)]'
                              }
                              ${!day.isCurrentMonth ? 'opacity-40' : ''}
                            `}
                            onClick={() => {
                              if (day.isCurrentMonth) {
                                setSelectedDate(day.date)
                                setFormData({
                                  ...formData,
                                  start_time: new Date(day.date.setHours(14, 0)).toISOString().slice(0, 16)
                                })
                                setShowEventDialog(true)
                              }
                            }}
                          >
                            <div className={`
                              text-xs sm:text-sm font-bold mb-1 sm:mb-1.5 flex items-center justify-center
                              ${isTodayDate 
                                ? 'text-[var(--cc-accent-dark)]' 
                                : day.isCurrentMonth 
                                ? 'text-[var(--cc-text)]'
                                : 'text-[var(--cc-text-muted)]'
                              }
                            `}>
                              {isTodayDate && <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-[var(--cc-accent)] rounded-full mr-1 sm:mr-1.5 shrink-0" />}
                              {day.date.getDate()}
                            </div>

                            <div className="space-y-0.5 sm:space-y-1">
                              {dayEvents.slice(0, 3).map(event => (
                                  <div
                                    key={event.id}
                                    className={`text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 sm:py-1 rounded sm:rounded-md flex items-center gap-1 sm:gap-1.5 cursor-pointer hover:scale-105 transition-transform ${THEMED_EVENT_PILL}`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openEventEditor(event)
                                    }}
                                  >
                                    <div className="w-0.5 h-0.5 sm:w-1 sm:h-1 rounded-full shrink-0 bg-[var(--cc-accent)]" />
                                    <span className="font-medium truncate text-[10px] sm:text-xs break-words text-[var(--cc-accent-dark)]">
                                      {event.title}
                                    </span>
                                  </div>
                              ))}
                              
                              {dayEvents.length > 3 && (
                                <div className="text-[10px] sm:text-xs text-[var(--cc-accent-dark)] font-semibold pl-0.5 sm:pl-1 break-words">
                                  +{dayEvents.length - 3} <span className="hidden sm:inline">more</span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>

          {/* Enhanced Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-6"
          >
            {/* Class Schedule */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm overflow-hidden">
              <div className="bg-[var(--cc-accent)] text-white p-5">
                <div className="flex items-center gap-2 mb-1">
                  <GraduationCap className="w-5 h-5" />
                  <h3 className="text-lg font-bold">Class Schedule</h3>
                </div>
                <p className="text-sm text-white/85">
                  {classScheduleInfo.hasSchedule
                    ? "Synced from your course syllabus"
                    : "No published class schedule found"}
                </p>
              </div>
              <div className="p-4 space-y-3">
                {classScheduleInfo.hasSchedule ? (
                  <>
                    <div className="rounded-xl border border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)] p-3 space-y-2">
                      <div className="flex items-start gap-2 text-sm">
                        <Clock className="w-4 h-4 text-[var(--cc-accent-dark)] mt-0.5 shrink-0" />
                        <p className="text-[var(--cc-text)] font-medium leading-snug">
                          {classScheduleInfo.scheduleText}
                        </p>
                      </div>
                      {classScheduleInfo.location && (
                        <div className="flex items-start gap-2 text-sm text-[var(--cc-text-muted)]">
                          <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                          <p>{classScheduleInfo.location}</p>
                        </div>
                      )}
                      <p className="text-xs text-[var(--cc-text-muted)]">
                        {classMeetings.length} class meeting{classMeetings.length !== 1 ? "s" : ""} shown on your calendar
                      </p>
                    </div>
                    {classScheduleInfo.schedule && classScheduleInfo.context && (
                      <SyllabusAddToCalendarMenu
                        mode="class-schedule"
                        schedule={classScheduleInfo.schedule}
                        context={classScheduleInfo.context}
                        variant="button"
                      />
                    )}
                  </>
                ) : (
                  <div className="text-center py-6">
                    <GraduationCap className="w-10 h-10 text-[var(--cc-text-muted)] mx-auto mb-2" />
                    <p className="text-sm text-[var(--cc-text-muted)]">
                      Class times appear here once your instructor publishes meeting days and times in the syllabus.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* AI Study Assistant */}
            <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--cc-accent)] shadow-sm">
              <div className="p-5 sm:p-6 space-y-4">
                <div className="text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold">AI Study Assistant</h3>
                  </div>
                  <p className="text-sm text-white/85">Powered by GPT-4 • Personalized for you</p>
                </div>
                <div className="space-y-3">
                  <Button
                    className="w-full bg-white/95 text-[var(--cc-accent-dark)] hover:bg-white font-semibold rounded-xl"
                    onClick={generateStudyPlan}
                    disabled={generatingPlan}
                    size="lg"
                  >
                    {generatingPlan ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Brain className="w-5 h-5 mr-2" />
                        Generate Study Plan
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="w-full bg-white/10 hover:bg-white/20 border-2 border-white/30 text-white font-semibold rounded-xl"
                    onClick={() => setShowGoalDialog(true)}
                    size="lg"
                  >
                    <Target className="w-5 h-5 mr-2" />
                    Set Study Goal
                  </Button>
                </div>
                
                <div className="pt-3 border-t border-white/20">
                  <p className="text-xs text-white/90 text-center">
                    ✨ AI analyzes your progress to create the perfect study schedule
                  </p>
                </div>
              </div>
            </div>

            {/* Today's Schedule */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm overflow-hidden">
              <div className="bg-[var(--cc-accent)] text-white p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-5 h-5" />
                  <h3 className="text-lg font-bold">Today's Schedule</h3>
                </div>
                {todayEvents.length > 0 && (
                  <p className="text-sm text-white/85">{todayEvents.length} event{todayEvents.length > 1 ? 's' : ''} planned</p>
                )}
              </div>
              <div className="p-4">
                {todayEvents.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 bg-[var(--muted)] rounded-full flex items-center justify-center mx-auto mb-3">
                      <Clock className="w-8 h-8 text-[var(--cc-text-muted)]" />
                    </div>
                    <p className="text-sm font-medium text-[var(--cc-text)] mb-1">No events today</p>
                    <p className="text-xs text-[var(--cc-text-muted)]">Perfect time to relax or get ahead!</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[280px]">
                    <div className="space-y-2.5 pr-4">
                      <AnimatePresence>
                        {todayEvents.map((event, idx) => {
                          const config = EVENT_CONFIG[event.event_type as keyof typeof EVENT_CONFIG]
                          const IconComponent = config?.icon || Clock
                          return (
                            <motion.div
                              key={event.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ delay: idx * 0.05 }}
                              className={`group p-3 ${THEMED_EVENT_ROW}`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                  <div className={THEMED_EVENT_ICON_WRAP}>
                                    <IconComponent className={THEMED_EVENT_ICON} />
                                  </div>
                                  <span className="font-semibold text-sm text-[var(--cc-text)] truncate">{event.title}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {!isClassMeetingEvent(event) && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => toggleEventComplete(event.id, event.is_completed)}
                                      >
                                        <CheckCircle className="w-4 h-4 text-[var(--cc-accent-dark)]" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => deleteEvent(event.id)}
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                              
                              <div className="space-y-1 ml-9">
                                <div className="flex items-center gap-2 text-xs font-medium text-[var(--cc-accent-dark)]">
                                  <Clock className="w-3 h-3" />
                                  {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {event.end_time && ` - ${new Date(event.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                </div>
                                {event.location && (
                                  <div className="flex items-center gap-2 text-xs text-[var(--cc-text-muted)]">
                                    <MapPin className="w-3 h-3" />
                                    {event.location}
                                  </div>
                                )}
                                {event.description && (
                                  <p className="text-xs text-[var(--cc-text-muted)] line-clamp-2">
                                    {event.description}
                                  </p>
                                )}
                              </div>
                            </motion.div>
                          )
                        })}
                      </AnimatePresence>
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>

            {/* Study Goals */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm overflow-hidden">
              <div className="bg-[var(--cc-accent)] text-white p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-5 h-5" />
                  <h3 className="text-lg font-bold">Study Goals</h3>
                </div>
                {activeGoals.length > 0 && (
                  <p className="text-sm text-white/85">{activeGoals.length} active goal{activeGoals.length > 1 ? 's' : ''}</p>
                )}
              </div>
              <div className="p-4">
                {activeGoals.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-[var(--cc-accent-soft)] rounded-full flex items-center justify-center mx-auto mb-3">
                      <Target className="w-8 h-8 text-[var(--cc-accent-dark)]" />
                    </div>
                    <p className="text-sm font-medium text-[var(--cc-text)] mb-2">No active goals</p>
                    <Button
                      size="sm"
                      onClick={() => setShowGoalDialog(true)}
                      className="bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] rounded-xl text-white"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Create Your First Goal
                    </Button>
                  </div>
                ) : (
                  <ScrollArea className="h-[250px]">
                    <div className="space-y-2 pr-4">
                      {activeGoals.map((goal, idx) => {
                        const priorityColors = {
                          urgent: "bg-[var(--cc-accent)]/15 text-[var(--cc-accent-dark)] border-[var(--cc-accent-border)]",
                          high: "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)] border-[var(--cc-accent-border)]",
                          medium: "bg-[var(--muted)] text-[var(--cc-text)] border-[var(--border)]",
                          low: "bg-[var(--muted)] text-[var(--cc-text-muted)] border-[var(--border)]",
                        }
                        
                        return (
                          <motion.div
                            key={goal.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="p-3 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/50 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 mt-0.5 shrink-0"
                                onClick={() => toggleGoalComplete(goal.id, goal.is_completed)}
                              >
                                <Circle className="w-5 h-5 text-[var(--cc-accent)] hover:text-[var(--cc-accent-dark)]" />
                              </Button>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-[var(--cc-text)] mb-2">
                                  {goal.title}
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge 
                                    className={`text-xs font-bold border ${priorityColors[goal.priority as keyof typeof priorityColors]}`}
                                  >
                                    {goal.priority.toUpperCase()}
                                  </Badge>
                                  {goal.target_date && (
                                    <span className="text-xs text-[var(--cc-text-muted)] flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {new Date(goal.target_date).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>

            {/* Coming Up */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm overflow-hidden">
              <div className="bg-[var(--cc-accent)] text-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Bell className="w-5 h-5" />
                      <h3 className="text-lg font-bold">Coming Up</h3>
                    </div>
                    <p className="text-sm text-white/85">{upcomingEvents.length} upcoming event{upcomingEvents.length !== 1 ? 's' : ''}</p>
                  </div>
                  {upcomingEvents.length > 0 && (
                    <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4">
                {upcomingEvents.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 bg-[var(--cc-accent-soft)] rounded-full flex items-center justify-center mx-auto mb-3">
                      <Bell className="w-8 h-8 text-[var(--cc-accent-dark)]" />
                    </div>
                    <p className="text-sm font-medium text-[var(--cc-text)] mb-1">All caught up!</p>
                    <p className="text-xs text-[var(--cc-text-muted)]">No upcoming events</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2 pr-4">
                      {upcomingEvents.map((event, idx) => {
                        const config = EVENT_CONFIG[event.event_type as keyof typeof EVENT_CONFIG]
                        const IconComponent = config?.icon || Bell
                        const daysUntil = Math.ceil((new Date(event.start_time).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                        
                        return (
                          <motion.div
                            key={event.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            className={`p-3 ${THEMED_EVENT_ROW}`}
                            onClick={() => openEventEditor(event)}
                          >
                            <div className="flex items-start gap-2.5">
                              <div className={THEMED_EVENT_ICON_WRAP}>
                                <IconComponent className={THEMED_EVENT_ICON} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                  <Badge variant="outline" className={THEMED_EVENT_TYPE_BADGE}>
                                    {event.event_type.replace("_", " ")}
                                  </Badge>
                                  {daysUntil === 0 && (
                                    <Badge className="bg-[var(--cc-accent)] text-xs text-white">Today</Badge>
                                  )}
                                  {daysUntil === 1 && (
                                    <Badge className="bg-[var(--cc-accent-dark)] text-xs text-white">Tomorrow</Badge>
                                  )}
                                  {daysUntil > 1 && daysUntil <= 7 && (
                                    <Badge variant="outline" className="text-xs border-[var(--border)] text-[var(--cc-text-muted)]">
                                      In {daysUntil} days
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm font-semibold text-[var(--cc-text)] mb-1">{event.title}</p>
                                <div className="flex items-center gap-3 text-xs text-[var(--cc-text-muted)]">
                                  <span className="flex items-center gap-1">
                                    <CalendarIcon className="w-3 h-3" />
                                    {new Date(event.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      </>
      )}

      <CalendarFeedSettingsCard
        portal="student"
        description="Subscribe so Google, Outlook, or Apple Calendar stay updated when class times change."
        switchClass="data-[state=checked]:bg-[var(--cc-accent)]"
        ctaClass={PORTAL_CTA}
        quietClass={PORTAL_OUTLINE_BTN}
      />

      {/* Class Meeting Detail Dialog */}
      <Dialog
        open={showClassMeetingDialog}
        onOpenChange={(open) => {
          setShowClassMeetingDialog(open)
          if (!open) setViewingClassMeeting(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[var(--cc-accent-dark)]" />
              Class Meeting
            </DialogTitle>
            <DialogDescription>
              From your course syllabus — edit the syllabus to change meeting times.
            </DialogDescription>
          </DialogHeader>
          {viewingClassMeeting && (
            <div className="space-y-4 py-2">
              <div>
                <p className="font-semibold text-lg">{viewingClassMeeting.title}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {new Date(viewingClassMeeting.start_time).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-[var(--cc-accent-dark)]" />
                {new Date(viewingClassMeeting.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {viewingClassMeeting.end_time &&
                  ` – ${new Date(viewingClassMeeting.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
              </div>
              {viewingClassMeeting.location && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-[var(--cc-accent-dark)]" />
                  {viewingClassMeeting.location}
                </div>
              )}
              {classScheduleInfo.schedule && classScheduleInfo.context && (
                <SyllabusAddToCalendarMenu
                  mode="class-schedule"
                  schedule={classScheduleInfo.schedule}
                  context={classScheduleInfo.context}
                  variant="button"
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Enhanced Event Dialog */}
      <Dialog open={showEventDialog} onOpenChange={(open) => {
        setShowEventDialog(open)
        if (!open) resetForm()
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              {editingEvent ? (
                <>
                  <div className="p-2 bg-[var(--cc-accent-soft)] rounded-lg">
                    <Edit className="w-5 h-5 text-[var(--cc-accent-dark)]" />
                  </div>
                  Edit Event
                </>
              ) : (
                <>
                  <div className="p-2 bg-[var(--cc-accent-soft)] rounded-lg">
                    <Plus className="w-5 h-5 text-[var(--cc-accent-dark)]" />
                  </div>
                  Create New Event
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-base">
              {editingEvent ? 'Update your event details below' : 'Add a new event to stay organized'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Event Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Study Session: Pointers"
                className="text-base"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Event Type *</Label>
              <Select
                value={formData.event_type}
                onValueChange={(value) => setFormData({ ...formData, event_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="study_session">📚 Study Session</SelectItem>
                  <SelectItem value="assignment">✍️ Assignment</SelectItem>
                  <SelectItem value="group_study">👥 Group Study</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Start Time *</Label>
                <Input
                  type="datetime-local"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">End Time</Label>
                <Input
                  type="datetime-local"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What will you work on?"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Location</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Library, Online, Room 301..."
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-[var(--muted)] rounded-xl">
              <div>
                <Label className="text-sm font-semibold">All Day Event</Label>
                <p className="text-xs text-[var(--cc-text-muted)] mt-0.5">No specific time required</p>
              </div>
              <Switch
                checked={formData.all_day}
                onCheckedChange={(checked) => setFormData({ ...formData, all_day: checked })}
              />
            </div>

            <div className="flex gap-3 pt-4">
              {editingEvent && (
                <Button 
                  variant="destructive" 
                  onClick={() => {
                      if (editingEvent) deleteEvent(editingEvent.id)
                    setShowEventDialog(false)
                    resetForm()
                  }}
                  size="lg"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              )}
              <Button
                onClick={createEvent}
                className="flex-1 bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] text-white"
                size="lg"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {editingEvent ? 'Update Event' : 'Create Event'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enhanced Goal Dialog */}
      <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <div className="p-2 bg-[var(--cc-accent-soft)] rounded-lg">
                <Target className="w-5 h-5 text-[var(--cc-accent-dark)]" />
              </div>
              Set Study Goal
            </DialogTitle>
            <DialogDescription className="text-base">
              Create a goal to track your progress and stay motivated
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Goal Title *</Label>
              <Input
                value={goalFormData.title}
                onChange={(e) => setGoalFormData({ ...goalFormData, title: e.target.value })}
                placeholder="e.g., Master pointers and references"
                className="text-base"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Description</Label>
              <Textarea
                value={goalFormData.description}
                onChange={(e) => setGoalFormData({ ...goalFormData, description: e.target.value })}
                placeholder="What do you want to achieve?"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Target Date</Label>
                <Input
                  type="date"
                  value={goalFormData.target_date}
                  onChange={(e) => setGoalFormData({ ...goalFormData, target_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Priority</Label>
                <Select
                  value={goalFormData.priority}
                  onValueChange={(value) => setGoalFormData({ ...goalFormData, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">🟢 Low</SelectItem>
                    <SelectItem value="medium">🟡 Medium</SelectItem>
                    <SelectItem value="high">🟠 High</SelectItem>
                    <SelectItem value="urgent">🔴 Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={createGoal}
              className="w-full bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] text-white"
              size="lg"
            >
              <Zap className="w-4 h-4 mr-2" />
              Create Goal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
