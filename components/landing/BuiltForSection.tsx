"use client"

import type { ComponentType, ReactNode } from "react"
import Link from "next/link"
import { motion } from "@/components/landing/framer"
import { useLandingMotionEnabled } from "@/components/landing/LandingMotionProvider"
import { LandingVideo } from "@/components/landing/LandingVideo"
import {
  BarChart3,
  Bot,
  Briefcase,
  ChevronRight,
  Code2,
  FileText,
  GraduationCap,
  Library,
  Lightbulb,
  Medal,
  Sparkles,
  Target,
  Trophy,
  Zap,
  ClipboardList,
  TrendingUp,
  Building2,
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
  fadeUp,
  LANDING_VIEWPORT,
  sectionHeader,
  staggerContainer,
} from "@/components/landing/landing-motion"

type Tone = "accent" | "warning" | "success"

type Highlight = {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
  title: string
  desc: string
}

const STUDENT_HIGHLIGHTS: Highlight[] = [
  { icon: Bot, title: "Cora Assistant", desc: "Study plans, flashcards, and sessions — done for you" },
  { icon: Code2, title: "CodeBench", desc: "Real C++ environment with instant feedback" },
  { icon: Lightbulb, title: "Practice Hub", desc: "Generate drills from the question bank" },
  { icon: BarChart3, title: "Smart Analytics", desc: "Track progress and weak spots" },
  { icon: Trophy, title: "Leaderboards", desc: "Gamified learning and achievements" },
]

const FACULTY_HIGHLIGHTS: Highlight[] = [
  { icon: Sparkles, title: "Cora Copilot", desc: "Drafts announcements and builds question banks" },
  { icon: Zap, title: "Auto Grading", desc: "Instant quiz and CodeBench scoring" },
  { icon: Library, title: "Question Bank", desc: "Organize, reuse, and verify questions" },
  { icon: ClipboardList, title: "Assessments", desc: "Quizzes, homework, and projects" },
  { icon: TrendingUp, title: "AI Insights", desc: "Spot learning gaps early" },
]

const CAREER_HIGHLIGHTS: Highlight[] = [
  { icon: Bot, title: "Cora for Career", desc: "An agentic copilot for your job search" },
  { icon: Target, title: "Resume Match", desc: "Score your resume against any job posting" },
  { icon: FileText, title: "Cover Letters", desc: "Tailored drafts grounded in your resume" },
  { icon: Medal, title: "Recommendations", desc: "Request and track recommendation letters" },
  { icon: Briefcase, title: "Application Tracker", desc: "Every application, status, and deadline" },
]

const TONE_STYLES: Record<
  Tone,
  { chip: string; iconTile: string; cta: string; sparkle: string }
> = {
  accent: {
    chip: "bg-[var(--cc-accent-soft)] text-[var(--cc-accent)]",
    iconTile: "bg-[var(--cc-accent-soft)] text-[var(--cc-accent)]",
    cta: "bg-[var(--cc-accent)] text-white hover:bg-[var(--cc-accent-hover)]",
    sparkle: "text-[var(--cc-accent)]",
  },
  warning: {
    chip: "bg-[color-mix(in_srgb,var(--cc-warning)_16%,transparent)] text-[var(--cc-warning)]",
    iconTile: "bg-[color-mix(in_srgb,var(--cc-warning)_16%,transparent)] text-[var(--cc-warning)]",
    cta: "bg-[var(--cc-warning)] text-white hover:brightness-105",
    sparkle: "text-[var(--cc-warning)]",
  },
  success: {
    chip: "bg-[color-mix(in_srgb,var(--cc-success)_14%,transparent)] text-[var(--cc-success)]",
    iconTile: "bg-[color-mix(in_srgb,var(--cc-success)_14%,transparent)] text-[var(--cc-success)]",
    cta: "bg-[var(--cc-success)] text-white hover:brightness-105",
    sparkle: "text-[var(--cc-success)]",
  },
}

