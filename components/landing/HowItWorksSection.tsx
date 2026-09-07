"use client"

import Link from "next/link"
import { motion } from "@/components/landing/framer"
import { useLandingMotionEnabled } from "@/components/landing/LandingMotionProvider"
import {
  ChevronRight,
  GraduationCap,
  LayoutDashboard,
  KeyRound,
  School,
  Sparkles,
  Users,
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
} from "@/components/landing/landing-motion"

const STEPS = [
  {
    icon: School,
    title: "Find your university",
    desc: "Pick your school on the sign-in page — CourseCollab is branded for your institution.",
    tone: "accent" as const,
  },
  {
    icon: KeyRound,
    title: "Sign in securely",
    desc: "Students use their university account. Faculty sign in with instructor credentials.",
    tone: "warning" as const,
  },
  {
    icon: LayoutDashboard,
    title: "Land in your courses",
    desc: "Your dashboard loads with courses, assignments, practice, and grades ready to go.",
    tone: "accent" as const,
  },
  {
    icon: Sparkles,
    title: "Put Cora to work",
    desc: "Ask for a study plan, flashcards, or a session — Cora plans, you approve, it executes.",
    tone: "warning" as const,
  },
]

function StepCard({
  step,
  index,
}: {
  step: (typeof STEPS)[number]
  index: number
}) {
  const Icon = step.icon
  const isWarning = step.tone === "warning"

  return (
    <div className="relative flex h-full min-h-[10.75rem] flex-col rounded-2xl border border-[var(--border)] bg-[var(--cc-surface)] p-4 shadow-[0_16px_40px_-28px_color-mix(in_srgb,var(--cc-accent)_45%,transparent)] transition-transform duration-200 hover:-translate-y-1 sm:min-h-[11.5rem] sm:rounded-[1.35rem] sm:p-6 lg:min-h-[12.75rem]">
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <div
          className={`flex size-11 items-center justify-center rounded-xl sm:size-12 ${
            isWarning
              ? "bg-[color-mix(in_srgb,var(--cc-warning)_16%,transparent)] text-[var(--cc-warning)]"
              : "bg-[var(--cc-accent-soft)] text-[var(--cc-accent)]"
          }`}
        >
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </div>
        <span
          className="text-xs font-bold tracking-widest text-[var(--cc-text-muted)]"
          aria-hidden
        >
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <h3 className="mb-2 min-h-[1.35rem] shrink-0 text-base font-bold leading-tight text-[var(--cc-text)] sm:min-h-[1.5rem] sm:text-[1.05rem]">
        {step.title}
      </h3>
      <p className="min-h-[2.75rem] flex-1 text-xs leading-relaxed text-[var(--cc-text-secondary)] sm:min-h-[3rem] sm:text-sm lg:min-h-[4.25rem] lg:line-clamp-3">
        {step.desc}
      </p>
    </div>
  )
}

/** Connector sits just below icon badges, above titles */
const TIMELINE_TOP = "top-[calc(1.25rem+2.75rem+0.5rem)] sm:top-[calc(1.5rem+3rem+0.5rem)]"

