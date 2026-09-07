"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@/lib/utils"

const HEADLINE_GOLD = "#FBBF24"

type WelcomePhrase = {
  text: string
  ariaLabel: string
  decor?: "succeed"
}

const WELCOME_PHRASES: readonly WelcomePhrase[] = [
  {
    text: "Learn, teach & succeed.",
    ariaLabel: "Learn, teach and succeed.",
    decor: "succeed",
  },
  {
    text: "Meet Cora — AI that acts.",
    ariaLabel: "Meet Cora — AI that acts, not just answers.",
  },
  {
    text: "Code, compile & level up.",
    ariaLabel: "Code, compile and level up in CodeBench.",
  },
  {
    text: "Instant grading. Fast feedback.",
    ariaLabel: "Instant grading with feedback in seconds.",
  },
  {
    text: "Sync grades to Canvas.",
    ariaLabel: "Sync grades to Canvas in one click.",
  },
  {
    text: "Plans, cards & sessions.",
    ariaLabel: "Study plans, flashcards and sessions — one ask away.",
  },
]

const INTERVAL_MS = 3200
const TRANSITION = { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const }

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

function PhraseText({ phrase }: { phrase: WelcomePhrase }) {
  return (
    <span className="desktop-welcome-phrase relative inline-block whitespace-nowrap">
      {phrase.text}
      {phrase.decor === "succeed" ? (
        <>
          <SucceedArcUnderline className="pointer-events-none absolute left-[-2%] top-[88%] h-[0.28em] w-[104%]" />
          <HeadlineSparkles className="pointer-events-none absolute left-[calc(100%+0.12em)] top-[-0.15em] h-[0.55em] w-[0.55em]" />
        </>
      ) : null}
    </span>
  )
}

export function DesktopWelcomeHeadline({ className }: { className?: string }) {
  const [index, setIndex] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(false)

  const phrase = WELCOME_PHRASES[index] ?? WELCOME_PHRASES[0]

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const apply = () => setReduceMotion(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  useEffect(() => {
    if (reduceMotion) return
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % WELCOME_PHRASES.length)
    }, INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [reduceMotion])

  return (
    <div
      className={cn("relative w-full text-center", className)}
      aria-label={phrase.ariaLabel}
      aria-live="polite"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--cc-accent)_18%,transparent)_0%,transparent_70%)] blur-2xl"
      />

      <p className="relative text-[16px] font-medium leading-snug text-[var(--cc-text-secondary)]">
        Everything you need to
      </p>

      <div className="relative mt-1.5 h-[2.125rem] w-full overflow-hidden sm:h-[2.25rem]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={index}
            initial={reduceMotion ? false : { opacity: 0, y: 22, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -18, filter: "blur(4px)" }}
            transition={TRANSITION}
            className="absolute left-1/2 top-0 w-max max-w-none -translate-x-1/2 text-[26px] font-bold leading-none tracking-tight sm:text-[28px]"
          >
            <PhraseText phrase={phrase} />
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
}
