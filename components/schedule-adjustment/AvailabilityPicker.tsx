"use client"

import { useRef } from "react"
import { Check, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { formatTime12h, slotKey } from "@/lib/schedule-adjustment/time-slots"
import { formatPollColumnLabel } from "@/lib/schedule-adjustment/poll-scope"
import type { AvailabilitySlotState } from "@/lib/schedule-adjustment/types"

export type SlotHeatmapCell = {
  available: number
  preferred: number
  unavailable?: number
  noMark?: number
}

export type TopMeetingWindow = {
  dayOfWeek: string
  startTime: string
  endTime: string
  availableCount: number
  agreementPercentage: number
  consensusCategory: string
}

type Props = {
  candidateDays: string[]
  timeSlots: string[]
  mode: "binary" | "ternary"
  value: Record<string, AvailabilitySlotState>
  onChange: (next: Record<string, AvailabilitySlotState>) => void
  readOnly?: boolean
  slotHeatmap?: Record<string, SlotHeatmapCell> | null
  totalEnrolled?: number
  topWindows?: TopMeetingWindow[] | null
  meetingDurationMinutes?: number
  showPeerInsights?: boolean
  /** Slots where the instructor already has another class — not selectable. */
  blockedSlotKeys?: string[]
}

type DragSession = {
  day: string
  originTime: string
  paint: AvailabilitySlotState
}

function isOn(state?: AvailabilitySlotState) {
  return state === "available" || state === "preferred"
}

function shortDayLabel(day: string) {
  const label = formatPollColumnLabel(day)
  if (/^\d{4}-/.test(day)) return label
  return label.slice(0, 3)
}

function peerFreeCount(cell?: SlotHeatmapCell | null) {
  if (!cell) return 0
  return (cell.available ?? 0) + (cell.preferred ?? 0)
}

function HeatmapLegend({ totalEnrolled }: { totalEnrolled: number }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2 text-[11px] text-[var(--cc-text-muted)]">
      <span className="font-medium text-[var(--cc-text)]">Peer heatmap</span>
      <span className="inline-flex items-center gap-1">
        <span
          className="size-4 rounded border border-[var(--border)]"
          style={{ backgroundColor: "color-mix(in srgb, var(--cc-accent) 12%, var(--card))" }}
        />
        Few
      </span>
      <span className="inline-flex items-center gap-1">
        <span
          className="size-4 rounded border border-[var(--border)]"
          style={{ backgroundColor: "color-mix(in srgb, var(--cc-accent) 45%, var(--card))" }}
        />
        Many
      </span>
      <span className="inline-flex items-center gap-1">
        <Users className="h-3.5 w-3.5" />
        Numbers show classmates free at that slot (of {totalEnrolled} enrolled)
      </span>
    </div>
  )
}

