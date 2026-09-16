"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  Bot,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Code2,
  CircuitBoard,
  GraduationCap,
  Library,
  Sparkles,
  Trophy,
  Zap,
  Menu,
  X,
} from "lucide-react"
import { CourseCollabLogo } from "@/components/course-collab-logo"
import { DeviceDuo } from "@/components/landing/device-frames"
import { HeroStoryVideo } from "@/components/landing/HeroStoryVideo"
import { motion } from "@/components/landing/framer"
import { fadeUp, LANDING_VIEWPORT } from "@/components/landing/landing-motion"
import { useLandingMotionEnabled } from "@/components/landing/LandingMotionProvider"
import { SummerSeasonBanner } from "@/components/summer-camp/SummerSeasonBanner"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel"

import {
  landingHashHref,
  landingPrimaryButtonClass,
  landingSecondaryButtonClass,
  landingShellClass,
} from "@/components/landing/landing-section-layout"

const HEADLINE_GOLD = "#FBBF24"

const NAV = [
  { label: "Cora", href: "#cora", dropdown: false },
  { label: "Features", href: "#features", dropdown: true },
  { label: "Solutions", href: "#solutions", dropdown: true },
  { label: "Institutions", href: "/institutions", dropdown: false },
  { label: "Career", href: "#career", dropdown: false },
  { label: "About", href: "#about", dropdown: false },
  { label: "Pricing", href: "#pricing", dropdown: false },
] as const

/**
 * Sections rendered desktop-only (see app/page.tsx). Their anchors are dropped
 * from the mobile menu so no link scrolls to nothing.
 */
export const MOBILE_HIDDEN_ANCHORS = new Set([
  "#platform",
  "#how-it-works",
  "#summer-camp",
  "#about",
])

const MOBILE_NAV = NAV.filter((item) => !MOBILE_HIDDEN_ANCHORS.has(item.href))

type FeatureHighlight = {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  title: string
  desc: string
}

const FEATURE_HIGHLIGHTS: FeatureHighlight[] = [
  { icon: Bot, title: "Cora AI 24/7", desc: "Agentic help that acts" },
  { icon: BookOpen, title: "Practice Hub", desc: "Labs, quizzes & more" },
  { icon: Code2, title: "CodeBench C++", desc: "Compile, run & improve" },
  { icon: CircuitBoard, title: "Circuit labs", desc: "Textbook-aligned labs" },
  { icon: Trophy, title: "Leaderboards", desc: "Gamified learning" },
  { icon: Zap, title: "Instant grading", desc: "Feedback in seconds" },
  { icon: ClipboardList, title: "Timed quizzes", desc: "Assessments made easy" },
  { icon: Library, title: "Question bank", desc: "Reuse & verify items" },
  { icon: BarChart3, title: "Progress analytics", desc: "Track performance & grow" },
  { icon: GraduationCap, title: "Canvas export", desc: "Sync grades easily" },
]

const HEADER_H = "h-16 sm:h-[4.25rem]"

type HeadlineSegment = {
  text: string
  purple?: boolean
  breakAfter?: boolean
  /** Decorative underline + sparkles (hero "Succeed." only) */
  decor?: "succeed"
}

type TypewriterHeadline = {
  segments: readonly HeadlineSegment[]
  ariaLabel: string
}

const HERO_HEADLINE_SEGMENTS: readonly HeadlineSegment[] = [
  { text: "Everything You Need", breakAfter: true },
  { text: "to " },
  { text: "Learn, Teach &", purple: true },
  { text: " " },
  { text: "Succeed.", purple: true, decor: "succeed" },
]

