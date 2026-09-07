"use client"

import type { ComponentType } from "react"
import { LandingVideo } from "@/components/landing/LandingVideo"
import { motion } from "@/components/landing/framer"
import { useLandingMotionEnabled } from "@/components/landing/LandingMotionProvider"
import { Check, Code2, Sparkles, Users, Info } from "lucide-react"

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
  scalePop,
  sectionHeader,
  staggerContainer,
} from "@/components/landing/landing-motion"

const PILLARS = [
  {
    icon: Sparkles,
    title: "Agentic AI at the Core",
    desc: "Cora doesn't just answer — it plans, creates, and executes with your approval. Study plans for students, drafts for faculty, applications for career members.",
    tone: "accent" as const,
  },
  {
    icon: Code2,
    title: "Real Engineering Practice",
    desc: "CodeBench C++ runs in the browser, circuit labs use real question-bank figures, and Practice Hub turns any topic into targeted drills.",
    tone: "warning" as const,
  },
  {
    icon: Users,
    title: "Built for Collaboration",
    desc: "University sign-in, forums, groups, and projects. Learning happens together — in class, in study groups, and beyond.",
    tone: "accent" as const,
  },
]

const CAPABILITIES = [
  "Cora agentic AI",
  "Quizzes & exams",
  "CodeBench C++",
  "Lectures & materials",
  "Analytics & insights",
]

function PillarCard({
  icon: Icon,
  title,
  desc,
  tone,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
  title: string
  desc: string
  tone: "accent" | "warning"
}) {
  const isWarning = tone === "warning"

  return (
    <div className="flex h-full flex-col rounded-[1.35rem] border border-[var(--border)] bg-[var(--cc-surface)] p-5 shadow-[0_16px_40px_-28px_color-mix(in_srgb,var(--cc-accent)_45%,transparent)] transition-transform duration-200 hover:-translate-y-1 sm:p-6 lg:p-7">
      <div
        className={`mb-4 flex size-12 items-center justify-center rounded-xl sm:size-14 ${
          isWarning
            ? "bg-[color-mix(in_srgb,var(--cc-warning)_16%,transparent)] text-[var(--cc-warning)]"
            : "bg-[var(--cc-accent-soft)] text-[var(--cc-accent)]"
        }`}
      >
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.25} />
      </div>
      <h3 className="mb-2 text-lg font-bold text-[var(--cc-text)] sm:text-xl">{title}</h3>
      <p className="text-sm leading-relaxed text-[var(--cc-text-secondary)] sm:text-[0.95rem]">
        {desc}
      </p>
    </div>
  )
}

export function AboutSection() {
  const effectsEnabled = useLandingMotionEnabled()
  const inView = effectsEnabled
    ? ({ initial: "hidden" as const, whileInView: "show" as const, viewport: LANDING_VIEWPORT })
    : ({ initial: false as const })

  return (
    <section id="about" className={landingSectionClass}>

      <div className={landingSectionInnerClass}>
        <motion.div
          className={landingSectionHeaderClass}
          variants={sectionHeader}
          {...inView}
        >
          <div className={`${landingEyebrowClass} hidden sm:mb-4 sm:inline-flex`}>
            <Info className="h-3.5 w-3.5" aria-hidden />
            ABOUT COURSECOLLAB
          </div>
          <h2 className={`${landingSectionTitleClass} lg:text-[2.65rem] lg:leading-tight`}>
            Where{" "}
            <span className="text-[var(--cc-accent)]">learning</span> meets{" "}
            <span className="text-[var(--cc-warning)]">intelligence</span>
          </h2>
          <p className={landingSectionDescClass}>
            <span className="md:hidden">
              The agentic LMS for engineering education — smarter practice, confident teaching.
            </span>
            <span className="hidden md:inline">
              CourseCollab is the agentic LMS built for modern engineering education. We bridge
              traditional coursework and AI that acts — so students practice smarter, instructors
              teach with confidence, and career members land the next role.
            </span>
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          {...inView}
          className="mb-8 hidden gap-5 md:grid md:grid-cols-3 md:gap-6 lg:mb-16 lg:gap-8"
        >
          {PILLARS.map((pillar) => (
            <PillarCard key={pillar.title} {...pillar} />
          ))}
        </motion.div>

        <motion.div
          variants={scalePop}
          {...inView}
          transition={{ delay: 0.1 }}
          className="mx-auto max-w-3xl overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--cc-surface)] text-center shadow-[0_20px_50px_-30px_color-mix(in_srgb,var(--cc-accent)_35%,transparent)] sm:rounded-[1.75rem]"
        >
          <div className="relative hidden aspect-[21/9] sm:block">
            <LandingVideo src="about-admins" className="absolute inset-0" />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--cc-surface)]/50 via-transparent to-transparent" />
          </div>
          <div className="px-4 py-5 sm:px-8 sm:py-9">
            <p className="text-xl font-extrabold text-[var(--cc-text)] sm:text-2xl md:text-[1.65rem]">
              One platform. Every step of the journey.
            </p>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[var(--cc-text-secondary)] sm:text-base">
              <span className="sm:hidden">Quizzes, CodeBench, lectures, Cora — all in one place.</span>
              <span className="hidden sm:inline">
                From first sign-in to final grade — quizzes, homework, CodeBench, lectures, and
                Cora working alongside you. Everything stays in one place.
              </span>
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
              {CAPABILITIES.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--cc-surface)] px-3 py-1.5 text-xs font-medium text-[var(--cc-text-secondary)] sm:text-sm"
                >
                  <Check className="h-3.5 w-3.5 shrink-0 text-[var(--cc-success)]" strokeWidth={2.5} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