export function PopularMeetingWindows({
  windows,
  totalEnrolled,
  meetingDurationMinutes,
  compact,
}: {
  windows: TopMeetingWindow[]
  totalEnrolled: number
  meetingDurationMinutes?: number
  compact?: boolean
}) {
  if (!windows.length) return null
  const maxAgreement = Math.max(...windows.map((w) => w.agreementPercentage), 0)

  return (
    <div className={cn("space-y-2 rounded-xl border border-[var(--border)] p-3", compact ? "p-2.5" : "p-3")}>
      <div>
        <p className="text-sm font-semibold text-[var(--cc-text)]">Popular meeting times</p>
        <p className="text-xs text-[var(--cc-text-muted)]">
          Full {meetingDurationMinutes ?? 60}-minute blocks ranked by how many students can attend together.
        </p>
      </div>
      <div className={cn("grid gap-2", compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3")}>
        {windows.slice(0, compact ? 4 : 6).map((w) => {
          const intensity = maxAgreement > 0 ? w.agreementPercentage / maxAgreement : 0
          return (
            <div
              key={`${w.dayOfWeek}-${w.startTime}`}
              className="rounded-lg border border-[var(--border)] p-3 text-left"
              style={{
                backgroundColor: `color-mix(in srgb, var(--cc-accent) ${Math.round(intensity * 32)}%, var(--card))`,
              }}
            >
              <p className="text-sm font-semibold text-[var(--cc-text)]">
                {formatPollColumnLabel(w.dayOfWeek)} {formatTime12h(w.startTime)} – {formatTime12h(w.endTime)}
              </p>
              <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
                {w.availableCount} of {totalEnrolled} available · {w.agreementPercentage}%
              </p>
              <p className="mt-0.5 text-[11px] capitalize text-[var(--cc-text-muted)]">
                {w.consensusCategory.replace(/_/g, " ")}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function AvailabilityPicker({
  candidateDays,
  timeSlots,
  mode,
  value,
  onChange,
  readOnly,
  slotHeatmap,
  totalEnrolled = 0,
  topWindows,
  meetingDurationMinutes,
  showPeerInsights = true,
  blockedSlotKeys = [],
}: Props) {
  const valueRef = useRef(value)
  valueRef.current = value
  const dragRef = useRef<DragSession | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const hasPeerData = showPeerInsights && !!slotHeatmap && totalEnrolled > 0
  const blockedSet = new Set(blockedSlotKeys)

  const isBlocked = (key: string) => blockedSet.has(key)

  const paintRange = (day: string, fromTime: string, toTime: string, paint: AvailabilitySlotState) => {
    if (readOnly) return
    const fromIdx = timeSlots.indexOf(fromTime)
    const toIdx = timeSlots.indexOf(toTime)
    if (fromIdx < 0 || toIdx < 0) return
    const [a, b] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx]
    const next = { ...valueRef.current }
    for (let i = a; i <= b; i++) {
      const key = slotKey(day, timeSlots[i])
      if (isBlocked(key)) continue
      if (paint === "unavailable") delete next[key]
      else next[key] = paint
    }
    valueRef.current = next
    onChange(next)
  }

  const toggleDay = (day: string) => {
    if (readOnly) return
    const selectable = timeSlots.filter((time) => !isBlocked(slotKey(day, time)))
    const allOn = selectable.every((time) => isOn(valueRef.current[slotKey(day, time)]))
    const next = { ...valueRef.current }
    for (const time of selectable) {
      const key = slotKey(day, time)
      if (allOn) delete next[key]
      else next[key] = "available"
    }
    valueRef.current = next
    onChange(next)
  }

  const onCellPointerDown = (day: string, time: string, event: React.PointerEvent<HTMLButtonElement>) => {
    if (readOnly) return
    event.preventDefault()
    gridRef.current?.setPointerCapture(event.pointerId)
    const paint: AvailabilitySlotState = isOn(valueRef.current[slotKey(day, time)]) ? "unavailable" : "available"
    dragRef.current = { day, originTime: time, paint }
    paintRange(day, time, time, paint)
  }

  const onGridPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-sa-slot]")
    if (!(hit instanceof HTMLElement)) return
    const day = hit.dataset.day
    const time = hit.dataset.time
    if (!day || !time || day !== drag.day) return
    paintRange(day, drag.originTime, time, drag.paint)
  }

  const endDrag = () => {
    dragRef.current = null
  }

  const cellClass = (state?: AvailabilitySlotState, peerCount = 0, heatRatio = 0, blocked = false) =>
    cn(
      "relative flex h-9 w-full items-center justify-center rounded-lg border text-[11px] font-medium transition-colors sm:h-10",
      "select-none touch-none",
      blocked &&
        "cursor-not-allowed border-[var(--border)] bg-[var(--muted)]/60 text-[var(--cc-text-muted)] opacity-60",
      !blocked &&
        isOn(state)
        ? "border-[color-mix(in_srgb,var(--cc-success)_45%,var(--border))] bg-[color-mix(in_srgb,var(--cc-success)_22%,var(--card))] text-[var(--cc-success)]"
        : !blocked &&
          "border-[var(--border)] bg-[var(--card)] text-[var(--cc-text-muted)] hover:bg-[var(--muted)]/50",
      !blocked && state === "preferred" && "ring-1 ring-[var(--cc-warning)]",
      !blocked && hasPeerData && !isOn(state) && peerCount > 0 && "border-[color-mix(in_srgb,var(--cc-accent)_35%,var(--border))]",
      !blocked && hasPeerData && heatRatio >= 0.75 && !isOn(state) && "font-semibold text-[var(--cc-text)]",
    )

  const cellStyle = (peerCount: number, heatRatio: number, state?: AvailabilitySlotState) => {
    if (!hasPeerData || isOn(state)) return undefined
    if (peerCount <= 0) return undefined
    return {
      backgroundColor: `color-mix(in srgb, var(--cc-accent) ${Math.round(Math.min(1, heatRatio) * 50 + 8)}%, var(--card))`,
    } as React.CSSProperties
  }

  return (
    <div className="space-y-4">
      {!readOnly ? (
        <p className="text-xs text-[var(--cc-text-muted)] sm:text-sm">
          Tap a day to select every time, or press and drag down a column. Gray cells overlap another lecture or lab you teach this term. Office hours are flexible and do not block options.
        </p>
      ) : null}

      {hasPeerData ? <HeatmapLegend totalEnrolled={totalEnrolled} /> : null}

      {topWindows?.length && totalEnrolled > 0 ? (
        <PopularMeetingWindows
          windows={topWindows}
          totalEnrolled={totalEnrolled}
          meetingDurationMinutes={meetingDurationMinutes}
          compact={!readOnly}
        />
      ) : null}

      <div className="-mx-1 overflow-x-auto overscroll-x-contain pb-1">
        <div
          ref={gridRef}
          className="min-w-[min(100%,36rem)] select-none"
          onPointerMove={onGridPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `4.25rem repeat(${candidateDays.length}, minmax(3.15rem, 1fr))`,
            }}
          >
            <div className="sticky left-0 z-10 bg-[var(--card)] px-1 py-2 text-[11px] font-medium text-[var(--cc-text-muted)]">
              Time
            </div>
            {candidateDays.map((day) => (
              <button
                key={day}
                type="button"
                disabled={readOnly}
                onClick={() => toggleDay(day)}
                className={cn(
                  "rounded-lg px-1 py-2 text-center text-[11px] font-semibold leading-tight sm:text-xs",
                  "text-[var(--cc-text)] hover:bg-[var(--cc-accent-soft)]",
                )}
                title={`Select all ${formatPollColumnLabel(day)} times`}
              >
                <span className="sm:hidden">{shortDayLabel(day)}</span>
                <span className="hidden sm:inline">{formatPollColumnLabel(day)}</span>
              </button>
            ))}

            {timeSlots.map((time) => (
              <div key={time} className="contents">
                <div className="sticky left-0 z-10 flex items-center bg-[var(--card)] px-1 text-[11px] tabular-nums text-[var(--cc-text-muted)]">
                  {formatTime12h(time)}
                </div>
                {candidateDays.map((day) => {
                  const key = slotKey(day, time)
                  const state = value[key]
                  const blocked = isBlocked(key)
                  const peerCell = slotHeatmap?.[key]
                  const peerCount = peerFreeCount(peerCell)
                  const heatRatio = totalEnrolled > 0 ? peerCount / totalEnrolled : 0
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={readOnly || blocked}
                      aria-pressed={isOn(state)}
                      aria-label={`${formatPollColumnLabel(day)} ${formatTime12h(time)} ${blocked ? "blocked by instructor schedule" : isOn(state) ? "available" : "not selected"}${hasPeerData && peerCount ? `, ${peerCount} classmates free` : ""}`}
                      data-sa-slot=""
                      data-day={day}
                      data-time={time}
                      className={cellClass(state, peerCount, heatRatio, blocked)}
                      style={blocked ? undefined : cellStyle(peerCount, heatRatio, state)}
                      onPointerDown={(event) => {
                        if (blocked) return
                        onCellPointerDown(day, time, event)
                      }}
                      onPointerUp={endDrag}
                    >
                      {hasPeerData && peerCount > 0 ? (
                        <span
                          className={cn(
                            "absolute right-0.5 top-0.5 rounded px-1 text-[9px] font-semibold tabular-nums leading-none",
                            isOn(state)
                              ? "bg-[var(--card)]/90 text-[var(--cc-success)]"
                              : "bg-[var(--card)]/95 text-[var(--cc-text)]",
                          )}
                        >
                          {peerCount}
                        </span>
                      ) : null}
                      {isOn(state) ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : null}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--cc-text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="flex size-5 items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--cc-success)_45%,var(--border))] bg-[color-mix(in_srgb,var(--cc-success)_22%,var(--card))] text-[var(--cc-success)]">
            <Check className="h-3 w-3" />
          </span>
          Your availability
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-5 rounded-md border border-[var(--border)] bg-[var(--card)]" />
          Not selected
        </span>
        {hasPeerData ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-5 rounded-md border border-[var(--border)]"
              style={{ backgroundColor: "color-mix(in srgb, var(--cc-accent) 40%, var(--card))" }}
            />
            Classmate picks
          </span>
        ) : null}
      </div>

      {!readOnly ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => onChange({})}>
            Clear
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const next: Record<string, AvailabilitySlotState> = {}
              for (const day of candidateDays) {
                for (const time of timeSlots) next[slotKey(day, time)] = "available"
              }
              onChange(next)
            }}
          >
            Select all
          </Button>
        </div>
      ) : null}
      {mode === "ternary" ? (
        <p className="text-xs text-[var(--cc-text-muted)]">Preferred times show a gold outline.</p>
      ) : null}
    </div>
  )
}

export function AvailabilityHeatmap({
  candidates,
  totalEnrolled,
  onSelect,
}: {
  candidates: Array<{
    id?: number
    day_of_week: string
    start_time: string
    end_time: string
    available_count: number
    agreement_percentage: number
    consensus_category: string
    selected?: boolean
  }>
  totalEnrolled: number
  onSelect?: (candidateId: number) => void
}) {
  const windows: TopMeetingWindow[] = candidates.map((c) => ({
    dayOfWeek: c.day_of_week,
    startTime: c.start_time,
    endTime: c.end_time,
    availableCount: c.available_count,
    agreementPercentage: c.agreement_percentage,
    consensusCategory: c.consensus_category,
  }))

  return (
    <div className="space-y-3">
      <PopularMeetingWindows windows={windows} totalEnrolled={totalEnrolled} />
      {onSelect ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {candidates.slice(0, 12).map((c) => (
            <button
              key={`select-${c.day_of_week}-${c.start_time}`}
              type="button"
              className={cn(
                "rounded-xl border border-[var(--border)] px-4 py-3 text-left text-sm transition hover:ring-2 hover:ring-[var(--cc-accent)]/30",
                c.selected && "ring-2 ring-[var(--cc-accent)]",
              )}
              onClick={() => c.id != null && onSelect(c.id)}
            >
              Select {formatPollColumnLabel(c.day_of_week)} {formatTime12h(c.start_time)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
