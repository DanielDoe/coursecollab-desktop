"use client"

import { useEffect, useState } from "react"
import {
  Building2,
  ClipboardCheck,
  HandHelping,
  Rocket,
  type LucideIcon,
} from "lucide-react"
import { Card, Eyebrow, SlideShell, SlideTitle, Subhead } from "@/components/pitch/pitch-ui"
import { cn } from "@/lib/utils"

type AdoptionStep = {
  n: string
  title: string
  body: string
  icon: LucideIcon
  tag: string
  details: readonly string[]
}

const STEPS: AdoptionStep[] = [
  {
    n: "01",
    title: "Pilot",
    body: "Launch in a focused set of courses with faculty who are ready to innovate.",
    icon: Rocket,
    tag: "Start focused",
    details: [
      "2–4 gateway or high-impact courses",
      "Volunteer faculty cohort",
      "Defined pilot semester",
      "Shared success criteria upfront",
    ],
  },
  {
    n: "02",
    title: "Support",
    body: "Equip faculty and students so the platform is used well from day one.",
    icon: HandHelping,
    tag: "Enable success",
    details: [
      "Faculty orientation sessions",
      "Course setup & roster sync",
      "Cora & module walkthroughs",
      "Ongoing office-hours support",
    ],
  },
  {
    n: "03",
    title: "Evaluate",
    body: "Measure impact across teaching, learning, and platform usage.",
    icon: ClipboardCheck,
    tag: "Collect evidence",
    details: [
      "Student engagement",
      "Faculty experience",
      "Learning outcomes",
      "AI utilization",
      "Platform usage",
    ],
  },
  {
    n: "04",
    title: "Expand",
    body: "Use pilot results to decide how broadly CourseCollab should scale.",
    icon: Building2,
    tag: "Scale with confidence",
    details: [
      "College-wide rollout plan",
      "Institutional license scope",
      "Multi-department adoption",
      "Sustainable support model",
    ],
  },
]

export function AdoptionSlide() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(true)

  useEffect(() => {
    if (paused) return
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % STEPS.length)
    }, 3800)
    return () => window.clearInterval(id)
  }, [paused])

  const pick = (i: number) => {
    setActive(i)
  }

  const hover = (i: number, on: boolean) => {
    setPaused(on)
    if (on) setActive(i)
  }

  return (
    <SlideShell className="lg:justify-center">
      <Eyebrow>Proposed path</Eyebrow>
      <SlideTitle>A practical path toward adoption</SlideTitle>
      <Subhead>Start with evidence. Expand based on results.</Subhead>

      <div
        className="mt-4 flex min-h-0 flex-1 flex-col gap-4 lg:mt-5 lg:gap-5 xl:gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Desktop — 4 columns: node + card locked together */}
        <div className="relative hidden min-h-[min(40vh,360px)] flex-1 lg:grid lg:grid-cols-4 lg:gap-4 lg:min-h-[min(44vh,420px)] xl:min-h-[min(48vh,500px)] xl:gap-5 2xl:min-h-[min(52vh,580px)] 2xl:gap-6">
          <div className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-[1.625rem] h-px bg-white/10 xl:top-[1.875rem] 2xl:top-[2.125rem]" />
          <div
            className="pointer-events-none absolute left-[12.5%] top-[1.625rem] h-0.5 bg-gradient-to-r from-[#EAAA00] to-[#F6D56A] transition-[width] duration-700 ease-out xl:top-[1.875rem] 2xl:top-[2.125rem]"
            style={{ width: `${(active / (STEPS.length - 1)) * 75}%` }}
          />

          {STEPS.map((item, i) => (
            <div key={item.n} className="flex h-full min-h-0 flex-col items-center">
              <StepNode
                item={item}
                index={i}
                active={active}
                onPick={() => pick(i)}
                onHover={(on) => hover(i, on)}
              />
              <StepCard
                item={item}
                index={i}
                active={active}
                onPick={() => pick(i)}
                onHover={(on) => hover(i, on)}
                className="mt-4 w-full flex-1 xl:mt-5"
              />
            </div>
          ))}
        </div>

        {/* Mobile — vertical stepper, strict 01 → 04 order */}
        <div className="flex min-h-0 flex-1 flex-col lg:hidden">
          {STEPS.map((item, i) => (
            <div key={item.n} className="flex gap-3">
              <div className="flex w-10 shrink-0 flex-col items-center">
                <StepNode
                  item={item}
                  index={i}
                  active={active}
                  compact
                  onPick={() => pick(i)}
                  onHover={(on) => hover(i, on)}
                />
                {i < STEPS.length - 1 ? (
                  <div
                    className={cn(
                      "my-1 w-0.5 flex-1 min-h-[1.25rem] rounded-full transition-colors duration-500",
                      i < active ? "bg-[#EAAA00]/70" : "bg-white/10",
                    )}
                  />
                ) : null}
              </div>
              <StepCard
                item={item}
                index={i}
                active={active}
                onPick={() => pick(i)}
                onHover={(on) => hover(i, on)}
                className="mb-3 flex-1"
                compact
              />
            </div>
          ))}
        </div>

        <Card className="relative shrink-0 overflow-hidden border-[#EAAA00]/35 bg-gradient-to-br from-[#EAAA00]/12 via-[#EAAA00]/6 to-transparent p-4 sm:p-5 xl:p-6 2xl:p-7">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#EAAA00] xl:text-[13px] 2xl:text-[14px]">
            Proposed next step
          </p>
          <p className="mt-1.5 font-sans text-xl font-extrabold leading-snug tracking-tight text-white sm:text-2xl xl:text-[1.85rem] 2xl:text-[2.35rem]">
            Launch a College-level CourseCollab pilot with interested faculty and students.
          </p>
          <p className="mt-3 max-w-5xl text-[15px] leading-relaxed text-white/65 sm:text-[16px] xl:text-[18px] 2xl:text-[20px]">
            Use the pilot to establish instructional value, research opportunities, support
            requirements, and the pathway toward a broader institutional license.
          </p>
        </Card>
      </div>
    </SlideShell>
  )
}

