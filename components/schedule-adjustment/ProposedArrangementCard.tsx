import { formatMeetingWindow, formatOriginalSchedules } from "@/lib/schedule-adjustment/arrangement"
import { formatTime12h, DAY_CODE_LABELS, type DayCode } from "@/lib/schedule-adjustment/time-slots"

type RequestLike = {
  original_schedules?: {
    lecture?: { scheduleText?: string }
    laboratory?: { scheduleText?: string }
  } | null
  instructor_led_day?: string | null
  instructor_led_start_time?: string | null
  instructor_led_end_time?: string | null
  structured_session_day?: string | null
  structured_session_start_time?: string | null
  structured_session_end_time?: string | null
  proposed_day?: string | null
  proposed_start_time?: string | null
  proposed_end_time?: string | null
  effective_date?: string | null
  section_code?: string | null
}

function windowFrom(day?: string | null, start?: string | null, end?: string | null) {
  if (!day || !start || !end) return null
  return { day, startTime: String(start), endTime: String(end) }
}

export function ProposedArrangementCard({
  request,
  title = "Proposed Revised Schedule",
}: {
  request: RequestLike
  title?: string
}) {
  const led = windowFrom(request.instructor_led_day, request.instructor_led_start_time, request.instructor_led_end_time)
  const structured = windowFrom(
    request.structured_session_day,
    request.structured_session_start_time,
    request.structured_session_end_time,
  )
  const fallback =
    request.proposed_day && request.proposed_start_time && request.proposed_end_time
      ? `${DAY_CODE_LABELS[request.proposed_day as DayCode] ?? request.proposed_day} ${formatTime12h(String(request.proposed_start_time))} to ${formatTime12h(String(request.proposed_end_time))}`
      : "Not set"

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
      <p className="text-sm font-semibold text-[var(--cc-text)]">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-sky-500/10 p-3 dark:bg-sky-500/15">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
            Current Schedule
          </p>
          <p className="mt-2 whitespace-pre-line text-sm text-[var(--cc-text)]">
            {formatOriginalSchedules(request as never)}
          </p>
        </div>
        <div className="space-y-2">
          <div className="rounded-xl bg-violet-500/10 p-3 dark:bg-violet-500/15">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-300">
              Instructor Led Session
            </p>
            <p className="mt-2 text-sm font-medium text-[var(--cc-text)]">
              {led ? formatMeetingWindow(led) : fallback}
            </p>
          </div>
          <div className="rounded-xl bg-teal-500/10 p-3 dark:bg-teal-500/15">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-300">
              Structured CourseCollab Session
            </p>
            <p className="mt-2 text-sm font-medium text-[var(--cc-text)]">
              {structured ? formatMeetingWindow(structured) : "Not set"}
            </p>
            <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
              This scheduled period remains an active required course session. Instructional activities are
              completed through CourseCollab.
            </p>
          </div>
        </div>
      </div>
      {request.effective_date ? (
        <p className="text-sm text-[var(--cc-text)]">
          <span className="font-medium">Effective date: </span>
          {String(request.effective_date).slice(0, 10)}
        </p>
      ) : null}
    </div>
  )
}
