"use client"

import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight, LayoutDashboard, PanelLeft, BookOpen, ClipboardList, Zap, Sparkles, User } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  dismissWelcomeBannerPermanently,
  getStudentDatabaseIdFromClient,
} from "@/lib/student-dashboard-banner-prefs"
import { useDashboardV2 } from "./DashboardV2Context"
import { useIsLg } from "@/hooks/use-breakpoint"

type TourPrepare = "welcome" | "sidebar" | "sidebar-section" | "main" | "profile"

const TOUR_STEPS: Array<{
  title: string
  description: string
  icon: typeof Sparkles
  target: string | null
  prepare: TourPrepare
}> = [
  {
    title: "Welcome to CourseCollab",
    description:
      "Your new command center is here. This quick tour will spotlight the key features. Use the arrows to explore, or skip anytime.",
    icon: Sparkles,
    target: null,
    prepare: "welcome",
  },
  {
    title: "Smart Sidebar Navigation",
    description:
      "The sidebar has grouped sections for Learning, Assessments, Collaboration, and more. On mobile, this opens as a drawer from the menu button.",
    icon: PanelLeft,
    target: "[data-tour=\"sidebar\"]",
    prepare: "sidebar",
  },
  {
    title: "Learning Center",
    description:
      "Lectures, Practice Hub, Cora, CodeBench IDE, and Analytics live here. Expand this section to jump into any of these.",
    icon: BookOpen,
    target: "[data-tour=\"nav-learning-center\"]",
    prepare: "sidebar-section",
  },
  {
    title: "Assessments Hub",
    description:
      "Quizzes, History, Homework, Mid-Semester Exams, Final Exams, and Grades — everything for your coursework.",
    icon: ClipboardList,
    target: "[data-tour=\"nav-assessments\"]",
    prepare: "sidebar-section",
  },
  {
    title: "More Power at Your Fingertips",
    description:
      "Collaboration, Performance & Rewards, Course Info, and Support. Scroll the sidebar to explore every group.",
    icon: Zap,
    target: "[data-tour=\"nav-collaboration\"]",
    prepare: "sidebar-section",
  },
  {
    title: "Performance Command Center",
    description:
      "Your grade overview, KPI cards, charts, and insights. Track grades, attendance, and academic progress at a glance.",
    icon: LayoutDashboard,
    target: "[data-tour=\"pcc\"]",
    prepare: "main",
  },
  {
    title: "Your Profile & Settings",
    description: "Open your profile (top right) for membership, settings, theme, and sign out.",
    icon: User,
    target: "[data-tour=\"profile\"]",
    prepare: "profile",
  },
]

