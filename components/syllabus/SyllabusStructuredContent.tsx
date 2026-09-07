"use client"

import { Calendar, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SyllabusAddToCalendarMenu } from "@/components/syllabus/SyllabusAddToCalendarMenu"
import { SyllabusCopyButton } from "@/components/syllabus/SyllabusCopyButton"
import { SyllabusMarkdown } from "@/components/syllabus/SyllabusMarkdown"
import { SyllabusRefinedTable } from "@/components/syllabus/SyllabusRefinedTable"
import type { SyllabusTableBlock } from "@/lib/syllabus/types"
import type { SyllabusCalendarContext } from "@/lib/syllabus/calendar-export"
import { highlightMatch, textMatchesQuery } from "@/lib/syllabus/highlight-text"
import {
  extractAbetOutcome,
  parseBulletItems,
  parseCalendarDeadlines,
  parseGradeScaleEntries,
  parseMarkdownBulletsRaw,
  splitMarkdownSubsections,
  stripBulletMarkdown,
} from "@/lib/syllabus/markdown-blocks"
import { cn } from "@/lib/utils"
import { importSyllabusDeadlinesToCalendar } from "@/lib/calendar/import-syllabus-deadlines-client"
import { useSyllabusAccent } from "@/lib/syllabus/syllabus-accent"
import {
  SYLLABUS_TILE,
  SYLLABUS_TILE_COMPACT,
  SYLLABUS_VALUE,
  PORTAL_TEXT_MUTED,
} from "@/lib/syllabus/syllabus-surface-classes"

