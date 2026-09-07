"use client"

import { useMemo, useState } from "react"
import {
  BookOpen,
  Building2,
  Calendar,
  ChevronDown,
  Clock,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Shield,
  User,
  ZoomIn,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { SyllabusSection, SyllabusTableBlock } from "@/lib/syllabus/types"
import { SyllabusInstructorProfile } from "@/components/syllabus/SyllabusInstructorProfile"
import { SyllabusRefinedTable, isExamScheduleTable } from "@/components/syllabus/SyllabusRefinedTable"
import { SyllabusMarkdown } from "@/components/syllabus/SyllabusMarkdown"
import {
  SyllabusGradingContent,
  SyllabusObjectivesContent,
  SyllabusScheduleContent,
} from "@/components/syllabus/SyllabusStructuredContent"
import { SyllabusAddToCalendarMenu } from "@/components/syllabus/SyllabusAddToCalendarMenu"
import { SyllabusCopyButton } from "@/components/syllabus/SyllabusCopyButton"
import { parseCourseMeetingSchedule, type SyllabusCalendarContext } from "@/lib/syllabus/calendar-export"
import {
  copyValueForField,
  isCopyableInstructorField,
  isCourseMeetingField,
} from "@/lib/syllabus/field-actions"
import { highlightMatch, textMatchesQuery } from "@/lib/syllabus/highlight-text"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { mediaDisplayUrl } from "@/lib/media/display-url"
import { useSyllabusAccent } from "@/lib/syllabus/syllabus-accent"
import {
  SYLLABUS_LABEL,
  SYLLABUS_PREVIEW_PANEL,
  SYLLABUS_TILE,
  SYLLABUS_TILE_COMPACT,
  SYLLABUS_VALUE,
  SYLLABUS_VALUE_MUTED,
  PORTAL_TEXT_MUTED,
} from "@/lib/syllabus/syllabus-surface-classes"

const FIELD_ICONS: Record<string, LucideIcon> = {
  "instructor name": User,
  department: Building2,
  email: Mail,
  phone: Phone,
  "office hours": Clock,
  "course meeting days / time": Clock,
  "course meeting location": MapPin,
  attendance: GraduationCap,
  "academic integrity": Shield,
  "mental health": Shield,
  accessibility: Shield,
}

function fieldIcon(label: string): LucideIcon {
  const key = label.toLowerCase()
  for (const [pattern, icon] of Object.entries(FIELD_ICONS)) {
    if (key.includes(pattern)) return icon
  }
  return BookOpen
}

function parseWeight(value: string): number | null {
  const match = value.match(/(\d+(?:\.\d+)?)\s*%/)
  return match ? Number.parseFloat(match[1]) : null
}

function SyllabusLectureCards({
  table,
  highlight,
  interactive,
}: {
  table: SyllabusTableBlock
  highlight?: string
  interactive?: boolean
}) {
  const accent = useSyllabusAccent()
  const rows = table.rows ?? []
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  const visibleRows = useMemo(() => {
    if (!highlight?.trim()) return rows.map((row, index) => ({ row, index }))
    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => textMatchesQuery(row.join(" "), highlight))
  }, [rows, highlight])

  if (!visibleRows.length) {
    return highlight?.trim() ? (
      <p className="text-sm text-muted-foreground">No lectures match your search.</p>
    ) : null
  }

  return (
    <div className="space-y-3">
      {visibleRows.map(({ row, index }) => {
        const [lecture = "", date = "", title = "", description = ""] = row
        const isOpen = expanded[index] ?? (Boolean(highlight?.trim()) || !interactive)
        const hasLongDescription = description.length > 120

        return (
          <article
            key={index}
            className={cn(
              SYLLABUS_TILE,
              highlight?.trim() && textMatchesQuery(row.join(" "), highlight) && "ring-[var(--cc-accent-border)]",
            )}
          >
            <div className="flex flex-wrap items-start gap-3">
              <span className={cn("inline-flex shrink-0 items-center rounded-lg px-2.5 py-1 text-xs font-bold", accent.bgSoft, accent.text)}>
                {highlightMatch(lecture, highlight)}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold text-[var(--cc-text)]">{highlightMatch(title, highlight)}</p>
                <p className={cn("inline-flex items-center gap-1.5 text-xs", PORTAL_TEXT_MUTED)}>
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  {highlightMatch(date, highlight)}
                </p>
              </div>
              {interactive && hasLongDescription ? (
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [index]: !isOpen }))}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--sidebar-accent)]/50 px-2.5 py-1 text-xs font-medium text-[var(--cc-text-muted)] hover:bg-[var(--sidebar-accent)]"
                >
                  {isOpen ? "Less" : "More"}
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
                </button>
              ) : null}
            </div>
            {description && (isOpen || !interactive || !hasLongDescription) ? (
              <p
                className={cn(
                  "mt-3 text-sm leading-relaxed",
                  SYLLABUS_VALUE_MUTED,
                  !isOpen && interactive && hasLongDescription && "line-clamp-2",
                )}
              >
                {highlightMatch(description, highlight)}
              </p>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}

function SyllabusGradingTable({
  table,
  highlight,
}: {
  table: SyllabusTableBlock
  highlight?: string
}) {
  const accent = useSyllabusAccent()
  if (!table.columns.length) return null
  const weightCol = table.columns.findIndex((c) => /weight|%/i.test(c))
  const nameCol = 0

  return (
    <div className="space-y-3">
      {(table.rows ?? []).map((row, rowIndex) => {
        const name = row[nameCol] ?? ""
        const weight = weightCol >= 0 ? row[weightCol] ?? "" : ""
        const pct = parseWeight(weight)
        const rowText = row.join(" ")
        if (highlight?.trim() && !textMatchesQuery(rowText, highlight)) return null
        const isTotal = name.toLowerCase().includes("total")

        return (
          <div
            key={rowIndex}
            className={cn(SYLLABUS_TILE, isTotal && accent.totalRow)}
          >
            <div className="flex items-center justify-between gap-3">
              <p className={cn("text-sm font-medium", isTotal ? accent.textStrong : SYLLABUS_VALUE)}>
                {highlightMatch(name, highlight)}
              </p>
              <span className={cn("shrink-0 text-sm font-semibold tabular-nums", SYLLABUS_VALUE)}>
                {highlightMatch(weight, highlight)}
              </span>
            </div>
            {pct != null && !isTotal ? (
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[var(--sidebar-accent)]/60">
                <div
                  className={cn("h-full rounded-full transition-all", accent.progress)}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function SyllabusTable({
  table,
  highlight,
  interactive,
  sectionId,
  calendarContext,
  studentId,
  onCourseCalendarImported,
}: {
  table: SyllabusTableBlock
  highlight?: string
  interactive?: boolean
  sectionId?: string
  calendarContext?: SyllabusCalendarContext
  studentId?: string
  onCourseCalendarImported?: () => void
}) {
  if (!table.columns.length) return null

  if (sectionId === "lecture-topics") {
    return <SyllabusLectureCards table={table} highlight={highlight} interactive={interactive} />
  }
  if (sectionId === "grading") {
    const useRefinedTable =
      table.columns.length >= 4 ||
      table.columns.some((c) => /course grade requirement|requirement/i.test(c))
    if (useRefinedTable) {
      return <SyllabusRefinedTable table={table} highlight={highlight} />
    }
    return <SyllabusGradingTable table={table} highlight={highlight} />
  }

  return (
    <SyllabusRefinedTable
      table={table}
      highlight={highlight}
      interactive={interactive}
      variant={isExamScheduleTable(table) ? "exam" : "default"}
      calendarContext={calendarContext}
      showActions={interactive}
      studentId={studentId}
      onCourseCalendarImported={onCourseCalendarImported}
    />
  )
}

function SyllabusContactFields({
  fields,
  highlight,
  compact,
  calendarContext,
  showActions = false,
}: {
  fields: Record<string, string>
  highlight?: string
  compact?: boolean
  calendarContext?: SyllabusCalendarContext
  showActions?: boolean
}) {
  const accent = useSyllabusAccent()
  const meetingLocation =
    Object.entries(fields).find(([label]) => label.toLowerCase().includes("meeting location"))?.[1] ?? ""

  const entries = Object.entries(fields).filter(([label, value]) => {
    if (!value?.trim()) return false
    if (!highlight?.trim()) return true
    return textMatchesQuery(`${label} ${value}`, highlight)
  })

  if (!entries.length) return null

  return (
    <dl className={cn("grid gap-3", compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}>
      {entries.map(([label, value]) => {
        const Icon = fieldIcon(label)
        const isLong = value.length > 180
        const isMeeting = isCourseMeetingField(label)
        const parsedSchedule = isMeeting ? parseCourseMeetingSchedule(value) : null
        const ctx: SyllabusCalendarContext | undefined = calendarContext
          ? { ...calendarContext, location: meetingLocation || calendarContext.location }
          : undefined

        return (
          <div
            key={label}
            className={cn(SYLLABUS_TILE, isLong ? "sm:col-span-2 lg:col-span-3" : "")}
          >
            <dt className={cn("flex items-center justify-between gap-2", SYLLABUS_LABEL)}>
              <span className="flex min-w-0 items-center gap-2">
                <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", accent.bgIcon)}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                {highlightMatch(label, highlight)}
              </span>
              {showActions ? (
                <span className="flex shrink-0 items-center gap-0.5">
                  {isCopyableInstructorField(label) || label.toLowerCase().includes("location") ? (
                    <SyllabusCopyButton value={copyValueForField(label, value)} label={`${label} copied`} />
                  ) : null}
                  {isMeeting && parsedSchedule && ctx ? (
                    <SyllabusAddToCalendarMenu
                      mode="class-schedule"
                      schedule={parsedSchedule}
                      context={ctx}
                    />
                  ) : null}
                </span>
              ) : null}
            </dt>
            <dd
              className={cn(
                "mt-2",
                SYLLABUS_VALUE,
                isLong ? "whitespace-pre-wrap" : "font-medium",
              )}
            >
              {highlightMatch(value, highlight)}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

function SyllabusPolicyFields({
  fields,
  highlight,
  interactive,
}: {
  fields: Record<string, string>
  highlight?: string
  interactive?: boolean
}) {
  const accent = useSyllabusAccent()
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({})
  const entries = Object.entries(fields).filter(([label, value]) => {
    if (!value?.trim()) return false
    if (!highlight?.trim()) return true
    return textMatchesQuery(`${label} ${value}`, highlight)
  })

  if (!entries.length) {
    return highlight?.trim() ? (
      <p className="text-sm text-muted-foreground">No policies match your search.</p>
    ) : null
  }

  return (
    <div className="space-y-3">
      {entries.map(([label, value]) => {
        const Icon = fieldIcon(label)
        const isLong = value.length > 220
        const forceOpen = Boolean(highlight?.trim())
        const isOpen = forceOpen || !interactive || !isLong || Boolean(openKeys[label])

        return (
          <div
            key={label}
            className={cn(
              SYLLABUS_TILE,
              "overflow-hidden p-0",
              highlight?.trim() && textMatchesQuery(`${label} ${value}`, highlight) && "ring-[var(--cc-accent-border)]",
            )}
          >
            <button
              type="button"
              className={cn(
                "flex w-full items-start gap-3 p-4 text-left",
                interactive && isLong && "cursor-pointer hover:bg-[var(--sidebar-accent)]/30",
              )}
              onClick={
                interactive && isLong && !forceOpen
                  ? () => setOpenKeys((prev) => ({ ...prev, [label]: !prev[label] }))
                  : undefined
              }
              aria-expanded={isOpen}
            >
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", accent.bgIcon)}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm font-semibold", SYLLABUS_VALUE)}>
                  {highlightMatch(label, highlight)}
                </span>
                <span
                  className={cn(
                    "mt-1 block text-sm leading-relaxed",
                    SYLLABUS_VALUE_MUTED,
                    !isOpen && isLong && "line-clamp-3",
                  )}
                >
                  {highlightMatch(value, highlight)}
                </span>
              </span>
              {interactive && isLong && !forceOpen ? (
                <ChevronDown
                  className={cn(
                    "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              ) : null}
            </button>
          </div>
        )
      })}
    </div>
  )
}

function SyllabusTextbookImage({
  imageUrl,
  caption,
  interactive,
}: {
  imageUrl: string
  caption?: string
  interactive?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div
        className={cn(
          SYLLABUS_TILE,
          "flex flex-col gap-4 sm:flex-row sm:items-start",
          interactive && "cursor-pointer transition-colors hover:bg-[var(--sidebar-accent)]/40",
        )}
        onClick={interactive ? () => setOpen(true) : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setOpen(true)
                }
              }
            : undefined
        }
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
      >
        <div className="relative mx-auto w-full max-w-[160px] shrink-0 overflow-hidden rounded-lg bg-[var(--card)] ring-1 ring-[var(--border)]/50 sm:mx-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaDisplayUrl(imageUrl, "small")}
            alt={caption || "Course textbook"}
            className={cn(
              "h-auto w-full object-contain",
              interactive && "transition-transform duration-300 group-hover:scale-[1.03]",
            )}
          />
          {interactive ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/20 group-hover:opacity-100">
              <ZoomIn className="h-8 w-8 text-white drop-shadow" />
            </div>
          ) : null}
        </div>
        <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
          <div className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium", "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]")}>
            <BookOpen className="h-3.5 w-3.5" />
            Required textbook
          </div>
          {caption ? <p className={cn("text-sm font-semibold", SYLLABUS_VALUE)}>{caption}</p> : null}
          {interactive ? (
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Click to view full-size cover</p>
          ) : null}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{caption || "Course textbook"}</DialogTitle>
          </DialogHeader>
          <div className="overflow-hidden rounded-lg border bg-white dark:bg-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaDisplayUrl(imageUrl, "medium")} alt={caption || "Course textbook"} className="h-auto w-full object-contain" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function SyllabusItemsList({ items, highlight }: { items: string[]; highlight?: string }) {
  const accent = useSyllabusAccent()
  const visible = items.filter((item) => !highlight?.trim() || textMatchesQuery(item, highlight))
  if (!visible.length) return null

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {visible.map((item, index) => (
        <li
          key={index}
          className={cn(SYLLABUS_TILE_COMPACT, "flex gap-3 text-sm leading-relaxed")}
        >
          <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", accent.bgSoft, accent.text)}>
            {index + 1}
          </span>
          <span className="min-w-0 whitespace-pre-wrap">{highlightMatch(item, highlight)}</span>
        </li>
      ))}
    </ul>
  )
}

type SyllabusSectionViewProps = {
  section: SyllabusSection
  highlight?: string
  interactive?: boolean
  calendarContext?: SyllabusCalendarContext
  studentId?: string
  onCourseCalendarImported?: () => void
}

export function SyllabusSectionView({
  section,
  highlight,
  interactive,
  calendarContext,
  studentId,
  onCourseCalendarImported,
}: SyllabusSectionViewProps) {
  const { content, sectionId } = section

  const legacyTable: SyllabusTableBlock | null =
    content.columns && content.columns.length > 0
      ? { columns: content.columns, rows: content.rows ?? [] }
      : null

  const isPolicySection =
    sectionId === "course-policies" || sectionId === "university-policies" || section.type === "policy"
  const isContactSection = sectionId === "instructor-info" || sectionId === "general-course-info"

  const examTableFromContent = useMemo(() => {
    const fromTables = content.tables?.find((t) => isExamScheduleTable(t))
    if (fromTables) return fromTables
    if (legacyTable && isExamScheduleTable(legacyTable)) return legacyTable
    return null
  }, [content.tables, legacyTable])

  const nonExamTables = useMemo(() => {
    return (content.tables ?? []).filter((t) => !isExamScheduleTable(t))
  }, [content.tables])

  const usesStructuredMarkdown =
    sectionId === "objectives-outcomes" ||
    sectionId === "schedule-assessments" ||
    sectionId === "grading"

  const markdownBlocks = useMemo(() => {
    if (!content.markdown?.trim() || usesStructuredMarkdown) return []
    if (!highlight?.trim()) return [content.markdown]
    if (textMatchesQuery(content.markdown, highlight)) return [content.markdown]
    const chunks = content.markdown.split(/(?=^#{2,3}\s)/m).filter(Boolean)
    if (chunks.length <= 1) return textMatchesQuery(content.markdown, highlight) ? [content.markdown] : []
    return chunks.filter((chunk) => textMatchesQuery(chunk, highlight))
  }, [content.markdown, highlight, usesStructuredMarkdown])

  return (
    <div className="space-y-6">
      {sectionId === "curriculum-vitae" && content.documentUrl ? (
        <div className={SYLLABUS_TILE_COMPACT}>
          <a
            href={content.documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--cc-accent-dark)] underline-offset-2 hover:underline"
          >
            View Curriculum Vitae (PDF)
            {content.documentFileName ? (
              <span className="font-normal text-[var(--cc-text-muted)]">· {content.documentFileName}</span>
            ) : null}
          </a>
        </div>
      ) : null}

      {content.imageUrl && sectionId === "required-materials" ? (
        <SyllabusTextbookImage
          imageUrl={content.imageUrl}
          caption={content.imageCaption}
          interactive={interactive}
        />
      ) : null}

      {sectionId === "instructor-info" && content.fields ? (
        <SyllabusInstructorProfile
          fields={content.fields}
          imageUrl={content.imageUrl}
          highlight={highlight}
          showActions={interactive}
        />
      ) : content.fields && Object.keys(content.fields).length > 0 ? (
        isPolicySection ? (
          <SyllabusPolicyFields fields={content.fields} highlight={highlight} interactive={interactive} />
        ) : (
          <SyllabusContactFields
            fields={content.fields}
            highlight={highlight}
            compact={isContactSection}
            calendarContext={calendarContext}
            showActions={interactive}
          />
        )
      ) : null}

      {content.items && content.items.length > 0 ? (
        <SyllabusItemsList items={content.items} highlight={highlight} />
      ) : null}

      {sectionId === "objectives-outcomes" && content.markdown ? (
        <SyllabusObjectivesContent markdown={content.markdown} highlight={highlight} />
      ) : null}

      {sectionId === "schedule-assessments" && content.markdown ? (
        <SyllabusScheduleContent
          markdown={content.markdown}
          highlight={highlight}
          examTable={examTableFromContent}
          interactive={interactive}
          calendarContext={calendarContext}
          studentId={studentId}
          onCourseCalendarImported={onCourseCalendarImported}
        />
      ) : null}

      {sectionId === "grading" && content.markdown ? (
        <SyllabusGradingContent markdown={content.markdown} highlight={highlight} />
      ) : null}

      {markdownBlocks.map((block, index) => (
        <SyllabusMarkdown key={index} content={block} highlight={highlight} />
      ))}

      {nonExamTables.map((table, index) => (
        <SyllabusTable
          key={`${table.title ?? "table"}-${index}`}
          table={table}
          highlight={highlight}
          interactive={interactive}
          sectionId={sectionId}
          calendarContext={calendarContext}
          studentId={studentId}
          onCourseCalendarImported={onCourseCalendarImported}
        />
      ))}

      {legacyTable && !isExamScheduleTable(legacyTable) ? (
        <SyllabusTable
          table={legacyTable}
          highlight={highlight}
          interactive={interactive}
          sectionId={sectionId}
          calendarContext={calendarContext}
          studentId={studentId}
          onCourseCalendarImported={onCourseCalendarImported}
        />
      ) : null}
    </div>
  )
}
