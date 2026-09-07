"use client"

import { CalendarPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  buildTimedEventIcs,
  formatLongDate,
  googleCalendarUrlForTimedEvent,
  originalScheduleText,
  outlookCalendarUrlForTimedEvent,
  proposedScheduleLabel,
  proposedToClassSchedule,
  resolveEventStartEnd,
} from "@/lib/schedule-adjustment/student-calendar"
import {
  buildClassScheduleIcs,
  downloadIcsFile,
  googleCalendarUrlForClass,
  office365CalendarUrlForClass,
  outlookCalendarUrlForClass,
} from "@/lib/syllabus/calendar-export"
import { PORTAL_CTA } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

type RequestFields = {
  section_code?: string | null
  meeting_type?: string | null
  poll_kind?: string | null
  reason?: string | null
  instructor_notes?: string | null
  original_schedules?: {
    lecture?: { scheduleText?: string }
    laboratory?: { scheduleText?: string }
  } | null
  proposed_day?: string | null
  proposed_date?: string | null
  proposed_start_time?: string | null
  proposed_end_time?: string | null
  effective_date?: string | null
  missed_class_date?: string | null
  location?: string | null
  building?: string | null
  room?: string | null
  finalized_at?: string | Date | null
  status?: string | null
}

function locationText(request: RequestFields) {
  return [request.location, [request.building, request.room].filter(Boolean).join(" ")]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)[0] || "See course syllabus"
}

export function StudentScheduleChangeCard({
  request: raw,
  consentStatus,
}: {
  request: Record<string, unknown>
  consentStatus?: string
}) {
  const request = raw as RequestFields
  const isMakeup = request.poll_kind === "one_off"
  const isDone = request.status === "COMPLETED" || request.status === "FINALIZED"
  const hasProposed = Boolean(request.proposed_day && request.proposed_start_time && request.proposed_end_time)
  const courseTitle = `${request.section_code || "Course"} ${request.meeting_type || "meeting"}`.trim()
  const location = locationText(request)
  const previous = originalScheduleText(request.original_schedules, request.meeting_type ?? undefined)
  const nextLabel = proposedScheduleLabel({
    day: request.proposed_day,
    start: request.proposed_start_time,
    end: request.proposed_end_time,
  })
  const description = [
    request.reason,
    isMakeup && request.missed_class_date ? `Makeup for missed class on ${formatLongDate(request.missed_class_date)}` : "",
    `Previous: ${previous}`,
    `New: ${nextLabel}`,
    request.effective_date ? `Effective ${formatLongDate(request.effective_date)}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  const recurring = !isMakeup ? proposedToClassSchedule({
    day: request.proposed_day,
    start: request.proposed_start_time,
    end: request.proposed_end_time,
  }) : null
  const context = { courseTitle, term: "Current term", location }
  const timed = isMakeup
    ? resolveEventStartEnd({
        day: request.proposed_day,
        date: request.proposed_date,
        start: request.proposed_start_time,
        end: request.proposed_end_time,
        effectiveDate: request.effective_date,
      })
    : null

  const openUrl = (url: string | null) => {
    if (url) window.open(url, "_blank", "noopener,noreferrer")
  }

  const downloadIcs = () => {
    if (recurring) {
      const ics = buildClassScheduleIcs(recurring, context)
      if (ics) downloadIcsFile(ics, `${courseTitle.replace(/\s+/g, "-")}-schedule.ics`)
      return
    }
    if (timed) {
      downloadIcsFile(
        buildTimedEventIcs({
          title: `${courseTitle} makeup`,
          start: timed.start,
          end: timed.end,
          description,
          location,
        }),
        `${courseTitle.replace(/\s+/g, "-")}-makeup.ics`,
      )
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
      <div>
        <p className="text-sm font-semibold text-[var(--cc-text)]">
          {isDone ? "Schedule change is in effect" : hasProposed ? "Proposed schedule change" : "Current class schedule"}
        </p>
        <p className="mt-1 text-sm text-[var(--cc-text-muted)]">
          {isMakeup ? "This is a one-time makeup meeting. The regular weekly time stays the same." : "This updates the regular weekly meeting time."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-sky-500/10 p-3 dark:bg-sky-500/15">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
            {isMakeup ? "Missed class" : "Previous meeting"}
          </p>
          <p className="mt-2 whitespace-pre-line text-sm text-[var(--cc-text)]">
            {isMakeup && request.missed_class_date ? formatLongDate(request.missed_class_date) : previous}
          </p>
        </div>
        <div className="rounded-xl bg-emerald-500/10 p-3 dark:bg-emerald-500/15">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
            {isMakeup ? "Makeup meeting" : "New meeting"}
          </p>
          <p className="mt-2 text-sm font-medium text-[var(--cc-text)]">{nextLabel}</p>
          <p className="mt-1 text-sm text-[var(--cc-text)]">
            Effective: {formatLongDate(request.effective_date ?? request.proposed_date)}
          </p>
          <p className="text-sm text-[var(--cc-text)]">Location: {location}</p>
        </div>
      </div>

      {request.reason ? (
        <p className="text-sm text-[var(--cc-text)]">
          <span className="font-medium">Why: </span>
          {request.reason}
        </p>
      ) : null}
      {request.instructor_notes ? (
        <p className="text-sm text-[var(--cc-text-muted)]">
          <span className="font-medium text-[var(--cc-text)]">Instructor note: </span>
          {request.instructor_notes}
        </p>
      ) : null}
      {consentStatus ? (
        <p className="text-sm text-[var(--cc-text-muted)]">
          Your response: <span className="font-medium capitalize text-[var(--cc-text)]">{consentStatus}</span>
        </p>
      ) : null}
      {isDone && request.finalized_at ? (
        <p className="text-xs text-[var(--cc-text-muted)]">
          Confirmed {formatLongDate(request.finalized_at)}. CourseCollab calendar is already updated.
        </p>
      ) : null}

      {hasProposed ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className={cn(PORTAL_CTA, "w-full !text-white sm:w-auto")}>
              <CalendarPlus className="mr-2 h-4 w-4" />
              Add to calendar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Add this meeting</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                openUrl(
                  recurring
                    ? googleCalendarUrlForClass(recurring, context)
                    : timed
                      ? googleCalendarUrlForTimedEvent({
                          title: `${courseTitle}${isMakeup ? " makeup" : ""}`,
                          start: timed.start,
                          end: timed.end,
                          description,
                          location,
                        })
                      : null,
                )
              }
            >
              Google Calendar
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                openUrl(
                  recurring
                    ? outlookCalendarUrlForClass(recurring, context)
                    : timed
                      ? outlookCalendarUrlForTimedEvent({
                          title: `${courseTitle}${isMakeup ? " makeup" : ""}`,
                          start: timed.start,
                          end: timed.end,
                          description,
                          location,
                        })
                      : null,
                )
              }
            >
              Outlook
            </DropdownMenuItem>
            {recurring ? (
              <DropdownMenuItem onSelect={() => openUrl(office365CalendarUrlForClass(recurring, context))}>
                Office 365
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={downloadIcs}>Download .ics file</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}
