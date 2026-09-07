"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CalendarCheck,
  Check,
  ChevronRight,
  GraduationCap,
  Layers,
  MessageSquareText,
  Presentation,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react"

import { DeviceDuo, type DeviceShot } from "@/components/landing/device-frames"
import { motion } from "@/components/landing/framer"
import {
  fadeUp,
  LANDING_VIEWPORT,
  sectionHeader,
  staggerContainer,
} from "@/components/landing/landing-motion"
import { useLandingMotionEnabled } from "@/components/landing/LandingMotionProvider"
import { landingShellClass } from "@/components/landing/landing-section-layout"

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

type CoraPersona = {
  id: "assistant" | "copilot" | "career"
  product: string
  /** Short tab label — the full product name does not fit a 3-up switcher on phones. */
  shortLabel: string
  audience: string
  icon: React.ComponentType<{ className?: string }>
  accent: string
  accentSoft: string
  headline: string
  description: string
  prompt: string
  promptCaption: string
  capabilities: string[]
  /** Web capture in a laptop frame with the matching phone capture standing in front. */
  device: { web: DeviceShot; phone: DeviceShot }
  cta: { label: string; href: string }
}

const CORA_PERSONAS: CoraPersona[] = [
  {
    id: "assistant",
    product: "Cora Assistant",
    shortLabel: "Students",
    audience: "For students",
    icon: GraduationCap,
    accent: "color-mix(in srgb, var(--cc-accent) 50%, white)",
    accentSoft: "color-mix(in srgb, var(--cc-accent) 16%, transparent)",
    headline: "From \u201cI have an exam\u201d to a full study system — in one ask.",
    description:
      "Cora reads your live course data — grades, quiz results, practice performance, lecture progress — then builds the plan, creates the materials, and schedules the work. You approve every step.",
    prompt:
      "Cora, I want to prepare for my next exam. Look at my released quiz and homework results, build a study plan focused on my weakest topics, create the flashcards I need, and add study sessions to my calendar.",
    promptCaption: "One real prompt. Everything below happened from it.",
    capabilities: [
      "Diagnoses your weakest topics from real grades and practice data",
      "Generates flashcard decks and practice activities instantly",
      "Books study sessions straight onto your calendar",
      "Summarizes recorded lectures into notes with AI Notetaker",
      "Walks through, debugs, and explains your code inside CodeBench",
    ],
    device: {
      web: {
        src: "/images/landing/web/web-cora-assistant.png",
        alt: "Cora Assistant on the web proposing a flashcard deck behind a confirmation card",
        width: 1600,
        height: 1000,
      },
      phone: {
        src: "/images/landing/cora/assistant-plan.png",
        alt: "Cora Assistant on mobile building a personalized exam study plan from live course data",
        width: 640,
        height: 1301,
      },
    },
    cta: { label: "Start learning with Cora", href: "/student/login" },
  },
  {
    id: "copilot",
    product: "Cora Copilot",
    shortLabel: "Faculty",
    audience: "For faculty",
    icon: Presentation,
    accent: "#fbbf24",
    accentSoft: "rgba(251,191,36,0.14)",
    headline: "Your teaching assistant that actually does the work.",
    description:
      "Announcements, question banks, course automation — Cora Copilot drafts it from your course context, shows you exactly what will change, and publishes the moment you say go.",
    prompt:
      "Cora, send an announcement to my current course telling students I will be about 5 minutes late to class today.",
    promptCaption: "Drafted, previewed, and published — in seconds.",
    capabilities: [
      "Drafts and publishes course announcements on your behalf",
      "Generates Question Bank items — MCQ, true/false, select-all — with difficulty control",
      "Checks generated questions and answers for consistency before saving",
      "Pulls from your live course context: lectures, topics, rosters",
      "Preview-first: every action ships with a confirmation card",
    ],
    device: {
      web: {
        src: "/images/landing/web/web-cora-copilot.png",
        alt: "Cora Copilot on the web drafting a course announcement held for publish approval",
        width: 1200,
        height: 750,
      },
      phone: {
        src: "/images/landing/cora/copilot-announcement.png",
        alt: "Cora Copilot on mobile drafting a class announcement for a faculty member",
        width: 640,
        height: 1301,
      },
    },
    cta: { label: "Teach with Cora Copilot", href: "/faculty/login" },
  },
  {
    id: "career",
    product: "Cora AI for Career",
    shortLabel: "Career",
    audience: "For career members",
    icon: Briefcase,
    accent: "#38bdf8",
    accentSoft: "rgba(56,189,248,0.14)",
    headline: "Land the interview. Cora handles the grind.",
    description:
      "Career membership turns Cora into your job-search engine: it scores your resume against real job descriptions, flags ATS issues, writes tailored cover letters, and tracks every application.",
    prompt:
      "Cora, match my resume against this job description, show me the evidence behind the score, and draft a tailored cover letter I can review.",
    promptCaption: "Powered by Cora Credits — included with membership.",
    capabilities: [
      "Resume-to-job match scoring with skill-level evidence",
      "ATS readability checks so parsers never drop your resume",
      "Tailored cover letters written from your actual experience",
      "Application pipeline tracking from scan to offer",
      "Semester memberships with monthly Cora Credits built in",
    ],
    device: {
      web: {
        src: "/images/landing/web/web-career-match.png",
        alt: "Cora Career résumé match report on the web showing a 64% score with skill bars and keyword evidence",
        width: 1600,
        height: 1000,
      },
      phone: {
        src: "/images/landing/cora/career-resume-match.png",
        alt: "Résumé Match on mobile with the master résumé, opportunity description, and recent scan scores",
        width: 640,
        height: 1349,
      },
    },
    cta: { label: "Explore career membership", href: "/student/login/guest" },
  },
]