function SyllabusAcademicCalendar({
  deadlines,
  highlight,
  calendarContext,
  showActions = false,
  studentId,
  onCourseCalendarImported,
}: {
  deadlines: { date: string; label: string }[]
  highlight?: string
  calendarContext?: SyllabusCalendarContext
  showActions?: boolean
  studentId?: string
  onCourseCalendarImported?: () => void
}) {
  const accent = useSyllabusAccent()
  const visible = deadlines.filter(
    (d) => !highlight?.trim() || textMatchesQuery(`${d.date} ${d.label}`, highlight),
  )
  if (!visible.length) return null

  return (
    <div className="space-y-2">
      {visible.map((deadline, index) => (
        <div
          key={index}
          className={cn(SYLLABUS_TILE, "flex gap-4 transition-colors hover:bg-[var(--sidebar-accent)]/25")}
        >
          <div className={cn("flex w-[7.5rem] shrink-0 flex-col items-center justify-center rounded-lg border px-2 py-3 text-center", accent.calloutBorder, accent.calloutBg)}>
            <Calendar className={cn("mb-1.5 h-4 w-4", accent.text)} />
            <span className={cn("text-xs font-bold leading-tight", accent.text)}>
              {highlightMatch(deadline.date, highlight)}
            </span>
          </div>
          <p className={cn("min-w-0 flex-1 self-center text-sm leading-relaxed", SYLLABUS_VALUE)}>
            {highlightMatch(deadline.label, highlight)}
          </p>
          {showActions && calendarContext ? (
            <div className="flex shrink-0 items-center gap-0.5 self-center">
              <SyllabusCopyButton
                value={`${deadline.date} — ${deadline.label}`}
                label="Deadline copied"
              />
              <SyllabusAddToCalendarMenu
                mode="deadline"
                deadlineTitle={deadline.label}
                deadlineDate={deadline.date}
                deadlineDescription={deadline.label}
                deadlineKey={`${deadline.date.toLowerCase()}|${deadline.label.toLowerCase()}`}
                context={calendarContext}
                studentId={studentId}
                onCourseCalendarImported={onCourseCalendarImported}
              />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function SyllabusGradeScale({
  entries,
  highlight,
}: {
  entries: ReturnType<typeof parseGradeScaleEntries>
  highlight?: string
}) {
  const visible = entries.filter(
    (e) => !highlight?.trim() || textMatchesQuery(`${e.range} ${e.letter}`, highlight),
  )
  if (!visible.length) return null

  return (
    <div className={cn(SYLLABUS_TILE, "overflow-x-auto p-0")}>
      <table className="w-full min-w-[320px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]/60 bg-[var(--sidebar-accent)]/30">
            <th className={cn("px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
              Score range
            </th>
            <th className={cn("px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
              Letter grade
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.map((entry, index) => (
            <tr
              key={index}
              className={cn(
                "border-b border-[var(--border)]/40 last:border-b-0",
                index % 2 === 1 && "bg-[var(--sidebar-accent)]/20",
              )}
            >
              <td className={cn("px-4 py-2.5 font-medium tabular-nums", SYLLABUS_VALUE)}>
                {highlightMatch(entry.range, highlight)}
              </td>
              <td className={cn("px-4 py-2.5", SYLLABUS_VALUE)}>
                {highlightMatch(entry.letter, highlight)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SyllabusObjectivesContent({
  markdown,
  highlight,
}: {
  markdown: string
  highlight?: string
}) {
  const accent = useSyllabusAccent()
  const subsections = splitMarkdownSubsections(markdown)

  return (
    <div className="space-y-6">
      {subsections.map((section) => {
        if (highlight?.trim() && !textMatchesQuery(`${section.title} ${section.body}`, highlight)) {
          return null
        }

        const titleLower = section.title.toLowerCase()
        const isTopics = titleLower.includes("topic")
        const isOutcomes = titleLower.includes("outcome")
        const bullets = parseMarkdownBulletsRaw(section.body)
        const proseBody = section.body
          .split("\n")
          .filter((line) => !line.trim().startsWith("- "))
          .join("\n")
          .trim()

        return (
          <section
            key={section.title}
            className={cn(SYLLABUS_TILE, "overflow-hidden p-0")}
          >
            <header className="border-b border-[var(--border)]/60 bg-[var(--sidebar-accent)]/25 px-5 py-3.5">
              <h3 className={cn("flex items-center gap-2 text-base font-bold", accent.text)}>
                <Target className="h-4 w-4 shrink-0" />
                {highlightMatch(section.title, highlight)}
              </h3>
            </header>

            <div className="space-y-4 p-5">
              {proseBody ? (
                <SyllabusMarkdown content={proseBody} highlight={highlight} variant="compact" />
              ) : null}

              {isTopics && bullets.length > 0 ? (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {bullets
                    .filter((b) => !highlight?.trim() || textMatchesQuery(b, highlight))
                    .map((item, index) => (
                      <li
                        key={index}
                        className={cn(SYLLABUS_TILE_COMPACT, "flex gap-3 text-sm leading-relaxed")}
                      >
                        <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold", accent.bgSoft, accent.text)}>
                          {index + 1}
                        </span>
                        <span>{highlightMatch(stripBulletMarkdown(item), highlight)}</span>
                      </li>
                    ))}
                </ul>
              ) : null}

              {isOutcomes && bullets.length > 0 ? (
                <ol className="list-none space-y-5">
                  {bullets
                    .filter((b) => !highlight?.trim() || textMatchesQuery(b, highlight))
                    .map((item, index) => {
                      const { main, abet } = extractAbetOutcome(stripBulletMarkdown(item))
                      return (
                        <li key={index} className="flex gap-3 sm:gap-4">
                          <span className="w-5 shrink-0 pt-0.5 text-sm font-medium tabular-nums text-muted-foreground">
                            {index + 1}.
                          </span>
                          <div className="min-w-0 space-y-1.5">
                            <p className={cn("text-sm leading-[1.7]", SYLLABUS_VALUE)}>
                              {highlightMatch(main, highlight)}
                            </p>
                            {abet ? (
                              <p className={cn("text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
                                {highlightMatch(abet, highlight)}
                              </p>
                            ) : null}
                          </div>
                        </li>
                      )
                    })}
                </ol>
              ) : null}

              {!isTopics && !isOutcomes && bullets.length > 0 ? (
                <ul className="space-y-2.5">
                  {bullets
                    .filter((b) => !highlight?.trim() || textMatchesQuery(b, highlight))
                    .map((item, index) => (
                      <li
                        key={index}
                        className={cn(
                          "flex gap-2.5 text-sm leading-relaxed before:mt-2 before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full",
                          SYLLABUS_VALUE,
                          accent.bulletBefore,
                        )}
                      >
                        {highlightMatch(stripBulletMarkdown(item), highlight)}
                      </li>
                    ))}
                </ul>
              ) : null}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export function SyllabusScheduleContent({
  markdown,
  highlight,
  examTable,
  interactive,
  calendarContext,
  studentId,
  onCourseCalendarImported,
}: {
  markdown: string
  highlight?: string
  examTable?: SyllabusTableBlock | null
  interactive?: boolean
  calendarContext?: SyllabusCalendarContext
  studentId?: string
  onCourseCalendarImported?: () => void
}) {
  const accent = useSyllabusAccent()
  const subsections = splitMarkdownSubsections(markdown)

  return (
    <div className="space-y-6">
      {subsections.map((section) => {
        if (highlight?.trim() && !textMatchesQuery(`${section.title} ${section.body}`, highlight)) {
          if (!(examTable && /exam|homework/i.test(section.title))) return null
        }

        const titleLower = section.title.toLowerCase()
        const isCalendar = titleLower.includes("academic calendar")
        const isExamsSection = /exam|homework/i.test(titleLower)
        const deadlines = isCalendar ? parseCalendarDeadlines(section.body) : []
        const introText = isCalendar
          ? section.body
              .split("\n")
              .filter((line) => !line.trim().startsWith("- "))
              .join("\n")
              .trim()
          : ""

        return (
          <section key={section.title} className="space-y-4">
            <h3 className={cn("border-b border-border/60 pb-2 text-base font-bold", accent.text)}>
              {highlightMatch(section.title, highlight)}
            </h3>

            {isCalendar ? (
              <>
                {introText ? (
                  <SyllabusMarkdown content={introText} highlight={highlight} variant="compact" />
                ) : null}
                {interactive && studentId && deadlines.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() =>
                      void importSyllabusDeadlinesToCalendar({ studentId, importAll: true }).then((result) => {
                        if (result.success) onCourseCalendarImported?.()
                      })
                    }
                  >
                    Import all to CourseCollab calendar
                  </Button>
                ) : null}
                <SyllabusAcademicCalendar
                  deadlines={deadlines}
                  highlight={highlight}
                  calendarContext={calendarContext}
                  showActions={interactive}
                  studentId={studentId}
                  onCourseCalendarImported={onCourseCalendarImported}
                />
              </>
            ) : (
              <>
                <div
                  className={cn(
                    titleLower.includes("honesty") && cn(SYLLABUS_TILE_COMPACT, "bg-[var(--cc-accent-soft)]/40"),
                  )}
                >
                  <SyllabusMarkdown content={section.body} highlight={highlight} />
                </div>
                {isExamsSection && examTable ? (
                  <SyllabusRefinedTable
                    table={examTable}
                    highlight={highlight}
                    interactive={interactive}
                    variant="exam"
                    calendarContext={calendarContext}
                    showActions={interactive}
                    studentId={studentId}
                    onCourseCalendarImported={onCourseCalendarImported}
                  />
                ) : null}
              </>
            )}
          </section>
        )
      })}
    </div>
  )
}

export function SyllabusGradingContent({
  markdown,
  highlight,
}: {
  markdown: string
  highlight?: string
}) {
  const accent = useSyllabusAccent()
  const subsections = splitMarkdownSubsections(markdown)

  return (
    <div className="space-y-6">
      {subsections.map((section) => {
        if (highlight?.trim() && !textMatchesQuery(`${section.title} ${section.body}`, highlight)) {
          return null
        }

        const titleLower = section.title.toLowerCase()
        const gradeEntries = parseGradeScaleEntries(section.body)
        const hasGradeScale =
          gradeEntries.length >= 3 ||
          titleLower.includes("grade") ||
          section.body.includes("90.00")

        const proseOnly = section.body
          .split("\n")
          .filter((line) => {
            if (!line.trim().startsWith("- ")) return true
            return !line.match(/\d+\.\d+|\bbelow\b/i)
          })
          .join("\n")
          .trim()

        return (
          <section key={section.title} className="space-y-4">
            <h3 className={cn("border-b border-border/60 pb-2 text-base font-bold", accent.text)}>
              {highlightMatch(section.title, highlight)}
            </h3>

            {proseOnly ? <SyllabusMarkdown content={proseOnly} highlight={highlight} variant="compact" /> : null}

            {hasGradeScale ? <SyllabusGradeScale entries={gradeEntries} highlight={highlight} /> : null}

            {!hasGradeScale && !proseOnly ? (
              <SyllabusMarkdown content={section.body} highlight={highlight} />
            ) : null}
          </section>
        )
      })}
    </div>
  )
}

/** Fallback: itemize any long bullet-heavy markdown block. */
export function SyllabusItemizedMarkdown({
  markdown,
  highlight,
}: {
  markdown: string
  highlight?: string
}) {
  const bullets = parseBulletItems(markdown)
  const prose = markdown
    .split("\n")
    .filter((line) => !line.trim().startsWith("- "))
    .join("\n")
    .trim()

  if (!bullets.length) {
    return <SyllabusMarkdown content={markdown} highlight={highlight} />
  }

  return (
    <div className="space-y-4">
      {prose ? <SyllabusMarkdown content={prose} highlight={highlight} variant="compact" /> : null}
      <ul className="space-y-3">
        {bullets
          .filter((b) => !highlight?.trim() || textMatchesQuery(b, highlight))
          .map((item, index) => (
            <li
              key={index}
              className={cn(SYLLABUS_TILE_COMPACT, "text-sm leading-relaxed")}
            >
              {highlightMatch(item, highlight)}
            </li>
          ))}
      </ul>
    </div>
  )
}
