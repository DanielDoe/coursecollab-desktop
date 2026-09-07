"use client"

import type { ReactNode } from "react"
import { SyllabusMarkdown } from "@/components/syllabus/SyllabusMarkdown"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { resolveUniversityBranding, formatSyllabusCourseTitle } from "@/lib/syllabus/university-branding"
import type { SyllabusCourseInfo } from "@/lib/syllabus/syllabus-course-info"
import type { CourseSyllabus } from "@/lib/syllabus/types"
import { questionMediaDisplayUrl } from "@/lib/question-media-proxy"
import { cn } from "@/lib/utils"

type SyllabusUniversityHeaderProps = {
  courseInfo?: SyllabusCourseInfo | null
  syllabus: CourseSyllabus
  showStatusBadge?: ReactNode
  footer?: ReactNode
  className?: string
}

function headerSubtitle(syllabus: CourseSyllabus, courseInfo?: SyllabusCourseInfo | null): string | null {
  const header = syllabus.sections.find((s) => s.sectionId === "course-header")
  const section = header?.content.fields?.Section?.trim()
  const delivery = header?.content.fields?.["Delivery Mode"]?.trim()
  const term = syllabus.term?.trim() || courseInfo?.semester?.trim()

  const parts: string[] = []
  if (section) parts.push(`Section: ${section}`)
  if (delivery) parts.push(delivery)
  if (term && !parts.length) return term
  if (term) parts.push(term)

  return parts.length ? parts.join(" · ") : null
}

function headerDescription(syllabus: CourseSyllabus): string | null {
  const header = syllabus.sections.find((s) => s.sectionId === "course-header")
  const markdown = header?.content.markdown?.trim()
  if (!markdown) return null

  // Schedule blocks belong in Course Overview — never dump raw markdown in the hero.
  const looksLikeSchedule =
    /\*\*Section\s+/i.test(markdown) ||
    /(^|\n)\s*-\s*(Lecture|Laboratory|Office Hours):/i.test(markdown) ||
    (header?.content.tables?.length ?? 0) > 0

  if (looksLikeSchedule) return null

  return markdown
}

function renderCourseTitle(title: string, accentColor: string) {
  const pipeIndex = title.indexOf("|")
  if (pipeIndex === -1) {
    return (
      <span style={{ color: accentColor }} className="font-bold">
        {title}
      </span>
    )
  }
  const code = title.slice(0, pipeIndex).trim()
  const name = title.slice(pipeIndex + 1).trim()
  return (
    <>
      <span style={{ color: accentColor }} className="font-bold">
        {code}
      </span>
      {name ? (
        <span className={cn("font-bold", PORTAL_TEXT)}> | {name}</span>
      ) : null}
    </>
  )
}

export function SyllabusUniversityHeader({
  courseInfo,
  syllabus,
  showStatusBadge,
  footer,
  className,
}: SyllabusUniversityHeaderProps) {
  const branding = resolveUniversityBranding(courseInfo?.university)
  const rawLogoUrl = syllabus.logoUrl?.trim() || branding.logoUrl
  const logoUrl = questionMediaDisplayUrl(rawLogoUrl) || rawLogoUrl
  const courseLine =
    syllabus.title?.trim() ||
    formatSyllabusCourseTitle(courseInfo?.courseCode, courseInfo?.courseTitle)
  const subtitle = headerSubtitle(syllabus, courseInfo)
  const description = headerDescription(syllabus)

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-6 sm:px-8 sm:py-8 text-center",
        className,
      )}
    >
      <div className="mx-auto mb-5 flex max-w-lg justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={`${branding.displayName} logo`}
          className="h-auto w-full max-w-[420px] object-contain"
        />
      </div>

      <h1 className="text-xl sm:text-2xl">{renderCourseTitle(courseLine, branding.primaryColor)}</h1>

      {subtitle ? (
        <p className={cn("mt-2 text-sm font-semibold", PORTAL_TEXT)}>{subtitle}</p>
      ) : syllabus.term ? (
        <p className={cn("mt-2 text-sm", PORTAL_TEXT_MUTED)}>{syllabus.term}</p>
      ) : null}

      {description ? (
        <div className="mx-auto mt-4 max-w-3xl text-left sm:text-center">
          <SyllabusMarkdown
            content={description}
            variant="compact"
            className="[&_p]:text-[var(--cc-text)] [&_li]:text-[var(--cc-text-muted)]"
          />
        </div>
      ) : null}

      {(showStatusBadge || footer) && (
        <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
          {showStatusBadge}
          {footer}
        </div>
      )}
    </div>
  )
}
