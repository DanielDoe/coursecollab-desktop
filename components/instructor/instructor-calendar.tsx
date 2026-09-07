"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  Beaker,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  MapPin,
  Sparkles,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { portalListStripe } from "@/lib/portal-module-themes"
import { cn } from "@/lib/utils"
import { CalendarFeedSettingsCard } from "@/components/calendar/CalendarFeedSettingsCard"
import {
  INSTRUCTOR_CALENDAR_INVALIDATE_EVENT,
  instructorEventCourseLabel,
  type InstructorCalendarAdjustment,
  type InstructorCalendarEvent,
  type InstructorCalendarView,
} from "@/lib/calendar/instructor-calendar-events"

const chrome = facultyEmbedChrome("calendar")
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
const UPCOMING_PAGE_SIZE = 5
const CALENDAR_SCOPE_KEY = "cc.faculty.calendar.scope"

function readStoredCalendarScope(): InstructorCalendarView {
  if (typeof window === "undefined") return "all"
  return window.localStorage.getItem(CALENDAR_SCOPE_KEY) === "selected" ? "selected" : "all"
}

function typeIndex(event: InstructorCalendarEvent) {
  if (event.eventType === "regular_office_hours") return 1
  if (event.eventType === "booked_office_hours") return 2
  if (event.meetingType === "laboratory") return 3
  if (event.meetingType === "structured") return 1
  if (event.meetingType === "instructor_led") return 2
  return 0
}

function EventIcon({ event, className }: { event: InstructorCalendarEvent; className?: string }) {
  if (event.eventType === "regular_office_hours") return <Clock className={className} />
  if (event.eventType === "booked_office_hours") return <Users className={className} />
  if (event.meetingType === "laboratory") return <Beaker className={className} />
  if (event.meetingType === "structured") return <Sparkles className={className} />
  return <GraduationCap className={className} />
}

function cleanTitle(event: InstructorCalendarEvent) {
  if (event.eventType === "regular_office_hours") return "Office hours"
  if (event.eventType === "booked_office_hours") {
    return event.studentName ? event.studentName : "Booked office hours"
  }
  if (event.meetingType === "laboratory") return "Laboratory"
  if (event.meetingType === "structured") return "Structured session"
  if (event.meetingType === "instructor_led") return "Instructor-led"
  return event.title.replace(/\s*\(schedule pending\)\s*/gi, "").replace(/^.*? — /, "") || "Lecture"
}

function shortLabel(event: InstructorCalendarEvent) {
  if (event.eventType === "regular_office_hours") return "Hours"
  if (event.eventType === "booked_office_hours") return "Booked"
  if (event.meetingType === "laboratory") return "Lab"
  if (event.meetingType === "structured") return "Session"
  if (event.meetingType === "instructor_led") return "Led"
  return "Lecture"
}

function kindLabel(event: InstructorCalendarEvent) {
  if (event.eventType === "regular_office_hours") return "Office hours"
  if (event.eventType === "booked_office_hours") return "Booked"
  if (event.meetingType === "laboratory") return "Laboratory"
  if (event.meetingType === "structured") return "Structured"
  if (event.meetingType === "instructor_led") return "Instructor-led"
  return "Lecture"
}

function parseWallClock(iso: string): Date {
  if (/Z$/i.test(iso) || /[+-]\d{2}:\d{2}$/.test(iso)) return new Date(iso)
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match) return new Date(iso)
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]))
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatTime(iso: string) {
  return parseWallClock(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

function formatRange(startIso: string, endIso: string) {
  return `${formatTime(startIso)} – ${formatTime(endIso)}`
}

function startOfWeek(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  next.setDate(next.getDate() - next.getDay())
  return next
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function getDaysInMonth(date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startingDayOfWeek = firstDay.getDay()
  const days: { date: Date; isCurrentMonth: boolean }[] = []

  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month - 1, prevMonthLastDay - i), isCurrentMonth: false })
  }
  for (let day = 1; day <= lastDay.getDate(); day++) {
    days.push({ date: new Date(year, month, day), isCurrentMonth: true })
  }
  const remaining = 42 - days.length
  for (let day = 1; day <= remaining; day++) {
    days.push({ date: new Date(year, month + 1, day), isCurrentMonth: false })
  }
  return days
}

