"use client"

import { useMemo, useState } from "react"
import { Calendar, Check, ChevronsUpDown, Loader2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { portalListStripe } from "@/lib/portal-module-themes"
import {
  attendedCountLabel,
  filterMeetingsBySection,
  formatMeetingDayLabel,
  formatMeetingRowLabel,
  formatMeetingTimeRange,
  formatMeetingTriggerDayLabel,
  getMeetingStatusBadge,
  groupMeetingsByMonth,
  meetingStatusBadgeClassName,
  type AttendanceMeetingOption,
} from "@/lib/attendance-meeting-options"

export type { AttendanceMeetingOption }

const chrome = facultyEmbedChrome("attendance")

const GROUP_HEADING =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-[var(--cc-text-muted)]"

interface AttendanceMeetingPickerProps {
  meetings: AttendanceMeetingOption[]
  value: string
  onValueChange: (value: string) => void
  filterSection?: string
  allowEmpty?: boolean
  emptyLabel?: string
  disabled?: boolean
  loading?: boolean
  placeholder?: string
  triggerClassName?: string
  popoverClassName?: string
}

export function AttendanceMeetingPicker({
  meetings,
  value,
  onValueChange,
  filterSection,
  allowEmpty = true,
  emptyLabel = "Choose a class meeting…",
  disabled = false,
  loading = false,
  placeholder = "Class meeting…",
  triggerClassName,
  popoverClassName,
}: AttendanceMeetingPickerProps) {
  const [open, setOpen] = useState(false)
  const filtered = useMemo(
    () => filterMeetingsBySection(meetings, filterSection),
    [meetings, filterSection],
  )
  const groups = useMemo(() => groupMeetingsByMonth(filtered), [filtered])
  const selected = filtered.find((m) => String(m.id) === value)
  const hasValue = Boolean(value)

  const triggerPrimary = selected
    ? formatMeetingTriggerDayLabel(selected)
    : loading
      ? "Loading meetings…"
      : placeholder

  const triggerTime = selected ? formatMeetingTimeRange(selected) : null
  const selectedStatus = selected ? getMeetingStatusBadge(selected) : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          className={cn(
            "h-9 w-full min-w-0 justify-start gap-2 px-3 font-normal rounded-lg border-[var(--border)] bg-[var(--card)] shadow-none text-[var(--cc-text)]",
            !hasValue && "!text-[var(--cc-text-secondary)]",
            triggerClassName,
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left">
            <span className="min-w-0 truncate text-sm">
              <span className={cn("font-medium", hasValue ? PORTAL_TEXT : "text-[var(--cc-text-secondary)]")}>{triggerPrimary}</span>
              {triggerTime ? (
                <span className={cn("font-normal", PORTAL_TEXT_MUTED)}> · {triggerTime}</span>
              ) : null}
            </span>
            {selectedStatus ? (
              <Badge
                variant="outline"
                className={cn(
                  "h-5 shrink-0 rounded-md border px-1.5 text-[10px] font-semibold leading-none",
                  meetingStatusBadgeClassName(selectedStatus.variant),
                )}
              >
                {selectedStatus.label}
              </Badge>
            ) : null}
          </span>
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--cc-text-muted)]" />
          ) : (
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-[var(--cc-text-muted)]" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "w-[var(--radix-popover-trigger-width)] p-0 border-[var(--border)] bg-[var(--card)] shadow-lg",
          popoverClassName,
        )}
        align="start"
      >
        <Command className="bg-[var(--card)]">
          <CommandInput
            placeholder="Search by date…"
            className="h-9 text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)]"
          />
          <CommandList className="max-h-[min(50vh,20rem)]">
            <CommandEmpty className={cn("py-6 text-center text-sm", PORTAL_TEXT_MUTED)}>
              No class meeting found.
            </CommandEmpty>

            {allowEmpty ? (
              <CommandGroup heading="Selection" className={GROUP_HEADING}>
                <CommandItem
                  value="clear class meeting selection"
                  onSelect={() => {
                    onValueChange("")
                    setOpen(false)
                  }}
                  className="rounded-none px-3 py-2.5 text-[var(--cc-text)] hover:bg-[var(--cc-accent-soft)]/45"
                >
                  <Check
                    className={cn("h-4 w-4 shrink-0", !hasValue ? "opacity-100" : "opacity-0")}
                  />
                  {emptyLabel}
                </CommandItem>
              </CommandGroup>
            ) : null}

            {groups.map((group) => (
              <CommandGroup key={group.month} heading={group.month} className={GROUP_HEADING}>
                <div className="divide-y divide-[var(--border)]">
                  {group.items.map((meeting, index) => {
                    const attended = attendedCountLabel(meeting)
                    const timeRange = formatMeetingTimeRange(meeting)
                    const isSelected = value === String(meeting.id)
                    const status = getMeetingStatusBadge(meeting)
                    const stripe = portalListStripe(index, chrome.theme.family)
                    return (
                      <CommandItem
                        key={meeting.id}
                        value={`${formatMeetingRowLabel(meeting)} ${meeting.section}`}
                        onSelect={() => {
                          onValueChange(String(meeting.id))
                          setOpen(false)
                        }}
                        className={cn(
                          "rounded-none px-3 py-2.5 aria-selected:bg-muted/40",
                          isSelected && "bg-[var(--cc-accent-soft)]",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-xl",
                            stripe.iconBg,
                          )}
                        >
                          {isSelected ? (
                            <Check className={cn("h-4 w-4", stripe.iconText)} />
                          ) : (
                            <Calendar className={cn("h-4 w-4", stripe.iconText)} />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={cn("truncate text-sm font-semibold", PORTAL_TEXT)}>
                            {formatMeetingDayLabel(meeting)}
                          </p>
                          {timeRange ? (
                            <p className={cn("truncate text-xs", PORTAL_TEXT_MUTED)}>{timeRange}</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5 rounded-md border px-1.5 text-[10px] font-semibold leading-none",
                              meetingStatusBadgeClassName(status.variant),
                            )}
                          >
                            {status.label}
                          </Badge>
                          {attended ? (
                            <span
                              className={cn("inline-flex items-center gap-1 text-[11px]", PORTAL_TEXT_MUTED)}
                              title={`${attended} student${attended === "1" ? "" : "s"} marked`}
                            >
                              <Users className="h-3 w-3" />
                              {attended}
                            </span>
                          ) : null}
                        </div>
                      </CommandItem>
                    )
                  })}
                </div>
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