const AGENTIC_LOOP = [
  {
    icon: MessageSquareText,
    title: "You ask",
    desc: "Plain language. One message. As ambitious as you want.",
  },
  {
    icon: Sparkles,
    title: "Cora plans",
    desc: "It reads your live data — grades, lectures, courses — and drafts the work.",
  },
  {
    icon: ShieldCheck,
    title: "You approve",
    desc: "Every change appears as a confirmation card. Nothing saves without you.",
  },
  {
    icon: Zap,
    title: "Cora executes",
    desc: "Flashcards, calendars, announcements, question banks — done in seconds.",
  },
] as const

const TRUST_POINTS = [
  { icon: ShieldCheck, text: "Preview-first — confirmation cards before every change" },
  { icon: Layers, text: "Grounded in your live course and career data" },
  { icon: CalendarCheck, text: "Executes real actions: calendars, decks, publishing" },
  { icon: BadgeCheck, text: "Transparent Cora Credits meter every plan" },
] as const

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

/**
 * Each persona's own web + phone capture in the shared DeviceDuo pairing. Reads
 * as "one product, both surfaces" — the overlapping-phones collage it replaced
 * showed the same app twice and never showed the web experience at all.
 */
function PersonaDeviceShowcase({ persona }: { persona: CoraPersona }) {
  const { web, phone } = persona.device
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const [inView, setInView] = React.useState(false)

  // The tour loops forever, so it must not run while nobody is looking. This
  // observer stays connected and toggles the animation between running and
  // paused; the CSS resumes mid-cycle rather than restarting, so scrolling
  // past and back does not snap the devices to the top of the sequence.
  //
  // Deliberately NOT gated on useLandingMotionEnabled(). That hook exists to
  // hold scroll-triggered work back until after first paint + idle, which an
  // observer on a below-the-fold section already does for free — and its
  // requestIdleCallback never resolves in a background tab, so the gate would
  // silently swallow the tour. Reduced motion is enforced in one place
  // instead: the CSS media query. The class on its own animates nothing.
  React.useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === "undefined") return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1]
        if (entry) setInView(entry.isIntersecting)
      },
      { threshold: 0.25 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // The 30rem cap keeps the art sane on tablets. From lg up the art takes the
  // wider of the two grid columns, which is what actually sizes it — the duo is
  // w-full, so nothing here can grow it while the column stays narrow. At 1440
  // that lifts the laptop from 368px to 442px beside a 477px text column.
  return (
    <div
      ref={rootRef}
      className={`cc-duo-tour relative mx-auto mt-4 w-full max-w-[30rem] select-none sm:mt-0 lg:max-w-none${
        inView ? "" : " cc-duo-tour-idle"
      }`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-6 bottom-0 rounded-full blur-3xl"
        style={{ background: `radial-gradient(closest-side, ${persona.accentSoft}, transparent 72%)` }}
        aria-hidden
      />

      <DeviceDuo
        web={web}
        phone={phone}
        webSizes="(max-width: 640px) 68vw, (max-width: 1024px) 54vw, 500px"
        phoneSizes="(max-width: 640px) 21vw, (max-width: 1024px) 16vw, 150px"
      />
    </div>
  )
}

function PersonaPanel({ persona }: { persona: CoraPersona }) {
  return (
    <div className="grid items-center gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.18fr)] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest"
            style={{ color: persona.accent, backgroundColor: persona.accentSoft }}
          >
            <persona.icon className="h-3.5 w-3.5" aria-hidden />
            {persona.product}
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
            {persona.audience}
          </span>
        </div>

        <h3 className="mt-3 text-xl font-extrabold leading-tight tracking-tight text-white sm:mt-4 sm:text-3xl">
          {persona.headline}
        </h3>
        <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-white/70 sm:mt-3 sm:text-base">
          {persona.description}
        </p>

        <figure className="mt-5 max-w-xl sm:mt-6">
          <blockquote
            className="relative rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.06] px-3.5 py-3 text-[13px] leading-relaxed text-white/90 backdrop-blur-sm sm:px-5 sm:py-3.5 sm:text-sm"
          >
            <span
              className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest"
              style={{ color: persona.accent }}
            >
              <MessageSquareText className="h-3.5 w-3.5" aria-hidden />
              Real prompt
            </span>
            &ldquo;{persona.prompt}&rdquo;
          </blockquote>
          <figcaption className="mt-2 pl-1 text-xs font-medium text-white/50">
            {persona.promptCaption}
          </figcaption>
        </figure>

        {/* Phones show the top 3 capabilities; the rest would push the CTA far below the fold. */}
        <ul className="mt-5 grid gap-2 sm:mt-6 sm:gap-2.5">
          {persona.capabilities.map((capability, index) => (
            <li
              key={capability}
              className={`flex items-start gap-2.5 text-[13px] text-white/80 sm:text-sm ${
                index > 2 ? "hidden sm:flex" : ""
              }`}
            >
              <span
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: persona.accentSoft }}
              >
                <Check className="h-3 w-3" style={{ color: persona.accent }} strokeWidth={3} aria-hidden />
              </span>
              {capability}
            </li>
          ))}
        </ul>

        <Link
          href={persona.cta.href}
          prefetch={false}
          className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-[color-mix(in_srgb,var(--cc-accent-dark)_85%,black)] shadow-[0_10px_40px_-10px_rgba(255,255,255,0.4)] transition-transform hover:scale-[1.03] active:scale-[0.98] sm:mt-7 sm:w-auto sm:py-3"
        >
          {persona.cta.label}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <PersonaDeviceShowcase persona={persona} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export function CoraShowcaseSection() {
  const motionEnabled = useLandingMotionEnabled()
  const [activeId, setActiveId] = React.useState<CoraPersona["id"]>("assistant")
  const activePersona =
    CORA_PERSONAS.find((persona) => persona.id === activeId) ?? CORA_PERSONAS[0]

  return (
    <section
      id="cora"
      className="relative scroll-mt-20 overflow-hidden sm:scroll-mt-24"
      style={{
        background:
          "linear-gradient(165deg, color-mix(in srgb, var(--cc-accent-dark) 32%, #0c0a14) 0%, color-mix(in srgb, var(--cc-accent-dark) 58%, #0c0a14) 45%, color-mix(in srgb, var(--cc-accent-dark) 34%, #0c0a14) 100%)",
      }}
    >
      {/* Ambient glows */}
      <div
        className="pointer-events-none absolute -left-40 top-[-10rem] h-[28rem] w-[28rem] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--cc-accent) 32%, transparent), transparent 70%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-44 bottom-[-8rem] h-[26rem] w-[26rem] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--cc-accent) 16%, transparent), transparent 70%)",
        }}
        aria-hidden
      />

      <div className={`${landingShellClass} relative py-12 sm:py-24`}>
        <motion.div
          initial={motionEnabled ? "hidden" : "show"}
          whileInView="show"
          viewport={LANDING_VIEWPORT}
          variants={sectionHeader}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-bold uppercase tracking-widest text-[color-mix(in_srgb,var(--cc-accent)_40%,white)]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Meet Cora
          </span>
          <h2 className="mt-4 text-[1.65rem] font-extrabold leading-[1.12] tracking-tight text-white sm:text-4xl sm:leading-[1.08] md:text-[2.9rem]">
            The AI that doesn&rsquo;t just answer.
            <span className="block bg-gradient-to-r from-[color-mix(in_srgb,var(--cc-accent)_55%,white)] via-white to-[color-mix(in_srgb,var(--cc-accent)_35%,white)] bg-clip-text text-transparent">
              It gets things done.
            </span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white/70 sm:mt-4 sm:text-lg">
            <span className="sm:hidden">
              Cora plans from your live data, shows you what it will do, and executes the
              moment you approve.
            </span>
            <span className="hidden sm:inline">
              Cora is the agentic engine inside CourseCollab. It plans from your live data,
              shows you exactly what it will do, and executes the moment you approve —
              for students, faculty, and career members.
            </span>
          </p>
        </motion.div>

        {/* Agentic loop */}
        <motion.ol
          initial={motionEnabled ? "hidden" : "show"}
          whileInView="show"
          viewport={LANDING_VIEWPORT}
          variants={staggerContainer}
          className="mt-8 grid grid-cols-2 gap-2.5 sm:mt-14 sm:gap-3 lg:grid-cols-4"
        >
          {AGENTIC_LOOP.map((step, index) => (
            <motion.li
              key={step.title}
              variants={fadeUp}
              className="relative rounded-2xl border border-white/10 bg-white/[0.05] p-3.5 backdrop-blur-sm sm:p-5"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--cc-accent)] to-[var(--cc-accent-dark)] sm:size-10 sm:rounded-xl">
                  <step.icon className="h-4 w-4 text-white sm:h-5 sm:w-5" aria-hidden />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 sm:text-xs">
                  Step {index + 1}
                </span>
              </div>
              <p className="mt-2.5 text-sm font-bold text-white sm:mt-3 sm:text-base">{step.title}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-white/60 sm:text-[13px]">
                {step.desc}
              </p>
            </motion.li>
          ))}
        </motion.ol>

        {/* Persona switcher */}
        <div className="mt-10 sm:mt-16">
          {/* 3-up on phones too — full product names are swapped for short audience labels. */}
          <div
            className="mx-auto flex w-full max-w-2xl gap-1 rounded-full border border-white/10 bg-white/[0.05] p-1.5 backdrop-blur-sm sm:gap-1.5"
            role="tablist"
            aria-label="Cora experiences"
          >
            {CORA_PERSONAS.map((persona) => {
              const isActive = persona.id === activeId
              return (
                <button
                  key={persona.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`cora-panel-${persona.id}`}
                  onClick={() => setActiveId(persona.id)}
                  className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-[13px] font-semibold transition-colors sm:gap-2 sm:px-4 sm:text-sm ${
                    isActive
                      ? "bg-[var(--cc-accent)] text-white shadow-lg"
                      : "text-white/65 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  <persona.icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="whitespace-nowrap sm:hidden">{persona.shortLabel}</span>
                  <span className="hidden whitespace-nowrap sm:inline">{persona.product}</span>
                </button>
              )
            })}
          </div>

          <div
            id={`cora-panel-${activePersona.id}`}
            role="tabpanel"
            className="mt-8 sm:mt-12"
            key={activePersona.id}
          >
            <PersonaPanel persona={activePersona} />
          </div>
        </div>

        {/* Trust strip */}
        <div className="mt-10 grid grid-cols-2 gap-x-3 gap-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:mt-20 sm:gap-3 sm:p-6 lg:grid-cols-4">
          {TRUST_POINTS.map((point) => (
            <div key={point.text} className="flex items-start gap-2 sm:gap-2.5">
              <point.icon
                className="mt-0.5 h-4 w-4 shrink-0 text-[color-mix(in_srgb,var(--cc-accent)_40%,white)] sm:h-[18px] sm:w-[18px]"
                aria-hidden
              />
              <p className="text-[12px] leading-snug text-white/75 sm:text-[13px]">{point.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-7 flex justify-center sm:mt-8">
          <a
            href="#pricing"
            className="inline-flex min-h-[44px] items-center gap-1.5 px-2 text-sm font-semibold text-white/70 transition-colors hover:text-white"
          >
            See plans and Cora Credits
            <ChevronRight className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </div>
    </section>
  )
}
