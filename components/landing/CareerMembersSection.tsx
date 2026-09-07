"use client"

import Link from "next/link"
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  FileSearch,
  FileText,
  KanbanSquare,
  ScanSearch,
  Sparkles,
} from "lucide-react"

import { LaptopFrame } from "@/components/landing/device-frames"
import { motion } from "@/components/landing/framer"
import { useLandingMotionEnabled } from "@/components/landing/LandingMotionProvider"
import {
  landingSectionClass,
  landingSectionInnerClass,
  landingEyebrowClass,
  landingSectionTitleClass,
  landingSectionDescClass,
  landingPrimaryButtonClass,
  landingSecondaryButtonClass,
} from "@/components/landing/landing-section-layout"
import {
  fadeUp,
  LANDING_VIEWPORT,
  sectionHeader,
  staggerContainer,
} from "@/components/landing/landing-motion"

const CAREER_BENEFITS = [
  {
    icon: ScanSearch,
    title: "Resume Match scoring",
    desc: "Score your resume against any job posting — with skill-level evidence behind every number.",
  },
  {
    icon: FileSearch,
    title: "ATS readability checks",
    desc: "Catch formatting that trips up applicant tracking systems before a recruiter ever sees it.",
  },
  {
    icon: FileText,
    title: "Tailored cover letters",
    desc: "Drafted by Cora from your actual experience and the job description — ready to review and send.",
  },
  {
    icon: KanbanSquare,
    title: "Application tracker",
    desc: "Every application, status, and deadline in one pipeline — from first scan to offer.",
  },
] as const

export function CareerMembersSection() {
  const effectsEnabled = useLandingMotionEnabled()
  const inView = effectsEnabled
    ? ({ initial: "hidden" as const, whileInView: "show" as const, viewport: LANDING_VIEWPORT })
    : ({ initial: false as const })

  return (
    <section id="career" className={landingSectionClass}>
      <div className={landingSectionInnerClass}>
        <div className="grid items-center gap-8 sm:gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <motion.div variants={sectionHeader} {...inView}>
            <div className={`${landingEyebrowClass} sm:mb-4`}>
              <Briefcase className="h-3.5 w-3.5" aria-hidden />
              FOR CAREER MEMBERS
            </div>
            <h2 className={`${landingSectionTitleClass} text-left`}>
              Not a student? Join directly and let{" "}
              <span className="text-[var(--cc-accent)]">Cora work your job search</span>
            </h2>
            <p className={`${landingSectionDescClass} mx-0 text-left`}>
              <span className="sm:hidden">
                Open to everyone — no university account required. Turn your resume into
                interviews with an AI that scores, writes, and tracks alongside you.
              </span>
              <span className="hidden sm:inline">
                Career membership is open to everyone — no university account required. Sign up
                in minutes and turn your resume into interviews with an agentic AI that scores,
                writes, and tracks alongside you.
              </span>
            </p>

            <motion.ul variants={staggerContainer} {...inView} className="mt-6 grid gap-3.5 sm:mt-7 sm:grid-cols-2 sm:gap-4">
              {CAREER_BENEFITS.map((benefit) => (
                <motion.li key={benefit.title} variants={fadeUp} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--cc-accent-soft)] text-[var(--cc-accent)]">
                    <benefit.icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[var(--cc-text)]">{benefit.title}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--cc-text-secondary)]">
                      {benefit.desc}
                    </p>
                  </div>
                </motion.li>
              ))}
            </motion.ul>

            <div className="mt-7 flex flex-col items-stretch gap-2.5 sm:mt-8 sm:flex-row sm:items-center sm:gap-4">
              <Link
                href="/student/login/guest"
                prefetch={false}
                className={`${landingPrimaryButtonClass} min-h-[48px] w-full px-5 sm:w-auto sm:px-7`}
              >
                Create your career account
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/student/login/guest"
                prefetch={false}
                className={`${landingSecondaryButtonClass} min-h-[48px] w-full px-5 sm:w-auto sm:px-7`}
              >
                Career member login
              </Link>
            </div>
            {/* flex (not inline-flex) with the copy in one span — otherwise the
                trailing link becomes its own flex item and drifts off the
                sentence when the text wraps on phones. */}
            <p className="mt-3 flex items-start gap-1.5 text-xs font-medium text-[var(--cc-text-secondary)]">
              <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--cc-accent)]" aria-hidden />
              <span>
                Semester memberships with monthly Cora Credits built in — see{" "}
                <a href="#pricing" className="font-semibold text-[var(--cc-accent)] hover:underline">
                  plans
                </a>
              </span>
            </p>
          </motion.div>

          <motion.div variants={fadeUp} {...inView} className="relative mx-auto w-full max-w-[34rem]">
            <div
              className="pointer-events-none absolute inset-x-2 top-10 bottom-2 rounded-full blur-3xl"
              style={{
                background:
                  "radial-gradient(closest-side, color-mix(in srgb, var(--cc-accent) 20%, transparent), transparent 72%)",
              }}
              aria-hidden
            />
            <LaptopFrame
              shot={{
                src: "/images/landing/web/web-career-match.png",
                alt: "Cora Career résumé match report with a 64% score, skill bars, top improvements, and evidence-backed keyword matches",
                width: 1600,
                height: 1000,
              }}
              sizes="(max-width: 1024px) 92vw, 540px"
            />
            {/* Floating badge overhangs the frame — hidden on phones, where it clips off-canvas. */}
            <div className="absolute -left-3 top-8 z-20 hidden items-center gap-2 rounded-2xl sm:flex border border-[var(--border)] bg-[var(--cc-surface)] px-3.5 py-2.5 shadow-[0_16px_40px_-16px_rgba(30,15,60,0.4)]">
              <Sparkles className="h-4 w-4 text-[var(--cc-accent)]" aria-hidden />
              <p className="text-xs font-bold text-[var(--cc-text)]">
                Evidence behind every score
                <span className="block text-[10px] font-medium text-[var(--cc-text-muted)]">
                  Skills, keywords & ATS checks
                </span>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
