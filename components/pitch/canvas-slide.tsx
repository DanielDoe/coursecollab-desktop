"use client"

import { useEffect, useState } from "react"
import { Layers, Plus, Sparkles } from "lucide-react"
import { Eyebrow, SlideShell, SlideTitle, Subhead, Thesis } from "@/components/pitch/pitch-ui"
import { cn } from "@/lib/utils"

const ROWS = [
  ["Institutional Learning Management System", "AI enabled teaching and learning environment"],
  ["Course organization and administration", "Active learning and continuous engagement"],
  ["Content distribution", "Integrated learning and practice"],
  ["Assignment collection", "Practice, programming, and problem solving"],
  ["Gradebook and records", "Learning progress and support"],
  ["Institutional integrations", "Course-aware AI assistance"],
  ["Broad LMS infrastructure", "Faculty and student AI workflows"],
] as const

const FUSION_LINES = [
  "Canvas handles the institutional backbone.",
  "CourseCollab powers how learning actually happens.",
  "Together they form one connected environment.",
] as const

export function CanvasSlide() {
  const [active, setActive] = useState(0)
  const [line, setLine] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % ROWS.length)
    }, 3200)
    return () => window.clearInterval(id)
  }, [paused])

  useEffect(() => {
    const id = window.setInterval(() => {
      setLine((i) => (i + 1) % FUSION_LINES.length)
    }, 4200)
    return () => window.clearInterval(id)
  }, [])

  const [canvas, coursecollab] = ROWS[active]

  return (
    <SlideShell>
      <Eyebrow>The relationship</Eyebrow>
      <SlideTitle>How is CourseCollab different from Canvas?</SlideTitle>
      <Subhead>They solve different parts of the digital learning problem.</Subhead>

      <div
        className="mt-4 grid content-start gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-x-auto overscroll-x-contain rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="min-w-[300px]">
            <div className="grid grid-cols-2 border-b border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] sm:px-3.5 sm:text-[13px]">
              <span className="text-white/45">Canvas</span>
              <span className="text-[#EAAA00]">CourseCollab</span>
            </div>
            {ROWS.map(([left, right], i) => (
              <button
                key={left}
                type="button"
                onMouseEnter={() => {
                  setPaused(true)
                  setActive(i)
                }}
                onMouseLeave={() => setPaused(false)}
                onFocus={() => {
                  setPaused(true)
                  setActive(i)
                }}
                onBlur={() => setPaused(false)}
                onClick={() => setActive(i)}
                className={cn(
                  "pitch-rise grid w-full grid-cols-2 gap-2 border-b border-white/6 px-3 py-1.5 text-left transition-colors last:border-b-0 sm:gap-2.5 sm:px-3.5 sm:py-2",
                  active === i ? "bg-[#EAAA00]/10" : "hover:bg-white/[0.03]",
                )}
                style={{ animationDelay: `${40 + i * 35}ms` }}
              >
                <p
                  className={cn(
                    "text-[15px] leading-snug sm:text-[16px] lg:text-[17px]",
                    active === i ? "text-white/65" : "text-white/45",
                  )}
                >
                  {left}
                </p>
                <p
                  className={cn(
                    "text-[15px] leading-snug sm:text-[16px] lg:text-[17px]",
                    active === i ? "font-medium text-white" : "text-white/80",
                  )}
                >
                  {right}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-center gap-3 sm:gap-4">
          <div className="pitch-rise text-center" style={{ animationDelay: "80ms" }}>
            <p className="inline-flex flex-wrap items-baseline justify-center gap-x-1.5 text-[16px] font-semibold sm:text-[18px] lg:text-[19px]">
              <span className="text-white/55">The distinction is not</span>
              <span className="font-bold text-white/35 line-through decoration-white/30">
                CourseCollab or Canvas
              </span>
            </p>
          </div>

          <div
            className="pitch-rise relative flex items-center justify-center gap-2 py-1 sm:gap-3"
            style={{ animationDelay: "120ms" }}
          >
            <div className="absolute inset-x-[12%] top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <div className="pitch-fusion-pill relative z-10 rounded-full border border-white/18 bg-[#1a1524] px-3.5 py-2 text-[15px] font-semibold text-white/80 shadow-lg sm:px-4 sm:py-2.5 sm:text-[16px]">
              Canvas
            </div>
            <div className="pitch-fusion-plus relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EAAA00] text-[#1e1033] shadow-[0_0_24px_rgba(234,170,0,0.45)] sm:h-9 sm:w-9">
              <Plus className="h-4 w-4 stroke-[2.5]" />
            </div>
            <div className="pitch-fusion-pill relative z-10 rounded-full border border-[#EAAA00]/35 bg-[#EAAA00]/12 px-3.5 py-2 text-[15px] font-semibold text-[#F6D56A] shadow-lg sm:px-4 sm:py-2.5 sm:text-[16px]">
              CourseCollab
            </div>
          </div>

          <p
            className="pitch-rise text-center font-sans text-xl font-extrabold tracking-tight text-[#F6D56A] sm:text-2xl lg:text-[1.65rem]"
            style={{ animationDelay: "160ms" }}
          >
            Canvas + CourseCollab
          </p>

          <div
            className="pitch-rise pitch-card-shine relative overflow-hidden rounded-2xl border border-[#EAAA00]/25 bg-[#EAAA00]/6 p-3.5 sm:p-4"
            style={{ animationDelay: "200ms" }}
          >
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-[#EAAA00]" />
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#EAAA00]">
                Active pairing
              </p>
            </div>
            <div className="min-h-[4.75rem]">
              <p
                key={`canvas-${active}`}
                className="pitch-fusion-swap text-[15px] leading-snug text-white/55 sm:text-[16px] lg:text-[17px]"
              >
                <span className="font-semibold text-white/75">Canvas</span> · {canvas}
              </p>
              <p
                key={`cc-${active}`}
                className="pitch-fusion-swap mt-1.5 text-[15px] leading-snug text-white/85 sm:text-[16px] lg:text-[17px]"
              >
                <span className="font-semibold text-[#F6D56A]">CourseCollab</span> · {coursecollab}
              </p>
            </div>
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {ROWS.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 rounded-full transition-all duration-300",
                    i === active ? "w-5 bg-[#EAAA00]" : "w-1 bg-white/20",
                  )}
                />
              ))}
            </div>
          </div>

          <div
            className="pitch-rise flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:p-3.5"
            style={{ animationDelay: "240ms" }}
          >
            <Layers className="mt-0.5 h-4 w-4 shrink-0 text-[#EAAA00]" />
            <p
              key={line}
              className="pitch-fusion-swap text-[15px] leading-relaxed text-white/70 sm:text-[16px] lg:text-[17px]"
            >
              {FUSION_LINES[line]}
            </p>
          </div>
        </div>
      </div>

      <Thesis>
        Canvas provides institutional LMS infrastructure. CourseCollab adds the intelligent
        learning layer — together, a connected digital learning environment.
      </Thesis>
    </SlideShell>
  )
}
