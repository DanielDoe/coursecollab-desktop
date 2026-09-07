"use client"

import { useState } from "react"
import { CalendarPlus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { importSyllabusDeadlinesToCalendar } from "@/lib/calendar/import-syllabus-deadlines-client"
import {
  downloadIcsFile,
  googleCalendarUrlForClass,
  googleCalendarUrlForDeadline,
  office365CalendarUrlForClass,
  outlookCalendarUrlForClass,
  outlookCalendarUrlForDeadline,
  type ParsedClassSchedule,
  type SyllabusCalendarContext,
  buildClassScheduleIcs,
  buildDeadlineIcs,
} from "@/lib/syllabus/calendar-export"
import { cn } from "@/lib/utils"

type SyllabusAddToCalendarMenuProps = {
  mode: "class-schedule" | "deadline"
  schedule?: ParsedClassSchedule | null
  deadlineTitle?: string
  deadlineDate?: string
  deadlineDescription?: string
  deadlineKey?: string
  context: SyllabusCalendarContext
  className?: string
  /** "icon" = compact ghost icon (syllabus fields); "button" = full-width labeled button (calendar page). */
  variant?: "icon" | "button"
  studentId?: string
  onCourseCalendarImported?: () => void
}

function openUrl(url: string | null) {
  if (!url) return
  window.open(url, "_blank", "noopener,noreferrer")
}

export function SyllabusAddToCalendarMenu({
  mode,
  schedule,
  deadlineTitle = "",
  deadlineDate = "",
  deadlineDescription = "",
  deadlineKey,
  context,
  className,
  variant = "icon",
  studentId,
  onCourseCalendarImported,
}: SyllabusAddToCalendarMenuProps) {
  const { toast } = useToast()
  const [importing, setImporting] = useState(false)
  const icsContent =
    mode === "class-schedule" && schedule
      ? buildClassScheduleIcs(schedule, context)
      : mode === "deadline"
        ? buildDeadlineIcs(deadlineTitle, deadlineDate, deadlineDescription, context)
        : null

  const googleUrl =
    mode === "class-schedule" && schedule
      ? googleCalendarUrlForClass(schedule, context)
      : googleCalendarUrlForDeadline(deadlineTitle, deadlineDate, deadlineDescription, context)

  const outlookUrl =
    mode === "class-schedule" && schedule
      ? outlookCalendarUrlForClass(schedule, context)
      : outlookCalendarUrlForDeadline(deadlineTitle, deadlineDate, deadlineDescription, context)

  const officeUrl =
    mode === "class-schedule" && schedule ? office365CalendarUrlForClass(schedule, context) : outlookUrl

  if (!icsContent && !googleUrl && !studentId) return null

  const importToCourseCalendar = async (importAll: boolean) => {
    if (!studentId) return
    setImporting(true)
    try {
      const result = await importSyllabusDeadlinesToCalendar({
        studentId,
        importAll,
        deadlines: importAll
          ? undefined
          : [
              {
                title: deadlineTitle,
                dateText: deadlineDate,
                key: deadlineKey,
              },
            ],
      })
      if (!result.success) {
        toast({
          title: "Could not add to calendar",
          description: result.error || "Try again in a moment.",
          variant: "destructive",
        })
        return
      }
      toast({
        title: importAll ? "Syllabus due dates imported" : "Added to CourseCollab calendar",
        description: result.message,
      })
      onCourseCalendarImported?.()
    } finally {
      setImporting(false)
    }
  }

  const filename =
    mode === "class-schedule"
      ? `${context.courseTitle.replace(/[^\w.-]+/g, "-")}-class-schedule.ics`
      : `${context.courseTitle.replace(/[^\w.-]+/g, "-")}-${deadlineTitle.replace(/[^\w.-]+/g, "-")}.ics`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "button" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("w-full rounded-xl font-semibold", className)}
          >
            <CalendarPlus className="h-4 w-4 mr-2" />
            Add to external calendar
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={importing}
            className={cn("h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground", className)}
            aria-label="Add to calendar"
          >
            {importing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CalendarPlus className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">Add to calendar</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {studentId && mode === "deadline" ? (
          <>
            <DropdownMenuItem disabled={importing} onClick={() => void importToCourseCalendar(false)}>
              CourseCollab calendar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {googleUrl ? (
          <DropdownMenuItem onClick={() => openUrl(googleUrl)}>Google Calendar</DropdownMenuItem>
        ) : null}
        {outlookUrl ? (
          <DropdownMenuItem onClick={() => openUrl(outlookUrl)}>Outlook (personal)</DropdownMenuItem>
        ) : null}
        {officeUrl ? (
          <DropdownMenuItem onClick={() => openUrl(officeUrl)}>Outlook (work / school)</DropdownMenuItem>
        ) : null}
        {icsContent ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                if (icsContent) downloadIcsFile(icsContent, filename)
              }}
            >
              Apple Calendar (.ics)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (icsContent) downloadIcsFile(icsContent, filename)
              }}
            >
              Download .ics file
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