function DesktopTimeline() {
  return (
    <div className="relative mx-auto mb-12 hidden max-w-5xl lg:block sm:mb-16">
      <div className="grid grid-cols-4 items-stretch gap-4">
        {STEPS.map((step, i) => (
          <div key={step.title} className="relative flex">
            {i < STEPS.length - 1 ? (
              <div
                className={`pointer-events-none absolute ${TIMELINE_TOP} left-[calc(50%+1.75rem)] z-0 h-[3px] w-[calc(100%-1.5rem)] origin-left rounded-full opacity-45`}
                style={{
                  background: `linear-gradient(90deg, var(--cc-accent), var(--cc-warning))`,
                }}
                aria-hidden
              />
            ) : null}
            <div className="relative z-10 flex w-full">
              <StepCard step={step} index={i} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function HowItWorksSection() {
  const effectsEnabled = useLandingMotionEnabled()
  const inView = effectsEnabled
    ? ({ initial: "hidden" as const, whileInView: "show" as const, viewport: LANDING_VIEWPORT })
    : ({ initial: false as const })

  return (
    <section id="how-it-works" className={landingSectionClass}>

      <div className={landingSectionInnerClass}>
        <motion.div className={landingSectionHeaderClass} variants={sectionHeader} {...inView}>
          <div className={`${landingEyebrowClass} hidden sm:mb-4 sm:inline-flex`}>
            <span aria-hidden>✨</span>
            HOW IT WORKS
          </div>
          <h2 className={landingSectionTitleClass}>
            Get started in{" "}
            <span className="text-[var(--cc-accent)]">4 simple steps</span>
          </h2>
          <p className={`${landingSectionDescClass} max-w-xl`}>
            <span className="sm:hidden">Pick your university, sign in, and you&apos;re learning.</span>
            <span className="hidden sm:inline">
              Sign-in takes seconds. Choose your university, log in with your account, and
              everything — courses, practice, and Cora — is waiting on the other side.
            </span>
          </p>
        </motion.div>

        <DesktopTimeline />

        {/* Mobile / tablet stack */}
        <div className="relative mx-auto mb-8 max-w-lg space-y-3 sm:mb-16 lg:hidden">
          <div
            className="absolute bottom-4 left-[1.025rem] top-4 w-0.5 -translate-x-1/2 rounded-full bg-[var(--cc-accent-soft-strong,var(--cc-accent-soft))]"
            aria-hidden
          />
          {STEPS.map((step, i) => (
            <div key={step.title} className="relative pl-14">
              <span
                className="absolute left-0 top-5 flex size-[2.05rem] items-center justify-center rounded-full border-2 border-[var(--cc-surface)] bg-[var(--cc-accent)] text-xs font-bold text-white shadow-md"
                aria-hidden
              >
                {i + 1}
              </span>
              <StepCard step={step} index={i} />
            </div>
          ))}
        </div>

        <div className="mx-auto max-w-3xl rounded-[1.35rem] border border-[var(--border)] bg-[var(--cc-surface)] p-4 shadow-[0_20px_50px_-30px_color-mix(in_srgb,var(--cc-accent)_40%,transparent)] sm:rounded-[1.75rem] sm:p-6 md:p-8">
          <p className="mb-4 hidden text-center text-sm font-semibold text-[var(--cc-text-secondary)] sm:mb-6 md:block">
            Ready to jump in? Choose your path
          </p>
          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-5">
            <Link
              href="/student/login"
              prefetch={false}
              className="group flex flex-1 items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--cc-surface)] px-4 py-4 transition-all hover:border-[var(--cc-accent)] hover:shadow-lg sm:px-5"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--cc-accent-soft)] text-[var(--cc-accent)]">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="font-bold text-[var(--cc-text)]">I&apos;m a Student</p>
                <p className="hidden text-xs text-[var(--cc-text-muted)] sm:block">
                  University sign-in → your dashboard
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-[var(--cc-accent)] transition-transform group-hover:translate-x-0.5" />
            </Link>

            <span className="text-center text-xs font-semibold uppercase tracking-wider text-[var(--cc-text-muted)] sm:px-1">
              or
            </span>

            <Link
              href="/faculty/login"
              prefetch={false}
              className="group flex flex-1 items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--cc-surface)] px-4 py-4 transition-all hover:border-[var(--cc-accent)] hover:shadow-lg sm:px-5"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--cc-warning)_16%,transparent)] text-[var(--cc-warning)]">
                <Users className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="font-bold text-[var(--cc-text)]">I&apos;m Faculty</p>
                <p className="hidden text-xs text-[var(--cc-text-muted)] sm:block">
                  Instructor, TA, or grader login
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-[var(--cc-accent)] transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <p className="mt-4 hidden text-center text-xs leading-relaxed text-[var(--cc-text-muted)] sm:mt-6 sm:text-sm md:block">
            <span className="font-semibold text-[var(--cc-accent)]">Students</span> and{" "}
            <span className="font-semibold text-[var(--cc-accent)]">faculty</span> sign in with
            university accounts.{" "}
            <Link
              href="/student/login/summer-camp"
              className="font-semibold text-[var(--cc-warning)] hover:underline"
            >
              Summer Camp campers
            </Link>{" "}
            have a dedicated login.
          </p>
        </div>
      </div>
    </section>
  )
}