/** Rotating hero lines — similar length to the opener for a stable layout */
const TYPEWRITER_HEADLINES: readonly TypewriterHeadline[] = [
  {
    segments: HERO_HEADLINE_SEGMENTS,
    ariaLabel: "Everything You Need to Learn, Teach & Succeed.",
  },
  {
    segments: [
      { text: "Meet Cora — AI That", breakAfter: true },
      { text: "Acts,", purple: true },
      { text: " Not Just " },
      { text: "Answers.", purple: true },
    ],
    ariaLabel: "Meet Cora — AI That Acts, Not Just Answers.",
  },
  {
    segments: [
      { text: "Cora Plans. You", breakAfter: true },
      { text: " " },
      { text: "Approve.", purple: true },
      { text: " It " },
      { text: "Executes.", purple: true },
    ],
    ariaLabel: "Cora Plans. You Approve. It Executes.",
  },
  {
    segments: [
      { text: "Study Plans, Cards &", breakAfter: true },
      { text: "Sessions — " },
      { text: "One Ask.", purple: true },
    ],
    ariaLabel: "Study Plans, Cards & Sessions — One Ask.",
  },
  {
    segments: [
      { text: "Code, Compile &", breakAfter: true },
      { text: " " },
      { text: "Level Up", purple: true },
      { text: " in CodeBench." },
    ],
    ariaLabel: "Code, Compile & Level Up in CodeBench.",
  },
  {
    segments: [
      { text: "Instant Grading.", breakAfter: true },
      { text: "Feedback in " },
      { text: "Seconds.", purple: true },
    ],
    ariaLabel: "Instant Grading. Feedback in Seconds.",
  },
  {
    segments: [
      { text: "Circuit Labs &", breakAfter: true },
      { text: "Textbook-" },
      { text: "Aligned", purple: true },
      { text: " Practice." },
    ],
    ariaLabel: "Circuit Labs & Textbook-Aligned Practice.",
  },
  {
    segments: [
      { text: "Climb the", breakAfter: true },
      { text: " " },
      { text: "Leaderboard.", purple: true },
      { text: " Compete & Win." },
    ],
    ariaLabel: "Climb the Leaderboard. Compete & Win.",
  },
  {
    segments: [
      { text: "Practice Hub &", breakAfter: true },
      { text: "Labs That " },
      { text: "Stick.", purple: true },
    ],
    ariaLabel: "Practice Hub & Labs That Stick.",
  },
  {
    segments: [
      { text: "Sync Grades to", breakAfter: true },
      { text: " " },
      { text: "Canvas.", purple: true },
      { text: " One Click." },
    ],
    ariaLabel: "Sync Grades to Canvas. One Click.",
  },
]

function headlineFullText(headline: TypewriterHeadline): string {
  return headline.segments.map((s) => s.text).join("")
}

function headlineLine1Length(headline: TypewriterHeadline): number {
  const firstBreak = headline.segments.find((s) => s.breakAfter)
  if (firstBreak) return firstBreak.text.length
  return headline.segments[0]?.text.length ?? 0
}

function HeadlineSparkles({ className }: { className?: string }) {
  return (
    <span className={`inline-block ${className ?? ""}`} aria-hidden>
      <svg viewBox="0 0 44 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
        <path
          fill={HEADLINE_GOLD}
          d="M14 2.5c.35 3.2 1.7 4.55 4.9 4.9-3.2.35-4.55 1.7-4.9 4.9-.35-3.2-1.7-4.55-4.9-4.9 3.2-.35 4.55-1.7 4.9-4.9Z"
        />
        <path
          fill={HEADLINE_GOLD}
          d="M10 18.5c.4 3.6 1.9 5.1 5.5 5.5-3.6.4-5.1 1.9-5.5 5.5-.4-3.6-1.9-5.1-5.5-5.5 3.6-.4 5.1-1.9 5.5-5.5Z"
        />
        <path
          fill={HEADLINE_GOLD}
          d="M31 4c.55 5.8 2.9 8.15 8.7 8.7-5.8.55-8.15 2.9-8.7 8.7-.55-5.8-2.9-8.15-8.7-8.7 5.8-.55 8.15-2.9 8.7-8.7Z"
        />
      </svg>
    </span>
  )
}

function SucceedArcUnderline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 180 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      preserveAspectRatio="none"
    >
      <path
        d="M4 12.5C28 6.5 58 3.8 90 4.2c32 .4 60 4.2 86 9.8"
        stroke={HEADLINE_GOLD}
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function renderSegmentSlice(
  segment: HeadlineSegment,
  index: number,
  slice: string,
  showDecor: boolean,
) {
  if (!slice) return null

  if (segment.purple) {
    if (segment.decor === "succeed") {
      return (
        <span key={`purple-${index}`} className="text-[var(--cc-accent)]">
          <span className="relative inline-block">
            {slice}
            {showDecor && slice === segment.text ? (
              <>
                <SucceedArcUnderline className="pointer-events-none absolute left-[-2%] top-[88%] h-[0.32em] w-[104%] sm:top-[90%] sm:h-[0.38em]" />
                <HeadlineSparkles className="pointer-events-none absolute left-[calc(100%+0.1em)] top-[-0.18em] h-[0.58em] w-[0.58em] sm:left-[calc(100%+0.18em)] sm:top-[-0.2em] sm:h-[0.68em] sm:w-[0.68em]" />
              </>
            ) : null}
          </span>
        </span>
      )
    }

    return (
        <span key={`purple-${index}`} className="text-[var(--cc-accent)]">
        {slice}
      </span>
    )
  }

  return slice
}

