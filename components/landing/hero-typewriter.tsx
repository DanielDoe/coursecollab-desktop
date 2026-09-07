"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const HEADLINE_GOLD = "#FBBF24"

type HeadlineSegment = {
  text: string
  purple?: boolean
  breakAfter?: boolean
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
    <span className={cn("inline-block", className)} aria-hidden>
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
  compact: boolean,
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
                <SucceedArcUnderline
                  className={cn(
                    "pointer-events-none absolute left-[-2%] top-[88%] h-[0.32em] w-[104%]",
                    !compact && "sm:top-[90%] sm:h-[0.38em]",
                  )}
                />
                <HeadlineSparkles
                  className={cn(
                    "pointer-events-none absolute left-[calc(100%+0.1em)] top-[-0.18em] h-[0.58em] w-[0.58em]",
                    !compact && "sm:left-[calc(100%+0.18em)] sm:top-[-0.2em] sm:h-[0.68em] sm:w-[0.68em]",
                  )}
                />
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
  compact: boolean,
) {
  let remaining = charCount
  const nodes: React.ReactNode[] = []

  for (let index = fromIndex; index < segments.length; index += 1) {
    const segment = segments[index]
    if (remaining <= 0) break

    const slice = segment.text.slice(0, remaining)
    remaining -= slice.length
    const content = renderSegmentSlice(segment, index, slice, showDecor, compact)
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
  compact: boolean,
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
          <span
            className={cn(
              "inline-block whitespace-normal",
              compact ? "pr-[0.25em]" : "pr-[0.4em] sm:whitespace-nowrap sm:pr-[0.9em]",
            )}
          >
            {renderLineSegments(headline.segments, 1, line2Chars, showDecor, compact)}
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

export type HeroTypewriterHeadlineProps = {
  className?: string
  /** Compact sizing for desktop auth welcome (~360px column). */
  variant?: "hero" | "compact"
}

export function HeroTypewriterHeadline({
  className,
  variant = "hero",
}: HeroTypewriterHeadlineProps) {
  const compact = variant === "compact"
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
      className={cn(
        compact
          ? "mx-auto flex h-[2.65em] w-full max-w-[20rem] flex-col justify-center overflow-visible text-center text-[15px] font-bold leading-[1.15] tracking-tight text-[var(--cc-text)]"
          : "mx-auto mt-3 flex h-[3.5em] max-w-3xl flex-col justify-center overflow-visible text-[1.65rem] font-extrabold leading-[1.1] tracking-tight text-[var(--cc-text)] max-[360px]:text-[1.5rem] sm:mt-6 sm:h-[2.35em] sm:text-[2.6rem] sm:leading-[1.06] lg:mx-0 lg:text-[2.8rem] xl:text-[3.05rem]",
        className,
      )}
      aria-label={
        charCount >= fullLength
          ? currentHeadline.ariaLabel
          : "CourseCollab — modern learning platform"
      }
      aria-live="off"
      suppressHydrationWarning
    >
      {mounted
        ? renderHeadlineSegments(currentHeadline, charCount, done && isHeroHeadline, !isPaused, compact)
        : null}
    </h1>
  )
}
