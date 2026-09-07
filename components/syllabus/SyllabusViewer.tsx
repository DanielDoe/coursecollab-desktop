"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  GraduationCap,
  MapPin,
  Percent,
  Search,
  Shield,
  Target,
  User,
  Building2,
  X,
} from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SyllabusSectionView } from "@/components/syllabus/SyllabusSectionView"
import { SyllabusPdfViewer } from "@/components/syllabus/SyllabusPdfViewer"
import { SyllabusUniversityHeader } from "@/components/syllabus/SyllabusUniversityHeader"
import { SyllabusViewTracker } from "@/components/syllabus/SyllabusViewTracker"
import { filterSectionsByQuery } from "@/lib/syllabus/section-search"
import { getStudentVisibleSections } from "@/lib/syllabus/syllabus-section-merge"
import type { SyllabusCourseInfo } from "@/lib/syllabus/syllabus-course-info"
import type { CourseSyllabus, SyllabusSection } from "@/lib/syllabus/types"
import { SyllabusAccentProvider, useSyllabusAccent } from "@/lib/syllabus/syllabus-accent"
import { PORTAL_OUTLINE_BTN } from "@/lib/appearance/portal-nav-classes"
import { SYLLABUS_TILE } from "@/lib/syllabus/syllabus-surface-classes"
import { cn } from "@/lib/utils"

type SyllabusViewerProps = {
  syllabus: CourseSyllabus
  courseInfo?: SyllabusCourseInfo | null
  showStatusBadge?: boolean
  studentId?: string
  interactive?: boolean
}

const SECTION_ICONS: Record<string, typeof BookOpen> = {
  "instructor-info": User,
  "general-course-info": MapPin,
  "objectives-outcomes": Target,
  "required-materials": BookOpen,
  "schedule-assessments": CalendarDays,
  "exam-quiz-schedule": ClipboardList,
  "lecture-topics": GraduationCap,
  grading: Percent,
  "course-policies": Shield,
  "university-policies": Building2,
}

function sectionBadge(section: SyllabusSection): string | null {
  const rows = section.content.rows?.length ?? 0
  const tableRows =
    section.content.tables?.reduce((sum, t) => sum + (t.rows?.length ?? 0), 0) ?? 0
  if (section.sectionId === "schedule-assessments" && tableRows) return `${tableRows} assessments`
  if (section.sectionId === "lecture-topics" && rows) return `${rows} lectures`
  if (section.sectionId === "grading" && rows) return `${rows} categories`
  return null
}