function HighlightRow({
  icon: Icon,
  title,
  desc,
  tone,
}: Highlight & { tone: Tone }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--cc-surface)] px-3.5 py-3">
      <div
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${TONE_STYLES[tone].iconTile}`}
      >
        <Icon className="h-4 w-4" strokeWidth={2.25} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--cc-text)]">{title}</p>
        <p className="text-xs leading-snug text-[var(--cc-text-secondary)]">{desc}</p>
      </div>
    </div>
  )
}

/** Compact resume-match mock for the career panel (no video asset needed). */
function CareerMatchMock() {
  return (
    <div className="mx-auto flex aspect-[4/3] w-full max-w-[260px] flex-col rounded-xl border border-[var(--border)] bg-[var(--cc-surface)] p-3.5 shadow-[0_16px_32px_-16px_color-mix(in_srgb,var(--cc-accent)_30%,transparent)]">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--cc-text-muted)]">
          Resume match
        </span>
        <span className="rounded-full bg-[color-mix(in_srgb,var(--cc-success)_14%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--cc-success)]">
          Strong fit
        </span>
      </div>
      <p className="mb-2 truncate text-[11px] font-semibold text-[var(--cc-text)]">
        Embedded Software Engineer — New Grad
      </p>
      <div className="mb-1 flex items-end justify-between">
        <span className="text-2xl font-extrabold text-[var(--cc-accent)]">87%</span>
        <span className="text-[10px] text-[var(--cc-text-muted)]">match score</span>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-[var(--cc-accent-soft)]">
        <div className="h-full w-[87%] rounded-full bg-[var(--cc-accent)]" />
      </div>
      <div className="mt-auto space-y-1.5">
        {[
          ["C++ & firmware", "Matched"],
          ["RTOS experience", "Add evidence"],
        ].map(([skill, status]) => (
          <div
            key={skill}
            className="flex items-center justify-between rounded-lg bg-[var(--cc-accent-soft)] px-2.5 py-1.5 text-[10px]"
          >
            <span className="font-medium text-[var(--cc-text)]">{skill}</span>
            <span
              className={
                status === "Matched"
                  ? "font-semibold text-[var(--cc-success)]"
                  : "font-semibold text-[var(--cc-warning)]"
              }
            >
              {status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RolePanel({
  role,
  title,
  subtitle,
  mobileSubtitle,
  media,
  highlights,
  tagline,
  ctaHref,
  ctaLabel,
  tone,
  index,
  effectsEnabled,
}: {
  role: string
  title: string
  subtitle: string
  mobileSubtitle?: string
  media: ReactNode
  highlights: Highlight[]
  tagline: string
  ctaHref: string
  ctaLabel: string
  tone: Tone
  index: number
  effectsEnabled: boolean
}) {
  const styles = TONE_STYLES[tone]
  const shortSubtitle = mobileSubtitle ?? subtitle

  const panelClass =
    "flex h-full flex-col rounded-[1.35rem] border border-[var(--border)] bg-[var(--cc-surface)] p-4 shadow-[0_20px_50px_-30px_color-mix(in_srgb,var(--cc-accent)_38%,transparent)] transition-transform duration-200 hover:-translate-y-1 sm:rounded-[1.75rem] sm:p-6 lg:p-7"

  const content = (
    <>
      <div className="mb-4 flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${styles.chip}`}
        >
          {role}
        </span>
      </div>

      <h3 className="mb-1.5 text-lg font-extrabold text-[var(--cc-text)] sm:text-[1.3rem]">
        {title}
      </h3>
      <p className="mb-4 text-sm leading-relaxed text-[var(--cc-text-secondary)] sm:mb-5">
        <span className="sm:hidden">{shortSubtitle}</span>
        <span className="hidden sm:inline">{subtitle}</span>
      </p>

      <div className="relative mx-auto mb-4 hidden w-full max-w-[220px] flex-shrink-0 sm:mb-5 sm:block sm:max-w-[260px]">
        {media}
      </div>

      {/* Phones get the top 3 — enough substance to sell the card without a wall of rows. */}
      <div className="mb-4 flex flex-1 flex-col gap-2">
        {highlights.map((item, itemIndex) => (
          <div key={item.title} className={itemIndex > 2 ? "hidden md:block" : undefined}>
            <HighlightRow {...item} tone={tone} />
          </div>
        ))}
      </div>

      <p className="mb-4 hidden text-center text-xs font-medium text-[var(--cc-text-muted)] md:block">
        <Sparkles className={`mr-1 inline h-3.5 w-3.5 ${styles.sparkle}`} />
        {tagline}
      </p>

      <Link
        href={ctaHref}
        prefetch={false}
        className={`group mt-auto inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-all hover:shadow-lg ${styles.cta}`}
      >
        {ctaLabel}
        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </>
  )

  if (!effectsEnabled) {
    return <div className={panelClass}>{content}</div>
  }

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={LANDING_VIEWPORT}
      transition={{ delay: index * 0.08 }}
      className={panelClass}
    >
      {content}
    </motion.div>
  )
}