function groupByDate(events: InstructorCalendarEvent[]) {
  const groups: { key: string; date: Date; items: InstructorCalendarEvent[] }[] = []
  for (const event of events) {
    const date = parseWallClock(event.startTime)
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    const existing = groups.find((group) => group.key === key)
    if (existing) existing.items.push(event)
    else groups.push({ key, date, items: [event] })
  }
  return groups
}

export function InstructorCalendar() {
  const { courseScopeVersion } = useInstructorDashboardV2()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<InstructorCalendarEvent[]>([])
  const [scheduleText, setScheduleText] = useState<string | null>(null)
  const [openAdjustments, setOpenAdjustments] = useState<InstructorCalendarAdjustment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [viewing, setViewing] = useState<InstructorCalendarEvent | null>(null)
  const [viewMode, setViewMode] = useState<"month" | "week">("month")
  const [calendarScope, setCalendarScope] = useState<InstructorCalendarView>(() => readStoredCalendarScope())
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [upcomingPage, setUpcomingPage] = useState(1)
  const silentRefreshRef = useRef(false)

  function changeCalendarScope(next: InstructorCalendarView) {
    setCalendarScope(next)
    setUpcomingPage(1)
    try {
      window.localStorage.setItem(CALENDAR_SCOPE_KEY, next)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    const refresh = () => {
      silentRefreshRef.current = true
      setRefreshNonce((value) => value + 1)
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh()
    }
    window.addEventListener("focus", refresh)
    window.addEventListener(INSTRUCTOR_CALENDAR_INVALIDATE_EVENT, refresh)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("focus", refresh)
      window.removeEventListener(INSTRUCTOR_CALENDAR_INVALIDATE_EVENT, refresh)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const silent = silentRefreshRef.current
      silentRefreshRef.current = false
      if (!silent) setLoading(true)
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0)
      try {
        const res = await instructorApiFetch(
          `/api/instructor/calendar?startDate=${encodeURIComponent(startOfMonth.toISOString())}&endDate=${encodeURIComponent(endDate.toISOString())}&scope=${calendarScope}&_=${refreshNonce}`,
        )
        const data = await res.json()
        if (cancelled) return
        if (res.ok && data?.success) {
          setEvents(Array.isArray(data.events) ? data.events : [])
          setScheduleText(typeof data.scheduleText === "string" ? data.scheduleText : null)
          setOpenAdjustments(Array.isArray(data.openAdjustments) ? data.openAdjustments : [])
        } else {
          setEvents([])
          setScheduleText(null)
          setOpenAdjustments([])
        }
      } catch {
        if (!cancelled) {
          setEvents([])
          setScheduleText(null)
          setOpenAdjustments([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [currentDate, courseScopeVersion, refreshNonce, calendarScope])

  const today = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return now
  }, [])
  const calendarDays = useMemo(() => getDaysInMonth(currentDate), [currentDate])
  const monthLabel = currentDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })
  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate])
  const weekDays = useMemo(() => WEEKDAYS.map((_, index) => addDays(weekStart, index)), [weekStart])

  const eventsForDate = (date: Date) =>
    events
      .filter((event) => sameDay(parseWallClock(event.startTime), date))
      .sort((a, b) => a.startTime.localeCompare(b.startTime))

  const agendaEvents = eventsForDate(selectedDate)
  const upcoming = events
    .filter((event) => parseWallClock(event.startTime) > new Date())
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const upcomingPageCount = Math.max(1, Math.ceil(upcoming.length / UPCOMING_PAGE_SIZE))
  const upcomingPageClamped = Math.min(upcomingPage, upcomingPageCount)
  const upcomingSlice = upcoming.slice(
    (upcomingPageClamped - 1) * UPCOMING_PAGE_SIZE,
    upcomingPageClamped * UPCOMING_PAGE_SIZE,
  )
  const upcomingGroups = groupByDate(upcomingSlice)
  const upcomingStart = upcoming.length === 0 ? 0 : (upcomingPageClamped - 1) * UPCOMING_PAGE_SIZE + 1
  const upcomingEnd = Math.min(upcomingPageClamped * UPCOMING_PAGE_SIZE, upcoming.length)
  const primaryAdjustment = openAdjustments[0] ?? null
  const isTodaySelected = sameDay(selectedDate, today)

  useEffect(() => {
    setUpcomingPage((page) => Math.min(page, upcomingPageCount))
  }, [upcomingPageCount])

  function goToday() {
    const now = new Date()
    setCurrentDate(now)
    setSelectedDate(now)
  }

  function shift(direction: -1 | 1) {
    if (viewMode === "week") {
      const next = addDays(selectedDate, direction * 7)
      setSelectedDate(next)
      setCurrentDate(next)
      return
    }
    const next = new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1)
    setCurrentDate(next)
    const keepDay = Math.min(selectedDate.getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate())
    setSelectedDate(new Date(next.getFullYear(), next.getMonth(), keepDay))
  }

  return (
    <div className="space-y-3">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", chrome.p.softBg, chrome.p.iconText)}>
            <CalendarDays className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => shift(-1)} aria-label="Previous">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="min-w-0 truncate text-lg font-semibold tracking-tight text-[var(--cc-text)]">
                {viewMode === "week"
                  ? weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
                    " – " +
                    addDays(weekStart, 6).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                  : monthLabel}
              </h2>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => shift(1)} aria-label="Next">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {calendarScope === "selected" && scheduleText ? (
              <p className="truncate pl-1 text-xs text-[var(--cc-text-muted)]">{scheduleText}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className={chrome.viewOrganizer.container}>
            <Button
              type="button"
              variant="ghost"
              className={cn("h-8 px-3 text-xs", calendarScope === "all" ? cn(chrome.solid, "!text-white") : chrome.quiet)}
              onClick={() => changeCalendarScope("all")}
            >
              All courses
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={cn("h-8 px-3 text-xs", calendarScope === "selected" ? cn(chrome.solid, "!text-white") : chrome.quiet)}
              onClick={() => changeCalendarScope("selected")}
            >
              This course
            </Button>
          </div>
          <Button type="button" className={cn(chrome.quiet, "h-9 px-3")} onClick={goToday}>
            Today
          </Button>
          <div className={chrome.viewOrganizer.container}>
            <Button
              type="button"
              variant="ghost"
              className={cn("h-8 px-3 text-xs", viewMode === "month" ? cn(chrome.solid, "!text-white") : chrome.quiet)}
              onClick={() => setViewMode("month")}
            >
              Month
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={cn("h-8 px-3 text-xs", viewMode === "week" ? cn(chrome.solid, "!text-white") : chrome.quiet)}
              onClick={() => setViewMode("week")}
            >
              Week
            </Button>
          </div>
        </div>
      </div>

      {primaryAdjustment ? (
        <div className={cn("flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between", chrome.p.softBg, "rounded-xl")}>
          <p className="text-sm text-[var(--cc-text)]">
            Schedule adjustment is open
            {primaryAdjustment.sessionCode || primaryAdjustment.courseCode
              ? ` · ${primaryAdjustment.sessionCode || primaryAdjustment.courseCode}`
              : ""}
            {primaryAdjustment.reason ? (
              <span className="text-[var(--cc-text-muted)]"> — {primaryAdjustment.reason}</span>
            ) : null}
          </p>
          <Button asChild className={cn(chrome.solid, "h-9 shrink-0 !text-white")}>
            <Link href={`/faculty/dashboard/administration/schedule-adjustment?id=${primaryAdjustment.id}`}>
              Adjust schedule
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)] xl:items-start">
        <section className={cn(chrome.card, "overflow-hidden")}>
          {loading ? (
            <div className="grid grid-cols-7">
              {Array.from({ length: 42 }).map((_, index) => (
                <Skeleton key={index} className="h-20 rounded-none border-b border-r border-[var(--border)]" />
              ))}
            </div>
          ) : viewMode === "week" ? (
            <WeekBoard
              weekDays={weekDays}
              today={today}
              selectedDate={selectedDate}
              eventsForDate={eventsForDate}
              onSelectDate={setSelectedDate}
              onOpen={setViewing}
            />
          ) : (
            <MonthBoard
              days={calendarDays}
              today={today}
              selectedDate={selectedDate}
              eventsForDate={eventsForDate}
              onSelectDate={setSelectedDate}
              onOpen={setViewing}
            />
          )}
        </section>

        <section className={cn(chrome.card, "flex min-h-[360px] flex-col overflow-hidden")}>
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
              {isTodaySelected ? "Today" : selectedDate.toLocaleDateString(undefined, { weekday: "long" })}
            </p>
            <h3 className="text-sm font-semibold text-[var(--cc-text)]">
              {selectedDate.toLocaleDateString(undefined, { month: "long", day: "numeric" })}
            </h3>
          </div>
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="space-y-0 divide-y divide-[var(--border)]">
                <Skeleton className="h-16 rounded-none" />
                <Skeleton className="h-16 rounded-none" />
                <Skeleton className="h-16 rounded-none" />
              </div>
            ) : agendaEvents.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <span className={cn("flex size-10 items-center justify-center rounded-xl", chrome.p.softBg, chrome.p.iconText)}>
                  <CalendarDays className="h-4 w-4" />
                </span>
                <p className="text-sm text-[var(--cc-text-muted)]">No meetings this day.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {agendaEvents.map((event, index) => (
                  <AgendaRow key={event.id} event={event} index={index} onOpen={setViewing} />
                ))}
              </div>
            )}
            {isTodaySelected && upcoming.length > 0 ? (
              <div className="border-t border-[var(--border)]">
                <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
                    Coming up
                  </p>
                  <p className="text-[11px] tabular-nums text-[var(--cc-text-muted)]">
                    {upcomingStart}–{upcomingEnd} of {upcoming.length}
                  </p>
                </div>
                {upcomingGroups.map((group) => (
                  <div key={group.key}>
                    <p className="px-4 pt-2 text-xs font-medium text-[var(--cc-text-muted)]">
                      {group.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                    <div className="divide-y divide-[var(--border)]">
                      {group.items.map((event, index) => (
                        <AgendaRow key={event.id} event={event} index={index} compact onOpen={setViewing} />
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-4 py-2.5">
                  <Button
                    type="button"
                    className={cn(chrome.quiet, "h-8 gap-1 px-2.5")}
                    disabled={upcomingPageClamped <= 1}
                    onClick={() => setUpcomingPage((page) => Math.max(1, page - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <p className="text-xs tabular-nums text-[var(--cc-text-muted)]">
                    {upcomingPageClamped} / {upcomingPageCount}
                  </p>
                  <Button
                    type="button"
                    className={cn(chrome.quiet, "h-8 gap-1 px-2.5")}
                    disabled={upcomingPageClamped >= upcomingPageCount}
                    onClick={() => setUpcomingPage((page) => Math.min(upcomingPageCount, page + 1))}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </ScrollArea>
        </section>
      </div>

      <CalendarFeedSettingsCard
        portal="faculty"
        description="Applies to every section you teach. Configure reminders and subscribe here — they stay after a schedule change is finalized. The same settings live under Course Settings."
        switchClass={chrome.switchChecked}
        ctaClass={cn(chrome.cta, "!text-white")}
        quietClass={chrome.outline}
      />

      <EventDialog event={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}

function MonthBoard({
  days,
  today,
  selectedDate,
  eventsForDate,
  onSelectDate,
  onOpen,
}: {
  days: { date: Date; isCurrentMonth: boolean }[]
  today: Date
  selectedDate: Date
  eventsForDate: (date: Date) => InstructorCalendarEvent[]
  onSelectDate: (date: Date) => void
  onOpen: (event: InstructorCalendarEvent) => void
}) {
  return (
    <>
      <div className="grid grid-cols-7 border-b border-[var(--border)]">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]"
          >
            <span className="sm:hidden">{day.slice(0, 1)}</span>
            <span className="hidden sm:inline">{day}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dayEvents = eventsForDate(day.date)
          const isTodayDate = sameDay(day.date, today)
          const isSelected = sameDay(day.date, selectedDate)
          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelectDate(day.date)}
              className={cn(
                "min-h-[3.75rem] border-b border-r border-[var(--border)] p-1 text-left transition-colors sm:min-h-[5.25rem] sm:p-1.5",
                "hover:bg-muted/40 [&:nth-child(7n)]:border-r-0",
                !day.isCurrentMonth && "bg-[var(--muted)]/25",
                isSelected && "bg-[var(--cc-accent-soft)]",
              )}
            >
              <div className="mb-1 flex items-center justify-end">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums sm:size-7 sm:text-sm",
                    isTodayDate && "bg-[var(--cc-accent)] !text-white",
                    !isTodayDate && day.isCurrentMonth && "text-[var(--cc-text)]",
                    !isTodayDate && !day.isCurrentMonth && "text-[var(--cc-text-muted)]",
                  )}
                >
                  {day.date.getDate()}
                </span>
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((event) => {
                  const stripe = portalListStripe(typeIndex(event), chrome.theme.family)
                  return (
                    <span
                      key={event.id}
                      role="presentation"
                      onClick={(click) => {
                        click.stopPropagation()
                        onOpen(event)
                      }}
                      className={cn(
                        "flex min-w-0 items-center gap-1 truncate rounded-md px-1 py-0.5 text-[10px] font-medium leading-tight sm:text-[11px]",
                        stripe.iconBg,
                        stripe.iconText,
                      )}
                    >
                      <span className="hidden tabular-nums sm:inline">{formatTime(event.startTime)}</span>
                      <span className="truncate">{shortLabel(event)}</span>
                    </span>
                  )
                })}
                {dayEvents.length > 3 ? (
                  <span className="block px-1 text-[10px] text-[var(--cc-text-muted)]">+{dayEvents.length - 3}</span>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
}

function WeekBoard({
  weekDays,
  today,
  selectedDate,
  eventsForDate,
  onSelectDate,
  onOpen,
}: {
  weekDays: Date[]
  today: Date
  selectedDate: Date
  eventsForDate: (date: Date) => InstructorCalendarEvent[]
  onSelectDate: (date: Date) => void
  onOpen: (event: InstructorCalendarEvent) => void
}) {
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[52rem] grid-cols-7">
      {weekDays.map((date, index) => {
        const dayEvents = eventsForDate(date)
        const isTodayDate = sameDay(date, today)
        const isSelected = sameDay(date, selectedDate)
        return (
          <div
            key={index}
            className={cn(
              "min-h-[22rem] border-b border-r border-[var(--border)] [&:nth-child(7n)]:border-r-0",
              isSelected && "bg-[var(--cc-accent-soft)]/40",
            )}
          >
            <button
              type="button"
              onClick={() => onSelectDate(date)}
              className="flex w-full flex-col items-center gap-0.5 border-b border-[var(--border)] px-1 py-2 hover:bg-muted/40"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
                {WEEKDAYS[date.getDay()]}
              </span>
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                  isTodayDate && "bg-[var(--cc-accent)] !text-white",
                  !isTodayDate && "text-[var(--cc-text)]",
                )}
              >
                {date.getDate()}
              </span>
            </button>
            <div className="space-y-1 p-1.5">
              {dayEvents.map((event) => {
                const stripe = portalListStripe(typeIndex(event), chrome.theme.family)
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onOpen(event)}
                    className={cn("w-full rounded-lg px-1.5 py-1.5 text-left", stripe.iconBg)}
                  >
                    <p className={cn("text-[10px] font-semibold tabular-nums", stripe.iconText)}>
                      {formatTime(event.startTime)}
                    </p>
                    <p className={cn("truncate text-xs font-medium", stripe.iconText)}>{shortLabel(event)}</p>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}

function AgendaRow({
  event,
  index,
  compact = false,
  onOpen,
}: {
  event: InstructorCalendarEvent
  index: number
  compact?: boolean
  onOpen: (event: InstructorCalendarEvent) => void
}) {
  const stripe = portalListStripe(typeIndex(event), chrome.theme.family)
  return (
    <button
      type="button"
      onClick={() => onOpen(event)}
      className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-muted/40"
    >
      <span className="w-16 shrink-0 pt-0.5 text-xs font-semibold tabular-nums text-[var(--cc-text)]">
        {formatTime(event.startTime)}
      </span>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", stripe.iconBg, stripe.iconText)}>
        <EventIcon event={event} className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-[var(--cc-text)]">{cleanTitle(event)}</span>
          {event.pendingScheduleChange ? (
            <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", chrome.p.softBg, chrome.p.iconText)}>
              Pending
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-xs text-[var(--cc-text-muted)]">
          {instructorEventCourseLabel(event) ? `${instructorEventCourseLabel(event)} · ` : ""}
          {kindLabel(event)}
          {" · "}
          {formatRange(event.startTime, event.endTime)}
          {!compact && event.location ? ` · ${event.location}` : ""}
        </span>
      </span>
    </button>
  )
}

function EventDialog({
  event,
  onClose,
}: {
  event: InstructorCalendarEvent | null
  onClose: () => void
}) {
  return (
    <Dialog open={Boolean(event)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{event ? cleanTitle(event) : "Event"}</DialogTitle>
          <DialogDescription>
            {event
              ? [instructorEventCourseLabel(event), kindLabel(event)].filter(Boolean).join(" · ")
              : "Calendar event"}
          </DialogDescription>
        </DialogHeader>
        {event ? (
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-2 text-[var(--cc-text)]">
              <Clock className="h-4 w-4 text-[var(--cc-text-muted)]" />
              {parseWallClock(event.startTime).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
              {" · "}
              {formatRange(event.startTime, event.endTime)}
            </p>
            {event.location ? (
              <p className="flex items-center gap-2 text-[var(--cc-text)]">
                <MapPin className="h-4 w-4 text-[var(--cc-text-muted)]" />
                {event.location}
              </p>
            ) : null}
            {event.studentName ? <p className="text-[var(--cc-text)]">Student: {event.studentName}</p> : null}
            {event.topic && event.eventType === "booked_office_hours" ? (
              <p className="text-[var(--cc-text-muted)]">{event.topic}</p>
            ) : null}
            {event.pendingScheduleChange ? (
              <p className={cn("rounded-lg px-3 py-2 text-xs", chrome.p.softBg, chrome.p.iconText)}>
                A schedule adjustment is in progress. This meeting time may change.
              </p>
            ) : null}
            {event.href ? (
              <Button asChild className={cn(chrome.solid, "!text-white")}>
                <Link href={event.href}>
                  {event.eventType === "class_meeting" ? "Open schedule adjustment" : "Open office hours"}
                </Link>
              </Button>
            ) : null}
            {event.eventType === "class_meeting" ? (
              <Button asChild variant="outline" className={cn(chrome.outline, "w-full")}>
                <Link href="/faculty/dashboard/administration/course-settings">Calendar alerts</Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