function SyllabusViewerBody({
  syllabus,
  courseInfo,
  showStatusBadge = false,
  studentId,
  interactive = false,
}: SyllabusViewerProps) {
  const accent = useSyllabusAccent()
  const [searchQuery, setSearchQuery] = useState("")
  const [openSections, setOpenSections] = useState<string[]>([])
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  const visibleSections = useMemo(
    () => getStudentVisibleSections(syllabus.sections),
    [syllabus.sections],
  )
  const hasPdf = Boolean(syllabus.pdfUrl)
  const isPdfMode =
    (syllabus.contentMode === "pdf" && hasPdf) ||
    (visibleSections.length === 0 && hasPdf)

  const filteredSections = useMemo(
    () => filterSectionsByQuery(visibleSections, searchQuery),
    [visibleSections, searchQuery],
  )

  useEffect(() => {
    if (isPdfMode) return
    if (searchQuery.trim()) {
      setOpenSections(filteredSections.map((s) => s.sectionId))
      return
    }
    setOpenSections(visibleSections.map((s) => s.sectionId))
  }, [visibleSections, filteredSections, searchQuery, isPdfMode])

  useEffect(() => {
    if (!interactive || isPdfMode) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]?.target.id) {
          setActiveSection(visible[0].target.id.replace("syllabus-section-", ""))
        }
      },
      { root: null, rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.25, 0.5] },
    )
    filteredSections.forEach((s) => {
      const el = sectionRefs.current[s.sectionId]
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [filteredSections, interactive, isPdfMode])

  const scrollToSection = useCallback((sectionId: string) => {
    setOpenSections((prev) => (prev.includes(sectionId) ? prev : [...prev, sectionId]))
    requestAnimationFrame(() => {
      const el = sectionRefs.current[sectionId]
      if (!el) return
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [])

  const expandAll = () => setOpenSections(filteredSections.map((s) => s.sectionId))
  const collapseAll = () => setOpenSections([])

  const lastUpdated = new Date(syllabus.updatedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const calendarContext = useMemo(
    () => ({
      courseTitle: syllabus.title,
      term: syllabus.term,
    }),
    [syllabus.title, syllabus.term],
  )

  if (isPdfMode) {
    return (
      <SyllabusPdfViewer
        syllabus={syllabus}
        showStatusBadge={showStatusBadge}
        studentId={studentId}
      />
    )
  }

  const universityHeader = (
    <SyllabusUniversityHeader
      courseInfo={courseInfo}
      syllabus={syllabus}
      showStatusBadge={
        showStatusBadge ? (
          <Badge
            variant="secondary"
            className={
                syllabus.status === "published"
                ? "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
            }
          >
            {syllabus.status === "published" ? "Published" : "Draft"}
          </Badge>
        ) : undefined
      }
      footer={
        <p className="flex items-center gap-2 text-xs text-[var(--cc-text-muted)]">
          <CalendarDays className="h-3.5 w-3.5" />
          Last updated {lastUpdated}
        </p>
      }
    />
  )

  const syllabusToolbar = (
    <div
      id="syllabus-toolbar"
      className="sticky top-0 z-20 shrink-0 space-y-3.5 border-b border-[var(--border)] bg-[var(--card)] px-4 py-4 shadow-[0_1px_0_color-mix(in_srgb,var(--cc-text)_6%,transparent)] sm:px-5 sm:py-4"
    >
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search syllabus…"
            className="h-10 rounded-full border-0 bg-[var(--muted)] pl-9 pr-9 shadow-none focus-visible:ring-1 focus-visible:ring-[var(--cc-accent)]/30"
          />
          {searchQuery ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--cc-text-muted)] hover:bg-[var(--card)]"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" variant="ghost" size="sm" onClick={expandAll} className={cn("h-9 rounded-full", PORTAL_OUTLINE_BTN)}>
            <ChevronDown className="mr-1 h-4 w-4" />
            Expand all
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={collapseAll} className={cn("h-9 rounded-full", PORTAL_OUTLINE_BTN)}>
            <ChevronUp className="mr-1 h-4 w-4" />
            Collapse all
          </Button>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visibleSections.map((section) => {
          const Icon = SECTION_ICONS[section.sectionId] ?? BookOpen
          const badge = sectionBadge(section)
          const isActive = activeSection === section.sectionId
          const matchesSearch =
            !searchQuery.trim() ||
            filteredSections.some((s) => s.sectionId === section.sectionId)
          return (
            <button
              key={section.sectionId}
              type="button"
              onClick={() => scrollToSection(section.sectionId)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? accent.pillActive
                  : "bg-[var(--muted)] text-[var(--cc-text)] hover:bg-[var(--cc-accent-soft)]",
                !matchesSearch && searchQuery && "opacity-40",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="max-w-[140px] truncate sm:max-w-none">{section.title}</span>
              {badge ? (
                <span className="rounded-full bg-[var(--card)] px-1.5 py-0.5 text-[10px] text-[var(--cc-text-muted)]">
                  {badge}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {searchQuery ? (
        <p className="text-xs text-[var(--cc-text-muted)]">
          Showing {filteredSections.length} of {visibleSections.length} sections matching &ldquo;{searchQuery}&rdquo;
        </p>
      ) : null}
      <p className="text-xs text-[var(--cc-accent-dark)]">
        First syllabus review earns 1.5 engagement credits (one time only).
      </p>
    </div>
  )

  const sectionsBody =
    filteredSections.length === 0 ? (
      <p className="py-12 text-center text-muted-foreground">
        {searchQuery ? "No sections match your search." : "No syllabus sections are visible yet."}
      </p>
    ) : (
      <div className={cn(interactive && "relative z-0 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6")}>
        {interactive ? (
          <aside className="hidden lg:block">
            <nav
              aria-label="Syllabus sections"
              className="sticky top-28 z-10 self-start rounded-xl bg-[var(--muted)]/50"
            >
              <p className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
                On this page
              </p>
              <ul className="space-y-0.5 p-2 pt-0">
                {visibleSections.map((section) => {
                  const isActive = activeSection === section.sectionId
                  const matchesSearch =
                    !searchQuery.trim() ||
                    filteredSections.some((s) => s.sectionId === section.sectionId)
                  if (!matchesSearch) return null
                  const badge = sectionBadge(section)
                  return (
                    <li key={section.sectionId}>
                      <button
                        type="button"
                        onClick={() => scrollToSection(section.sectionId)}
                        className={cn(
                          "w-full rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                          isActive
                            ? accent.navActive
                            : "text-[var(--cc-text-muted)] hover:bg-[var(--card)] hover:text-[var(--cc-text)]",
                        )}
                      >
                        <span className="line-clamp-2">{section.title}</span>
                        {badge ? (
                          <span className="mt-0.5 block text-[10px] font-normal text-[var(--cc-text-muted)]">
                            {badge}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </aside>
        ) : null}

        <Accordion
          type="multiple"
          value={interactive ? openSections : undefined}
          defaultValue={interactive ? undefined : visibleSections.map((s) => s.sectionId)}
          onValueChange={interactive ? setOpenSections : undefined}
          className={cn(
            "relative z-0 min-w-0 flex-1",
            interactive ? "divide-y divide-[var(--border)]" : "space-y-3",
          )}
        >
          {filteredSections.map((section) => {
            const Icon = SECTION_ICONS[section.sectionId] ?? BookOpen
            const badge = sectionBadge(section)
            return (
              <div
                key={section.sectionId}
                id={`syllabus-section-${section.sectionId}`}
                ref={(el) => {
                  sectionRefs.current[section.sectionId] = el
                }}
                className="scroll-mt-28"
              >
                <AccordionItem
                  value={section.sectionId}
                  className={cn(
                    "relative z-0 border-0 px-1",
                    interactive ? "bg-transparent shadow-none" : cn(SYLLABUS_TILE, "px-4"),
                  )}
                >
                  <AccordionTrigger className="py-4 text-left hover:no-underline">
                    <span className="flex min-w-0 items-center gap-3">
                      {interactive ? (
                        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", accent.bgIcon)}>
                          <Icon className="h-4 w-4" />
                        </span>
                      ) : null}
                      <span className="min-w-0">
                        <span className={cn("block font-semibold", accent.text)}>
                          {section.title}
                        </span>
                        {badge ? (
                          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{badge}</span>
                        ) : null}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-5">
                    <SyllabusSectionView
                      section={section}
                      highlight={searchQuery}
                      interactive={interactive}
                      calendarContext={calendarContext}
                      studentId={studentId}
                    />
                  </AccordionContent>
                </AccordionItem>
              </div>
            )
          })}
        </Accordion>
      </div>
    )

  if (interactive) {
    return (
      <div className="flex min-w-0 flex-col">
        {studentId ? <SyllabusViewTracker syllabus={syllabus} studentId={studentId} /> : null}
        {syllabusToolbar}
        <div className="space-y-6 px-4 pb-6 pt-4 sm:px-5">
          {universityHeader}
          {sectionsBody}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {studentId ? <SyllabusViewTracker syllabus={syllabus} studentId={studentId} /> : null}
      {universityHeader}
      {sectionsBody}
    </div>
  )
}

export function SyllabusViewer(props: SyllabusViewerProps) {
  const accentMode = props.interactive ? "portal" : "brand"
  return (
    <SyllabusAccentProvider accent={accentMode}>
      <SyllabusViewerBody {...props} />
    </SyllabusAccentProvider>
  )
}
