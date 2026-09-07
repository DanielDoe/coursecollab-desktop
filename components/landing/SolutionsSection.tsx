"use client"

import * as React from "react"
import type { ComponentType } from "react"
import { motion } from "@/components/landing/framer"
import { useLandingMotionEnabled } from "@/components/landing/LandingMotionProvider"
import {
  GraduationCap,
  Bot,
  ClipboardList,
  Code2,
  CircuitBoard,
  Presentation,
  BarChart3,
  Sun,
  ChevronDown,
} from "lucide-react"
import {
  landingSectionClass,
  landingSectionInnerClass,
  landingSectionHeaderClass,
  landingEyebrowClass,
  landingSectionTitleClass,
  landingSectionDescClass,
} from "@/components/landing/landing-section-layout"
import {
  LANDING_VIEWPORT,
  sectionHeader,
  slideFromLeft,
  slideFromRight,
} from "@/components/landing/landing-motion"

type Tone = "purple" | "gold"

type Solution = {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
  title: string
  desc: string
  highlights: string[]
  tone: Tone
}

/**
 * Theme tokens, not literal hex.
 *
 * These tiles used to be `from-[#7c4db8] to-[#582c83]` gradients. A
 * `.landing-themed` rule in globals.css re-maps those exact class names by
 * rewriting `--tw-gradient-stops`, but this Tailwind build emits oklab
 * gradients with a different variable contract — so the override resolved to a
 * fully transparent gradient and the white icons vanished against the white
 * card. Driving colour from `--cc-*` keeps the section theme-aware and skips
 * that collision entirely.
 */
const TONE: Record<Tone, { tile: string; dot: string; chip: string; label: string }> = {
  purple: {
    tile: "bg-[var(--cc-accent-soft)] text-[var(--cc-accent)]",
    dot: "bg-[var(--cc-accent)]",
    chip: "bg-[var(--cc-accent-soft)] text-[var(--cc-accent)]",
    label: "text-[var(--cc-accent)]",
  },
  gold: {
    tile: "bg-[color-mix(in_srgb,var(--cc-warning)_18%,transparent)] text-[var(--cc-warning)]",
    dot: "bg-[var(--cc-warning)]",
    chip: "bg-[color-mix(in_srgb,var(--cc-warning)_14%,transparent)] text-[var(--cc-warning)]",
    label: "text-[var(--cc-warning)]",
  },
}

const SOLUTIONS: Solution[] = [
  {
    icon: GraduationCap,
    title: "University & Department Platform",
    desc: "A complete learning hub built for engineering programs — rosters, sections, and role-based access out of the box.",
    highlights: ["Roster login & sections", "Student & faculty portals", "Multi-course management"],
    tone: "purple",
  },
  {
    icon: Bot,
    title: "AI Tutor & Practice Hub",
    desc: "Personalized support around the clock — explanations, hints, code review, and drills generated from your question bank.",
    highlights: ["24/7 AI tutoring", "Smart hints & code review", "Auto-generated practice"],
    tone: "gold",
  },
  {
    icon: ClipboardList,
    title: "Assessments & Auto-Grading",
    desc: "Create, deliver, and grade quizzes, homework, and projects with instant feedback students can act on.",
    highlights: ["Timed quizzes & exams", "Question bank & verification", "Homework & projects"],
    tone: "purple",
  },
  {
    icon: Code2,
    title: "CodeBench",
    desc: "Real C++ in the browser — write, compile, run, and get scored without local setup or IT overhead.",
    highlights: ["In-browser IDE", "Instant compile & run", "Automated test scoring"],
    tone: "gold",
  },
  {
    icon: CircuitBoard,
    title: "Circuit Labs",
    desc: "Textbook-aligned circuit submissions with structured grading — ideal for circuits and electronics courses.",
    highlights: ["Figure-based submissions", "Instructor solution matching", "CAD textbook integration"],
    tone: "purple",
  },
  {
    icon: Presentation,
    title: "Lectures & Course Materials",
    desc: "Host slides, PDFs, and in-class workspaces with engagement tracking so you know what students actually use.",
    highlights: ["PDF & slide delivery", "In-class workspaces", "Views, bookmarks & comments"],
    tone: "gold",
  },
  {
    icon: BarChart3,
    title: "Analytics & Gradebook",
    desc: "Spot struggling students early, track progress across assessments, and export grades to Canvas when you need to.",
    highlights: ["Learning-gap insights", "Grade tracking & reports", "Canvas gradebook export"],
    tone: "purple",
  },
  {
    icon: Sun,
    title: "Summer Camp & STEM Outreach",
    desc: "Run K-12 and outreach programs with public registration, structured blocks, and the same tools your university uses.",
    highlights: ["Public camp registration", "Session blocks & scheduling", "Shared platform infrastructure"],
    tone: "gold",
  },
]

const SOLUTION_GROUPS = [
  { label: "Program hub", subtitle: "Rosters, materials & outreach", indices: [0, 5, 7] },
  { label: "Teach & assess", subtitle: "AI tutoring through auto-grading", indices: [1, 2] },
  { label: "Labs & insights", subtitle: "Code, circuits & analytics", indices: [3, 4, 6] },
] as const

/* ------------------------------------------------------------------ */
/* Desktop                                                             */
/* ------------------------------------------------------------------ */