function renderLineSegments(
  segments: readonly HeadlineSegment[],
  fromIndex: number,
  charCount: number,
  showDecor: boolean,
) {
  let remaining = charCount
  const nodes: React.ReactNode[] = []

  for (let index = fromIndex; index < segments.length; index += 1) {
    const segment = segments[index]
    if (remaining <= 0) break

    const slice = segment.text.slice(0, remaining)
    remaining -= slice.length
    const content = renderSegmentSlice(segment, index, slice, showDecor)
    if (content) nodes.push(<React.Fragment key={`segment-${index}`}>{content}</React.Fragment>)
  }

  return nodes
}

function TypewriterCursor() {
  return (
    <span
      className="hero-typewriter-cursor ml-0.5 inline-block w-[3px] bg-[var(--cc-accent)] align-text-bottom sm:ml-1"
      style={{ height: "0.92em" }}
      aria-hidden
    />
  )
}

function renderHeadlineSegments(
  headline: TypewriterHeadline,
  charCount: number,
  showDecor: boolean,
  showCursor: boolean,
) {
  const line1Length = headlineLine1Length(headline)
  const line1Chars = Math.min(charCount, line1Length)
  const line2Chars = Math.max(0, charCount - line1Length)
  const cursorOnLine1 = showCursor && charCount <= line1Length
  const cursorOnLine2 = showCursor && charCount > line1Length
  const line1Text = headline.segments[0]?.text ?? ""

  return (
    <>
      <span className="block">
        {line1Text.slice(0, line1Chars)}
        {cursorOnLine1 ? <TypewriterCursor /> : null}
      </span>
      {line2Chars > 0 || showDecor ? (
        <span className="block">
          {/* Wraps on phones — the longest lines overflow a 360px viewport at one line. */}
          <span className="inline-block whitespace-normal pr-[0.4em] sm:whitespace-nowrap sm:pr-[0.9em]">
            {renderLineSegments(headline.segments, 1, line2Chars, showDecor)}
            {cursorOnLine2 ? <TypewriterCursor /> : null}
          </span>
        </span>
      ) : null}
    </>
  )
}

const TYPE_MS = 52
const DELETE_MS = 28
const HOLD_MS = 2400
const BETWEEN_MS = 420

function HeroTypewriterHeadline() {
  const [mounted, setMounted] = React.useState(false)
  const [headlineIndex, setHeadlineIndex] = React.useState(0)
  const [charCount, setCharCount] = React.useState(0)
  const [isPaused, setIsPaused] = React.useState(false)
  const timerRef = React.useRef<number | null>(null)

  const currentHeadline = TYPEWRITER_HEADLINES[headlineIndex] ?? TYPEWRITER_HEADLINES[0]
  const fullLength = headlineFullText(currentHeadline).length
  const isHeroHeadline = headlineIndex === 0
  const done = mounted && charCount >= fullLength && isPaused

  React.useEffect(() => {
    setMounted(true)

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const finishStatic = () => {
      clearTimer()
      setHeadlineIndex(0)
      setCharCount(headlineFullText(TYPEWRITER_HEADLINES[0]).length)
      setIsPaused(true)
    }

    if (mq.matches) {
      finishStatic()
      return
    }

    let index = 0
    let count = 0
    let phase: "type" | "hold" | "delete" = "type"

    const schedule = (fn: () => void, delay: number) => {
      timerRef.current = window.setTimeout(fn, delay)
    }

    const sync = () => {
      setHeadlineIndex(index)
      setCharCount(count)
      setIsPaused(phase === "hold")
    }

    const tick = () => {
      const headline = TYPEWRITER_HEADLINES[index] ?? TYPEWRITER_HEADLINES[0]
      const len = headlineFullText(headline).length

      if (phase === "type") {
        count += 1
        sync()
        if (count >= len) {
          phase = "hold"
          schedule(tick, HOLD_MS)
        } else {
          schedule(tick, TYPE_MS)
        }
        return
      }

      if (phase === "hold") {
        phase = "delete"
        schedule(tick, DELETE_MS)
        return
      }

      count -= 1
      sync()
      if (count <= 0) {
        index = (index + 1) % TYPEWRITER_HEADLINES.length
        phase = "type"
        schedule(tick, BETWEEN_MS)
      } else {
        schedule(tick, DELETE_MS)
      }
    }

    schedule(tick, 180)

    const onMotionChange = () => {
      if (mq.matches) finishStatic()
    }
    mq.addEventListener("change", onMotionChange)

    return () => {
      clearTimer()
      mq.removeEventListener("change", onMotionChange)
    }
  }, [])

  return (
    <h1
      className="mx-auto mt-3 flex h-[3.5em] max-w-3xl flex-col justify-center overflow-visible text-[1.65rem] font-extrabold leading-[1.1] tracking-tight text-[var(--cc-text)] max-[360px]:text-[1.5rem] sm:mt-6 sm:h-[2.35em] sm:text-[2.6rem] sm:leading-[1.06] lg:mx-0 lg:text-[2.8rem] xl:text-[3.05rem]"
      aria-label={
        charCount >= fullLength
          ? currentHeadline.ariaLabel
          : "CourseCollab — modern learning platform"
      }
      aria-live="off"
      suppressHydrationWarning
    >
      {mounted
        ? renderHeadlineSegments(
            currentHeadline,
            charCount,
            done && isHeroHeadline,
            !isPaused,
          )
        : null}
    </h1>
  )
}