function spotlightRectsEqual(a: DOMRect | null, b: DOMRect | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

function useSpotlightRect(selector: string | null, open: boolean, refreshToken: number) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  const update = useCallback(() => {
    if (!selector || typeof document === "undefined") {
      setRect((prev) => (prev === null ? prev : null))
      return
    }
    const el = document.querySelector(selector)
    if (!el) {
      setRect((prev) => (prev === null ? prev : null))
      return
    }
    const r = el.getBoundingClientRect()
    const padding = 12
    const next = new DOMRect(
      r.left - padding,
      r.top - padding,
      r.width + padding * 2,
      r.height + padding * 2,
    )
    setRect((prev) => (spotlightRectsEqual(prev, next) ? prev : next))
  }, [selector])

  useEffect(() => {
    if (!open || !selector) return
    update()
    const el = document.querySelector(selector)
    const ro = new ResizeObserver(update)
    if (el) ro.observe(el)
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      ro.disconnect()
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [selector, open, update, refreshToken])

  return rect
}

function SpotlightOverlay({ targetRect, onClose }: { targetRect: DOMRect | null; onClose: () => void }) {
  if (typeof document === "undefined") return null

  const hole = targetRect
    ? {
        left: Math.max(0, targetRect.left),
        top: Math.max(0, targetRect.top),
        width: Math.min(targetRect.width, window.innerWidth - targetRect.left),
        height: Math.min(targetRect.height, window.innerHeight - targetRect.top),
      }
    : null

  const overlay = (
    <div className="fixed inset-0 z-[100] pointer-events-auto" onClick={onClose} aria-hidden>
      {hole ? (
        <>
          <div className="absolute left-0 top-0 right-0 bg-black/60" style={{ height: hole.top }} />
          <div
            className="absolute left-0 bg-black/60"
            style={{ top: hole.top, width: hole.left, height: hole.height }}
          />
          <div
            className="absolute right-0 bg-black/60"
            style={{
              top: hole.top,
              left: hole.left + hole.width,
              width: Math.max(0, window.innerWidth - hole.left - hole.width),
              height: hole.height,
            }}
          />
          <div
            className="absolute left-0 right-0 bottom-0 bg-black/60"
            style={{ top: hole.top + hole.height }}
          />
          <div
            className="absolute rounded-2xl pointer-events-none ring-2 ring-[var(--cc-accent)]/60"
            style={{
              left: hole.left - 4,
              top: hole.top - 4,
              width: hole.width + 8,
              height: hole.height + 8,
              boxShadow: "0 0 0 2px color-mix(in srgb, var(--cc-accent) 30%, transparent), 0 0 24px color-mix(in srgb, var(--cc-accent) 20%, transparent)",
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/50" />
      )}
    </div>
  )

  return createPortal(overlay, document.body)
}

function computeCardPlacement(targetRect: DOMRect | null, isDrawerLayout: boolean) {
  if (!targetRect) {
    return { className: "top-1/2 -translate-y-1/2", style: undefined as CSSProperties | undefined }
  }

  if (isDrawerLayout) {
    return {
      className: "bottom-[max(1rem,env(safe-area-inset-bottom))]",
      style: undefined,
    }
  }

  const cardEstimate = 340
  const gap = 16
  const belowTop = targetRect.bottom + gap
  if (belowTop + cardEstimate < window.innerHeight - 24) {
    return {
      className: "left-1/2 -translate-x-1/2",
      style: { top: belowTop },
    }
  }

  const aboveTop = targetRect.top - gap - cardEstimate
  if (aboveTop > 24) {
    return {
      className: "left-1/2 -translate-x-1/2",
      style: { top: aboveTop },
    }
  }

  return {
    className: "bottom-8",
    style: undefined,
  }
}

export function DashboardTour({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { setWelcomeCardDismissed, setMobileSidebarOpen, setSidebarCollapsed } = useDashboardV2()
  const isLg = useIsLg()
  const isDrawerLayout = !isLg
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState(0)
  const [refreshToken, setRefreshToken] = useState(0)
  const prepareTimerRef = useRef<number | null>(null)
  const current = TOUR_STEPS[step]
  const Icon = current.icon
  const isFirst = step === 0
  const isLast = step === TOUR_STEPS.length - 1
  const targetRect = useSpotlightRect(current.target, open && mounted, refreshToken)
  const cardPlacement = computeCardPlacement(targetRect, isDrawerLayout)

  useEffect(() => {
    setMounted(true)
  }, [])

  const bumpSpotlight = useCallback(() => {
    window.setTimeout(() => setRefreshToken((t) => t + 1), 360)
  }, [])

  const applyStepPrepare = useCallback(
    (prepare: TourPrepare, target: string | null) => {
      if (prepareTimerRef.current != null) {
        window.clearTimeout(prepareTimerRef.current)
      }

      if (prepare === "welcome") {
        setMobileSidebarOpen(false)
        bumpSpotlight()
        return
      }

      if (prepare === "sidebar" || prepare === "sidebar-section") {
        setSidebarCollapsed(false)
        if (isDrawerLayout) {
          setMobileSidebarOpen(true)
        }
        prepareTimerRef.current = window.setTimeout(() => {
          const sidebarNav = document.querySelector("[data-tour=\"sidebar\"] nav")
          if (target) {
            const section = document.querySelector(target)
            section?.scrollIntoView({ block: "nearest", behavior: "smooth" })
          } else {
            sidebarNav?.scrollTo({ top: 0, behavior: "smooth" })
          }
          bumpSpotlight()
        }, isDrawerLayout ? 320 : 80)
        return
      }

      if (prepare === "main") {
        setMobileSidebarOpen(false)
        prepareTimerRef.current = window.setTimeout(() => {
          document.querySelector("[data-tour=\"pcc\"]")?.scrollIntoView({ block: "center", behavior: "smooth" })
          bumpSpotlight()
        }, isDrawerLayout ? 280 : 80)
        return
      }

      if (prepare === "profile") {
        setMobileSidebarOpen(false)
        bumpSpotlight()
      }
    },
    [bumpSpotlight, isDrawerLayout, setMobileSidebarOpen, setSidebarCollapsed],
  )

  useEffect(() => {
    if (!open || !mounted) return
    applyStepPrepare(current.prepare, current.target)
    return () => {
      if (prepareTimerRef.current != null) {
        window.clearTimeout(prepareTimerRef.current)
      }
    }
  }, [open, mounted, step, current.prepare, current.target, applyStepPrepare])

  useEffect(() => {
    if (open) return
    setMobileSidebarOpen(false)
    setStep(0)
  }, [open, setMobileSidebarOpen])

  const persistWelcomeDismissal = () => {
    const studentDbId = getStudentDatabaseIdFromClient()
    setWelcomeCardDismissed(true)
    void dismissWelcomeBannerPermanently(studentDbId)
  }

  const handleNext = () => {
    if (isLast) {
      persistWelcomeDismissal()
      onOpenChange(false)
    } else {
      setStep((s) => s + 1)
    }
  }

  const handleBack = () => {
    if (isFirst) return
    setStep((s) => s - 1)
  }

  const handleClose = () => {
    persistWelcomeDismissal()
    setStep(0)
    onOpenChange(false)
  }

  if (!open || !mounted) return null

  const card = (
    <div
      className={cn(
        "fixed z-[101] left-1/2 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2",
        cardPlacement.className,
      )}
      style={cardPlacement.style}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--cc-surface)]/95 shadow-2xl backdrop-blur-xl"
        >
          <div className="p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--cc-accent)_15%,transparent)] ring-2 ring-[color-mix(in_srgb,var(--cc-accent)_20%,transparent)]">
                <Icon className="h-7 w-7 text-[var(--cc-accent)]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-[var(--cc-text)]">{current.title}</h3>
                <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">
                  Step {step + 1} of {TOUR_STEPS.length}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-[var(--cc-text-secondary)]">
                  {current.description}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-center gap-2">
              {TOUR_STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--cc-accent)]/50 focus:ring-offset-2",
                    i === step
                      ? "w-8 bg-[var(--cc-accent)]"
                      : "w-2 bg-[var(--muted)] hover:bg-[var(--cc-text-muted)]",
                  )}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="rounded-xl text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]"
              >
                Skip tour
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  disabled={isFirst}
                  className="rounded-xl text-[var(--cc-text-secondary)]"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  className="rounded-xl bg-[var(--cc-accent-dark)] px-6 text-white shadow-lg hover:bg-[var(--cc-accent)]"
                >
                  {isLast ? "Finish" : "Next"}
                  {!isLast && <ChevronRight className="ml-1 h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )

  return (
    <>
      <SpotlightOverlay targetRect={targetRect} onClose={handleClose} />
      {createPortal(card, document.body)}
    </>
  )
}