function StepNode({
  item,
  index,
  active,
  compact,
  onPick,
  onHover,
}: {
  item: AdoptionStep
  index: number
  active: number
  compact?: boolean
  onPick: () => void
  onHover: (on: boolean) => void
}) {
  const lit = index <= active
  const current = index === active

  return (
    <button
      type="button"
      onClick={onPick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      aria-current={current ? "step" : undefined}
      className={cn(
        "relative z-10 flex shrink-0 items-center justify-center rounded-full border-2 font-bold transition-all duration-500",
        compact ? "h-9 w-9 text-[11px]" : "h-11 w-11 text-sm xl:h-12 xl:w-12 xl:text-[15px] 2xl:h-14 2xl:w-14 2xl:text-base",
        lit
          ? "border-[#EAAA00] bg-[#EAAA00] text-[#1e1033] shadow-[0_0_24px_rgba(234,170,0,0.4)]"
          : "border-white/20 bg-[#120c1c] text-white/45",
        current && "pitch-adoption-node-active scale-110",
      )}
    >
      {item.n}
    </button>
  )
}

function StepCard({
  item,
  index,
  active,
  compact,
  className,
  onPick,
  onHover,
}: {
  item: AdoptionStep
  index: number
  active: number
  compact?: boolean
  className?: string
  onPick: () => void
  onHover: (on: boolean) => void
}) {
  const current = index === active

  return (
    <button
      type="button"
      onClick={onPick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={cn(
        "pitch-rise pitch-card-shine flex flex-col rounded-2xl border text-left transition-all duration-500",
        compact ? "p-3.5 sm:p-4" : "h-full min-h-[180px] p-4 lg:min-h-0 xl:p-5 2xl:p-7",
        current
          ? "border-[#EAAA00]/50 bg-[#EAAA00]/10 shadow-[0_16px_40px_-24px_rgba(234,170,0,0.55)]"
          : "border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.05]",
        className,
      )}
      style={{ animationDelay: `${60 + index * 70}ms` }}
    >
      <div className="mb-2 flex items-start justify-between gap-2 xl:mb-4 2xl:mb-5">
        <div
          className={cn(
            "flex items-center justify-center rounded-xl transition-colors duration-500",
            compact ? "h-9 w-9" : "h-10 w-10 xl:h-12 xl:w-12 2xl:h-14 2xl:w-14",
            current ? "bg-[#EAAA00]/20 text-[#F6D56A]" : "bg-white/5 text-[#EAAA00]/70",
          )}
        >
          <item.icon
            className={
              compact ? "h-4 w-4" : "h-5 w-5 xl:h-6 xl:w-6 2xl:h-7 2xl:w-7"
            }
          />
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] xl:px-2.5 xl:py-1 xl:text-[11px] 2xl:text-[12px]",
            current ? "bg-[#EAAA00]/20 text-[#F6D56A]" : "bg-white/5 text-white/35",
          )}
        >
          {item.tag}
        </span>
      </div>

      <p
        className={cn(
          "font-sans font-extrabold tracking-tight text-white",
          compact ? "text-lg" : "text-xl xl:text-[1.65rem] 2xl:text-[2rem]",
        )}
      >
        {item.title}
      </p>
      <p
        className={cn(
          "mt-1 leading-snug text-white/58 xl:mt-2",
          compact
            ? "text-[14px] sm:text-[15px]"
            : "text-[15px] sm:text-[16px] xl:text-[18px] 2xl:text-[20px]",
        )}
      >
        {item.body}
      </p>

      {item.details.length > 0 ? (
        <div className={cn("mt-auto flex flex-wrap gap-1.5", compact ? "pt-2" : "pt-4 xl:pt-5")}>
          {item.details.map((detail) => (
            <span
              key={detail}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[10px] sm:text-[11px] xl:text-[13px] 2xl:px-3 2xl:py-1 2xl:text-[14px]",
                current
                  ? "border-[#EAAA00]/30 bg-[#EAAA00]/10 text-[#F6D56A]/90"
                  : "border-white/10 text-white/45",
              )}
            >
              {detail}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  )
}