function FeatureHighlightItem({ feature }: { feature: FeatureHighlight }) {
  const Icon = feature.icon
  return (
    <div className="flex items-start gap-2.5 text-left sm:gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--cc-accent-soft)] sm:size-10">
        <Icon className="h-4 w-4 text-[var(--cc-accent)] sm:h-[18px] sm:w-[18px]" strokeWidth={2.25} />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="whitespace-nowrap text-[13px] font-bold leading-tight text-[var(--cc-text)] sm:text-sm">
          {feature.title}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--cc-text-secondary)] sm:text-xs">{feature.desc}</p>
      </div>
    </div>
  )
}

function FeatureHighlightsStrip({ features }: { features: FeatureHighlight[] }) {
  const motionEnabled = useLandingMotionEnabled()
  const [api, setApi] = React.useState<CarouselApi>()
  const [paused, setPaused] = React.useState(false)

  React.useEffect(() => {
    if (!api || !motionEnabled || paused) return
    const id = window.setInterval(() => api.scrollNext(), 2600)
    return () => window.clearInterval(id)
  }, [api, motionEnabled, paused])

  if (!motionEnabled) {
    return (
      <ul className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {features.map((feature) => (
          <li key={feature.title} className="w-[11.5rem] shrink-0 snap-start sm:w-[12.5rem]">
            <FeatureHighlightItem feature={feature} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false)
      }}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[var(--cc-background)] via-[var(--cc-background)] to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[var(--cc-background)] via-[var(--cc-background)] to-transparent"
        aria-hidden
      />
      <Carousel
        setApi={setApi}
        opts={{ align: "start", loop: true, dragFree: false }}
        className="w-full"
        aria-label="Platform feature highlights"
      >
        <CarouselContent className="-ml-4">
          {features.map((feature) => (
            <CarouselItem
              key={feature.title}
              className="basis-[68%] pl-4 sm:basis-[38%] md:basis-[28%] lg:basis-[20%]"
            >
              <FeatureHighlightItem feature={feature} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  )
}

export function LandingMarketingHeader() {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--border)] bg-[var(--cc-background)] shadow-sm">
      <div className={`${landingShellClass} ${HEADER_H}`}>
        <div className="flex h-full items-center gap-3 sm:gap-6">
          <Link
            href="/"
            className="flex shrink-0 items-center hover:opacity-90 transition-opacity"
            onClick={() => setIsMenuOpen(false)}
          >
            <CourseCollabLogo size="sm" withWordmark className="max-[380px]:scale-95 max-[380px]:origin-left sm:scale-100" />
          </Link>

          <nav
            className="hidden lg:flex flex-1 items-center justify-center gap-0.5 xl:gap-1"
            aria-label="Primary"
          >
            {NAV.map((item) => {
              const href = landingHashHref(pathname, item.href)
              const className =
                "inline-flex items-center gap-1 rounded-lg px-2.5 xl:px-3.5 py-2 text-[13px] xl:text-[15px] font-semibold text-[var(--cc-text-secondary)] hover:bg-[var(--cc-accent-soft)] hover:text-[var(--cc-accent)] transition-colors"
              const inner = (
                <>
                  {item.label}
                  {item.dropdown ? (
                    <ChevronDown className="h-3.5 w-3.5 text-[var(--cc-text-muted)]" aria-hidden />
                  ) : null}
                </>
              )
              if (href.startsWith("/")) {
                return (
                  <Link key={item.label} href={href} className={className}>
                    {inner}
                  </Link>
                )
              }
              return (
                <a key={item.label} href={href} className={className}>
                  {inner}
                </a>
              )
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--cc-surface)_82%,transparent)] p-1">
              <Link
                href="/student/login"
                prefetch={false}
                className="inline-flex min-h-[40px] items-center rounded-full bg-[var(--cc-accent)] px-3.5 py-2 text-xs font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] sm:px-4 sm:text-sm"
              >
                Student
              </Link>
              <Link
                href="/faculty/login"
                prefetch={false}
                className="inline-flex min-h-[40px] items-center rounded-full px-3.5 py-2 text-xs font-semibold text-[var(--cc-text-secondary)] hover:bg-[var(--cc-accent-soft)] hover:text-[var(--cc-accent)] transition-colors sm:px-4 sm:text-sm"
              >
                Faculty
              </Link>
              <Link
                href="/institution/login"
                prefetch={false}
                className="hidden min-[480px]:inline-flex min-h-[40px] items-center rounded-full px-3.5 py-2 text-xs font-semibold text-[var(--cc-text-secondary)] hover:bg-[var(--cc-accent-soft)] hover:text-[var(--cc-accent)] transition-colors sm:px-4 sm:text-sm"
              >
                Institution
              </Link>
            </div>

            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--cc-surface)_82%,transparent)] text-[var(--cc-accent)] lg:hidden"
              aria-expanded={isMenuOpen}
              aria-controls="landing-mobile-nav"
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen ? (
        <div
          id="landing-mobile-nav"
          className="border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--cc-background)_95%,transparent)] backdrop-blur-2xl lg:hidden"
        >
          <nav className={`${landingShellClass} flex flex-col gap-1 py-3`} aria-label="Mobile">
            {MOBILE_NAV.map((item) => {
              const href = landingHashHref(pathname, item.href)
              const className =
                "flex min-h-[48px] items-center rounded-xl px-3 text-[15px] font-semibold text-[var(--cc-text-secondary)] hover:bg-[var(--cc-accent-soft)] hover:text-[var(--cc-accent)]"
              if (href.startsWith("/")) {
                return (
                  <Link
                    key={item.label}
                    href={href}
                    className={className}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                )
              }
              return (
                <a
                  key={item.label}
                  href={href}
                  className={className}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </a>
              )
            })}
            <Link
              href="/institutions/request-demo"
              className="mt-1 flex min-h-[48px] items-center justify-center rounded-xl bg-[var(--cc-accent-dark)] px-3 text-[15px] font-semibold text-white"
              onClick={() => setIsMenuOpen(false)}
            >
              Book a demo
            </Link>
            <Link
              href="/institution/login"
              className="flex min-h-[48px] items-center justify-center rounded-xl border border-[var(--border)] px-3 text-[15px] font-semibold text-[var(--cc-accent)]"
              onClick={() => setIsMenuOpen(false)}
            >
              Institution sign in
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  )
}

