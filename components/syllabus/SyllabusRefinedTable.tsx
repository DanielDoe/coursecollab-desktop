"use client"

import type { SyllabusTableBlock } from "@/lib/syllabus/types"
import { SyllabusAddToCalendarMenu } from "@/components/syllabus/SyllabusAddToCalendarMenu"
import { SyllabusCopyButton } from "@/components/syllabus/SyllabusCopyButton"
import { highlightMatch, textMatchesQuery } from "@/lib/syllabus/highlight-text"
import type { SyllabusCalendarContext } from "@/lib/syllabus/calendar-export"
import { cn } from "@/lib/utils"
import { SYLLABUS_TILE, SYLLABUS_VALUE, PORTAL_TEXT_MUTED } from "@/lib/syllabus/syllabus-surface-classes"

type SyllabusRefinedTableProps = {
  table: SyllabusTableBlock
  highlight?: string
  interactive?: boolean
  variant?: "default" | "exam"
  calendarContext?: SyllabusCalendarContext
  showActions?: boolean
  studentId?: string
  onCourseCalendarImported?: () => void
}

function findDateColumnIndex(columns: string[]): number {
  const index = columns.findIndex((col) => /date|day|when/i.test(col))
  return index >= 0 ? index : 1
}

function findTitleColumnIndex(columns: string[]): number {
  const index = columns.findIndex((col) => /assessment|exam|quiz|event|title|name|lecture/i.test(col))
  return index >= 0 ? index : 0
}

export function SyllabusRefinedTable({
  table,
  highlight,
  interactive,
  variant = "default",
  calendarContext,
  showActions = false,
  studentId,
  onCourseCalendarImported,
}: SyllabusRefinedTableProps) {
  if (!table.columns.length) return null

  const needle = highlight?.trim().toLowerCase()
  const isExam = variant === "exam"
  const dateCol = findDateColumnIndex(table.columns)
  const titleCol = findTitleColumnIndex(table.columns)

  return (
    <div className="space-y-2">
      {table.title ? (
        <h4 className={cn("text-sm font-bold", SYLLABUS_VALUE)}>{highlightMatch(table.title, highlight)}</h4>
      ) : null}
      <div className={cn(SYLLABUS_TILE, "overflow-x-auto p-0")}>
        <table className="w-full min-w-[420px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]/60 bg-[var(--sidebar-accent)]/30">
              {table.columns.map((col) => (
                <th
                  key={col}
                  className={cn("px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide", PORTAL_TEXT_MUTED)}
                >
                  {highlightMatch(col, highlight)}
                </th>
              ))}
              {showActions && isExam && calendarContext ? (
                <th className={cn("w-20 px-2 py-2.5 text-right text-xs font-bold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {(table.rows ?? []).map((row, rowIndex) => {
              const rowText = row.join(" ")
              const rowMatch = needle ? rowText.toLowerCase().includes(needle) : true
              if (needle && !rowMatch) return null
              const isFinal = row[0]?.toLowerCase().includes("final")
              const title = row[titleCol] ?? ""
              const dateText = row[dateCol] ?? ""

              return (
                <tr
                  key={rowIndex}
                  className={cn(
                    "border-b border-[var(--border)]/40 transition-colors last:border-b-0",
                    rowIndex % 2 === 1 && "bg-[var(--sidebar-accent)]/20",
                    interactive && "hover:bg-[var(--sidebar-accent)]/35",
                    needle && rowMatch && "bg-[var(--cc-accent-soft)]/50",
                    isFinal && isExam && "bg-[var(--sidebar-accent)]/30 font-medium",
                  )}
                >
                  {table.columns.map((_, colIndex) => (
                    <td key={colIndex} className={cn("px-4 py-3 align-top whitespace-pre-wrap", SYLLABUS_VALUE)}>
                      {highlightMatch(row[colIndex] ?? "", highlight)}
                    </td>
                  ))}
                  {showActions && isExam && calendarContext ? (
                    <td className="px-2 py-3 align-top">
                      <div className="flex items-center justify-end gap-0.5">
                        {dateText ? (
                          <>
                            <SyllabusCopyButton
                              value={`${title} — ${dateText}`.trim()}
                              label="Assessment copied"
                            />
                            <SyllabusAddToCalendarMenu
                              mode="deadline"
                              deadlineTitle={title}
                              deadlineDate={dateText}
                              deadlineDescription={`${calendarContext.courseTitle} — ${title}`}
                              deadlineKey={`${dateText.toLowerCase()}|${title.toLowerCase()}`}
                              context={calendarContext}
                              studentId={studentId}
                              onCourseCalendarImported={onCourseCalendarImported}
                            />
                          </>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function isExamScheduleTable(table: SyllabusTableBlock): boolean {
  return /exam|quiz|assessment/i.test(table.title ?? "")
}