function SolutionCard({
  solution,
  index,
  effectsEnabled,
}: {
  solution: Solution
  index: number
  effectsEnabled: boolean
}) {
  const Icon = solution.icon
  const tone = TONE[solution.tone]

  const className =
    "flex h-full flex-col rounded-[1.35rem] border border-[var(--border)] bg-[var(--cc-surface)] p-5 shadow-[0_20px_50px_-32px_color-mix(in_srgb,var(--cc-accent)_35%,transparent)] transition-transform duration-200 hover:-translate-y-1 sm:rounded-[1.75rem] sm:p-6"

  const content = (
    <>
      <div className={`mb-4 flex size-11 items-center justify-center rounded-xl ${tone.tile}`}>
        <Icon className="h-5 w-5" strokeWidth={2.25} />
      </div>

      <h3 className="mb-2 text-lg font-extrabold leading-snug text-[var(--cc-text)] sm:text-xl">
        {solution.title}
      </h3>
      <p className="mb-4 text-sm leading-relaxed text-[var(--cc-text-secondary)]">{solution.desc}</p>

      <ul className="mt-auto space-y-2">
        {solution.highlights.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 text-xs text-[var(--cc-text-secondary)] sm:text-sm"
          >
            <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${tone.dot}`} />
            {item}
          </li>
        ))}
      </ul>
    </>
  )

  if (!effectsEnabled) {
    return <article className={className}>{content}</article>
  }

  return (
    <motion.article
      variants={index % 2 === 0 ? slideFromLeft : slideFromRight}
      initial="hidden"
      whileInView="show"
      viewport={LANDING_VIEWPORT}
      transition={{ delay: (index % 4) * 0.05 }}
      className={className}
    >
      {content}
    </motion.article>
  )
}

/* ------------------------------------------------------------------ */
/* Mobile                                                              */
/* ------------------------------------------------------------------ */

function MobileSolutionRow({
  solution,
  isOpen,
  isLast,
  onToggle,
}: {
  solution: Solution
  isOpen: boolean
  isLast: boolean
  onToggle: () => void
}) {
  const Icon = solution.icon
  const tone = TONE[solution.tone]
  const panelId = `solution-panel-${solution.title.replace(/\s+/g, "-").toLowerCase()}`

  return (
    <div className={isLast ? undefined : "border-b border-[var(--border)]"}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-[var(--cc-accent-soft)]"
      >
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone.tile}`}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </span>
        <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-[var(--cc-text)]">
          {solution.title}
        </span>
        <ChevronDown
          className={`size-[18px] shrink-0 text-[var(--cc-text-muted)] transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      <div
        id={panelId}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pl-[3.25rem]">
            <p className="mb-3 text-[13px] leading-relaxed text-[var(--cc-text-secondary)]">
              {solution.desc}
            </p>
            <ul className="space-y-1.5">
              {solution.highlights.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[12px] leading-snug text-[var(--cc-text-secondary)]"
                >
                  <span className={`mt-[0.4rem] size-1.5 shrink-0 rounded-full ${tone.dot}`} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * One divided card per group rather than eight free-floating cards. Same
 * information, far less chrome to scan past on a phone.
 */
function MobileSolutionsAccordion() {
  const [openKey, setOpenKey] = React.useState<string | null>("0-0")

  return (
    <div className="space-y-5">
      {SOLUTION_GROUPS.map((group, groupIndex) => (
        <section key={group.label} aria-label={group.label}>
          <div className="mb-2 flex items-baseline gap-2 px-1">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-[var(--cc-accent)]">
              {group.label}
            </h3>
            <p className="min-w-0 flex-1 truncate text-[11px] text-[var(--cc-text-muted)]">
              {group.subtitle}
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--cc-surface)] shadow-[0_10px_30px_-24px_color-mix(in_srgb,var(--cc-accent)_45%,transparent)]">
            {group.indices.map((solutionIndex, itemIndex) => {
              const key = `${groupIndex}-${itemIndex}`
              return (
                <MobileSolutionRow
                  key={SOLUTIONS[solutionIndex].title}
                  solution={SOLUTIONS[solutionIndex]}
                  isOpen={openKey === key}
                  isLast={itemIndex === group.indices.length - 1}
                  onToggle={() => setOpenKey(openKey === key ? null : key)}
                />
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export function SolutionsSection() {
  const effectsEnabled = useLandingMotionEnabled()

  return (
    <section id="solutions" className={landingSectionClass}>
      <div className={landingSectionInnerClass}>
        <motion.div
          className={`${landingSectionHeaderClass} md:text-center`}
          variants={sectionHeader}
          initial={effectsEnabled ? "hidden" : false}
          whileInView={effectsEnabled ? "show" : undefined}
          viewport={LANDING_VIEWPORT}
        >
          <span className={landingEyebrowClass}>Solutions</span>
          <h2 className={landingSectionTitleClass}>
            <span className="md:hidden">
              One platform for{" "}
              <span className="text-[var(--cc-accent)]">engineering programs</span>
            </span>
            <span className="hidden md:inline">
              Everything your program needs,{" "}
              <span className="text-[var(--cc-accent)]">in one platform</span>
            </span>
          </h2>
          <p className={landingSectionDescClass}>
            <span className="md:hidden">Tap any area to see what it covers.</span>
            <span className="hidden md:inline">
              From AI tutoring and CodeBench to circuit labs, analytics, and summer outreach —
              CourseCollab covers the full teaching and learning stack for engineering education.
            </span>
          </p>
        </motion.div>

        <div className="md:hidden">
          <MobileSolutionsAccordion />
        </div>

        <div className="hidden gap-4 md:grid sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-6">
          {SOLUTIONS.map((solution, index) => (
            <SolutionCard
              key={solution.title}
              solution={solution}
              index={index}
              effectsEnabled={effectsEnabled}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