function HeroCoraShowcase() {
  const motionEnabled = useLandingMotionEnabled()

  return (
    <motion.div
      initial={motionEnabled ? "hidden" : "show"}
      whileInView="show"
      viewport={LANDING_VIEWPORT}
      variants={fadeUp}
      className="relative mx-auto hidden w-full max-w-[30rem] select-none lg:block"
      aria-hidden={false}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-8 bottom-0 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--cc-accent) 22%, transparent), transparent 72%)",
        }}
        aria-hidden
      />

      <DeviceDuo
        web={{
          src: "/images/landing/web/web-cora-assistant.png",
          alt: "Cora Assistant on the web proposing a flashcard deck with a confirmation card",
          width: 1600,
          height: 1000,
        }}
        phone={{
          src: "/images/landing/cora/assistant-home.png",
          alt: "Cora mobile home screen greeting a student with credits and suggested course actions",
          width: 640,
          height: 1301,
        }}
        priority
        webSizes="380px"
        phoneSizes="115px"
      />

      <div className="absolute right-0 top-2 z-20 flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--cc-surface)] px-3.5 py-2.5 shadow-[0_16px_40px_-16px_rgba(30,15,60,0.4)]">
        <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
        <p className="text-xs font-bold text-[var(--cc-text)]">
          Flashcards created
          <span className="block text-[10px] font-medium text-[var(--cc-text-muted)]">
            12 cards · weakest topics
          </span>
        </p>
      </div>

      <div className="absolute -bottom-6 right-0 z-20 flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--cc-surface)] px-3.5 py-2.5 shadow-[0_16px_40px_-16px_rgba(30,15,60,0.4)]">
        <CalendarCheck className="h-4 w-4 text-[var(--cc-accent)]" aria-hidden />
        <p className="text-xs font-bold text-[var(--cc-text)]">
          3 study sessions booked
          <span className="block text-[10px] font-medium text-[var(--cc-text-muted)]">
            Added to your calendar
          </span>
        </p>
      </div>
    </motion.div>
  )
}