export function BuiltForSection() {
  const effectsEnabled = useLandingMotionEnabled()
  const inView = effectsEnabled
    ? ({ initial: "hidden" as const, whileInView: "show" as const, viewport: LANDING_VIEWPORT })
    : ({ initial: false as const })

  return (
    <section id="built-for" className={landingSectionClass}>

      <div className={landingSectionInnerClass}>
        <motion.div className={landingSectionHeaderClass} variants={sectionHeader} {...inView}>
          <div className={`${landingEyebrowClass} hidden sm:mb-4 sm:inline-flex`}>
            <GraduationCap className="h-3.5 w-3.5" aria-hidden />
            BUILT FOR EVERYONE
          </div>
          <h2 className={landingSectionTitleClass}>
            One platform,{" "}
            <span className="text-[var(--cc-accent)]">three tailored</span>{" "}
            <span className="text-[var(--cc-warning)]">experiences</span>
          </h2>
          <p className={`${landingSectionDescClass} max-w-2xl`}>
            <span className="sm:hidden">Learn, teach, or launch your career — one platform.</span>
            <span className="hidden sm:inline">
              Whether you&apos;re mastering circuits, running a full course, or landing your next
              role, CourseCollab pairs you with the right Cora and the right tools.
            </span>
          </p>
        </motion.div>

        <motion.div
          className="grid items-stretch gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-7"
          variants={staggerContainer}
          {...inView}
        >
          <RolePanel
            role="Students"
            title="For Students"
            subtitle="Your AI-powered engineering workspace — practice coding, track progress, and let Cora Assistant handle the busywork."
            mobileSubtitle="Practice coding, track progress, get Cora's help."
            media={
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl shadow-[0_16px_32px_-16px_color-mix(in_srgb,var(--cc-accent)_35%,transparent)]">
                <LandingVideo src="built-for-students" className="absolute inset-0" />
              </div>
            }
            highlights={STUDENT_HIGHLIGHTS}
            tagline="Learn. Code. Succeed."
            ctaHref="/student/login"
            ctaLabel="Student login"
            tone="accent"
            index={0}
            effectsEnabled={effectsEnabled}
          />
          <RolePanel
            role="Faculty"
            title="For Instructors"
            subtitle="Run courses end-to-end — rosters, assessments, auto-grading, and Cora Copilot drafting alongside you."
            mobileSubtitle="Rosters, assessments, grading, and Cora Copilot."
            media={
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl shadow-[0_16px_32px_-16px_color-mix(in_srgb,var(--cc-warning)_40%,transparent)]">
                <LandingVideo src="built-for-instructors" className="absolute inset-0" />
              </div>
            }
            highlights={FACULTY_HIGHLIGHTS}
            tagline="Teach. Manage. Empower."
            ctaHref="/faculty/login"
            ctaLabel="Faculty login"
            tone="warning"
            index={1}
            effectsEnabled={effectsEnabled}
          />
          <RolePanel
            role="Career members"
            title="For Career Members"
            subtitle="Turn coursework into offers — resume matching, cover letters, recommendations, and Cora working your job search."
            mobileSubtitle="Resume matching, cover letters, and Cora for career."
            media={<CareerMatchMock />}
            highlights={CAREER_HIGHLIGHTS}
            tagline="Match. Apply. Get hired."
            ctaHref="/student/login/guest"
            ctaLabel="Career member login"
            tone="success"
            index={2}
            effectsEnabled={effectsEnabled}
          />
        </motion.div>

        <Link
          href="/institutions"
          className="mt-6 flex flex-col gap-3 rounded-[1.35rem] border border-[var(--border)] bg-[var(--cc-surface)] p-5 shadow-[0_16px_40px_-28px_color-mix(in_srgb,var(--cc-accent)_38%,transparent)] sm:flex-row sm:items-center sm:justify-between sm:p-6"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--cc-accent-soft)] text-[var(--cc-accent)]">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-[var(--cc-accent)]">For universities</p>
              <p className="mt-1 text-base font-extrabold text-[var(--cc-text)]">Institutional licensing</p>
              <p className="mt-1 text-sm text-[var(--cc-text-secondary)]">
                Sponsor Course Collab for a program, department, or college. Covered students and faculty do not buy individual memberships.
              </p>
            </div>
          </div>
          <span className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--cc-accent)] px-5 text-sm font-bold text-white">
            View institution packages
            <ChevronRight className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </section>
  )
}