export function LandingHero() {
  const motionEnabled = useLandingMotionEnabled()

  return (
    <section className="relative bg-[var(--cc-background)] pt-16 sm:pt-[4.25rem]">
      <div className="relative z-30 hidden md:block">
        <SummerSeasonBanner variant="strip" />
      </div>

      <div className={`${landingShellClass} pb-8 pt-6 sm:pb-12 sm:pt-14 md:pb-8`}>
        <div className="grid items-center gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-6">
          <div className="text-center lg:text-left">
            <a
              href="#cora"
              className="mx-auto inline-flex min-h-[36px] items-center gap-2 rounded-full border border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)] px-3.5 py-1.5 text-[11px] font-semibold text-[var(--cc-accent)] transition-colors hover:border-[var(--cc-accent)] sm:px-3.5 sm:py-1.5 sm:text-sm lg:mx-0"
            >
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
              The agentic LMS — powered by Cora
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </a>

            <HeroTypewriterHeadline />

            <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--cc-text-secondary)] sm:mt-5 sm:text-lg lg:mx-0">
              <span className="sm:hidden">
                The all-in-one platform for modern education — with Cora, an agentic AI that
                plans, creates, and executes from your live course data. You approve, it executes.
              </span>
              <span className="hidden sm:inline">
                The all-in-one platform for modern education — with Cora, an agentic AI
                that builds study plans, flashcards, announcements, and question banks
                from your live data. You approve, it executes.
              </span>
            </p>

            {/* Phones: two-up so both entry points stay above the fold. */}
            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-8 sm:flex sm:flex-row sm:items-center sm:justify-center sm:gap-4 lg:justify-start">
              <Link
                href="/student/login"
                prefetch={false}
                className={`${landingPrimaryButtonClass} w-full min-h-[48px] px-4 shadow-[0_12px_40px_-12px_color-mix(in_srgb,var(--cc-accent)_45%,transparent)] sm:w-auto sm:px-7`}
              >
                Student login
                <ChevronRight className="hidden h-4 w-4 sm:block" />
              </Link>
              <Link
                href="/faculty/login"
                prefetch={false}
                className={`${landingSecondaryButtonClass} w-full min-h-[48px] px-4 sm:w-auto sm:px-7`}
              >
                Faculty login
                <ChevronRight className="hidden h-4 w-4 sm:block" />
              </Link>
            </div>

            <a
              href="#cora"
              className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-[var(--cc-accent)] transition-opacity hover:opacity-80"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              See what Cora can do
            </a>
          </div>

          <HeroCoraShowcase />
        </div>

        <div className="mt-7 w-full sm:mt-12">
          <FeatureHighlightsStrip features={FEATURE_HIGHLIGHTS} />
        </div>
      </div>

      <div className={`${landingShellClass} hidden pb-14 md:block sm:pb-20`}>
        <motion.div
          initial={motionEnabled ? "hidden" : "show"}
          whileInView="show"
          viewport={LANDING_VIEWPORT}
          variants={fadeUp}
          className="relative aspect-[16/10] overflow-hidden rounded-2xl shadow-[0_30px_80px_-30px_rgba(15,23,42,0.35)] ring-1 ring-[var(--border)] sm:aspect-[21/9] sm:rounded-[2rem]"
        >
          <HeroStoryVideo />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/[0.04] via-transparent to-black/[0.14]"
            aria-hidden
          />
        </motion.div>
      </div>
    </section>
  )
}
