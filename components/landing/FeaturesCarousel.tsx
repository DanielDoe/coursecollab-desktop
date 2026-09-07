"use client"

import * as React from "react"
import { AnimatePresence, motion } from "@/components/landing/framer"
import { useLandingMotionEnabled } from "@/components/landing/LandingMotionProvider"
import {
  Bot,
  Briefcase,
  ClipboardList,
  Lightbulb,
  Code2,
  BarChart3,
  ChevronDown,
  CircuitBoard,
  Presentation,
  Sparkles,
  Mic,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { DeviceDuo, type DeviceShot } from "@/components/landing/device-frames"
import {
  landingSectionClass,
  landingSectionInnerClass,
  landingSectionHeaderClass,
  landingEyebrowClass,
  landingSectionTitleClass,
  landingSectionDescClass,
} from "@/components/landing/landing-section-layout"
import {
  fadeUp,
  LANDING_VIEWPORT,
  sectionHeader,
} from "@/components/landing/landing-motion"

type FeatureMedia = {
  /** Web capture shown in a laptop frame (paired with the phone). */
  web: DeviceShot
  /** Simulator capture — bezel included in the image. */
  phone: DeviceShot
}

type FeatureCard = {
  id: string
  title: string
  desc: string
  badge: string
  icon: React.ComponentType<{ className?: string }>
  media: FeatureMedia
}

const phoneShot = (file: string, alt: string, height = 1314): DeviceShot => ({
  src: `/images/landing/cora/${file}`,
  alt,
  width: 640,
  height,
})

const webShot = (file: string, alt: string): DeviceShot => ({
  src: `/images/landing/web/${file}`,
  alt,
  width: 1600,
  height: 1000,
})

const FEATURE_CARDS: FeatureCard[] = [
  {
    id: "cora-tutor",
    title: "Cora AI Tutor",
    desc: "Instant explanations, code reviews, and personalized hints — an agentic AI that acts on your courses, 24/7.",
    badge: "Agentic",
    icon: Bot,
    media: {
      web: webShot(
        "web-cora-assistant.png",
        "Cora Assistant on the web building a flashcard deck with a preview-first confirmation card",
      ),
      phone: phoneShot(
        "assistant-agentic.png",
        "Cora Assistant on mobile executing a multi-step analysis task from one prompt",
      ),
    },
  },
  {
    id: "cora-copilot",
    title: "Cora Copilot",
    desc: "Faculty's agentic sidekick — draft announcements, build question banks, and publish course content with approval-first actions.",
    badge: "For faculty",
    icon: Presentation,
    media: {
      web: {
        src: "/images/landing/web/web-cora-copilot.png",
        alt: "Cora Copilot on the web drafting a course announcement for faculty review",
        width: 1200,
        height: 750,
      },
      phone: phoneShot(
        "copilot-home.png",
        "Cora Copilot mobile home with faculty quick actions for announcements and question banks",
      ),
    },
  },
  {
    id: "career-ai",
    title: "Career AI",
    desc: "Résumé match reports, quick scans, AI cover letters, and résumé optimization — Cora Career for members on the job hunt.",
    badge: "For career members",
    icon: Briefcase,
    media: {
      web: webShot(
        "web-career-match.png",
        "Cora Career résumé match report with a score, skill bars, and evidence-backed keyword matches",
      ),
      phone: phoneShot(
        "career-resume-match.png",
        "Résumé Match on mobile — master résumé, opportunity description, and recent scan scores",
        1349,
      ),
    },
  },
  {
    id: "quizzes",
    title: "Quizzes",
    desc: "Timed assessments with instant grading, section breakdowns, and question-by-question feedback.",
    badge: "Auto-grade",
    icon: ClipboardList,
    media: {
      web: webShot(
        "web-quizzes.png",
        "Quiz performance summary on the web with a 100% score ring and per-section breakdown",
      ),
      phone: phoneShot(
        "quiz-review.png",
        "ECE 2202 quiz question review with instant right and wrong feedback",
        1274,
      ),
    },
  },
  {
    id: "practice-hub",
    title: "Practice Hub",
    desc: "Generate practice from the question bank, join live playground sessions, and climb the leaderboard.",
    badge: "Master any topic",
    icon: Lightbulb,
    media: {
      web: webShot(
        "web-practice-hub.png",
        "Practice Hub on the web with topic progress, accuracy stats, badges, and recent sessions",
      ),
      phone: phoneShot(
        "playground-live.png",
        "Live playground practice session with leaderboard and credits",
        1274,
      ),
    },
  },
  {
    id: "circuits-ai",
    title: "Circuit Labs",
    desc: "Submit worked circuit solutions and get graded, step-by-step AI feedback on your method and results.",
    badge: "ECE 2202",
    icon: CircuitBoard,
    media: {
      web: webShot(
        "web-circuit-labs.png",
        "Graded circuit submission on the web with the textbook figure and detailed AI feedback",
      ),
      phone: phoneShot(
        "cora-circuit-help.png",
        "Cora explaining a circuit problem with the actual textbook figure in chat",
        1274,
      ),
    },
  },
  {
    id: "codebench",
    title: "CodeBench IDE",
    desc: "Write C++, C, and Python — with Cora walkthrough, debug, and explain built in. Local Run is available for C++ on desktop.",
    badge: "C++ · C · Python",
    icon: Code2,
    media: {
      web: webShot(
        "web-codebench-python.png",
        "CodeBench on the web running Python with Cora's line-by-line execution walkthrough",
      ),
      phone: phoneShot(
        "codebench-editor.png",
        "CodeBench editor on mobile with syntax-highlighted code",
      ),
    },
  },
  {
    id: "analytics",
    title: "Analytics",
    desc: "AI progress reviews with per-category scores, strengths, and focus areas — spot weak spots early.",
    badge: "Insights",
    icon: BarChart3,
    media: {
      web: webShot(
        "web-progress-review.png",
        "Mid-term progress review on the web with AI narrative, category scores, and focus areas",
      ),
      phone: phoneShot(
        "progress-review.png",
        "Student mid-term progress review with per-category scores",
        1274,
      ),
    },
  },
  {
    id: "ai-notetaker",
    title: "AI Notetaker",
    desc: "Faculty publish lectures; AI Notetaker and Cora help students review Thevenin, Norton, and max power transfer.",
    badge: "Lecture capture",
    icon: Mic,
    media: {
      web: {
        src: "/images/landing/web/web-ai-notetaker.png",
        alt: "AI Notetaker study guide for Lecture 9 — Thevenin and Norton equivalents with summary, key concepts, definitions, and Cora chat",
        width: 1024,
        height: 552,
      },
      phone: phoneShot(
        "notetaker-home.png",
        "AI Notetaker mobile home with live recording, audio upload, and recent lecture notes",
      ),
    },
  },
]

const AUTO_ADVANCE_MS = 6000

function FeatureMediaStage({ media }: { media: FeatureMedia }) {
  return (
    <DeviceDuo web={media.web} phone={media.phone} />
  )
}

/**
 * The three Cora products carry the section; the other six are supporting
 * tools. That split is what drives the mosaic — flagship tiles get room for a
 * hook line beside the hero, the rest compress into a strip underneath, so the
 * eye gets a path through nine features instead of nine identical rows.
 */
const FLAGSHIP_IDS = new Set(["cora-tutor", "cora-copilot", "career-ai"])

const INDEXED_CARDS = FEATURE_CARDS.map((card, index) => ({ card, index }))
const FLAGSHIP_TILES = INDEXED_CARDS.filter(({ card }) => FLAGSHIP_IDS.has(card.id))
const SUPPORTING_TILES = INDEXED_CARDS.filter(({ card }) => !FLAGSHIP_IDS.has(card.id))

/**
 * Selector tile. `large` is the flagship treatment (hook line, roomier chip);
 * the compact variant drops to icon + title + badge so six fit across.
 *
 * Colour stays on the two brand tokens rather than inventing a hue per
 * feature: purple marks the Cora products, gold the supporting tools. On gold
 * the icon goes near-black — white on #ffb81c is unreadable.
 */
function FeatureTile({
  card,
  isActive,
  autoPlaying,
  onSelect,
  large = false,
}: {
  card: FeatureCard
  isActive: boolean
  autoPlaying: boolean
  onSelect: () => void
  large?: boolean
}) {
  const Icon = card.icon
  const isFlagship = FLAGSHIP_IDS.has(card.id)

  const chipClass = isFlagship
    ? isActive
      ? "bg-[var(--cc-accent)] text-white"
      : "bg-[var(--cc-accent-soft)] text-[var(--cc-accent)]"
    : isActive
      ? "bg-[var(--cc-brand-gold)] text-[#1e1033]"
      : "bg-[color-mix(in_srgb,var(--cc-brand-gold)_22%,transparent)] text-[color-mix(in_srgb,var(--cc-brand-gold)_45%,#3d2363)]"

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isActive}
      className={cn(
        "group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border text-left",
        "transition-[transform,border-color,background-color,box-shadow] duration-200",
        large ? "justify-center gap-2 p-4" : "gap-2 p-3",
        isActive
          ? "border-[color-mix(in_srgb,var(--cc-accent)_45%,transparent)] bg-[var(--cc-surface)] shadow-[0_18px_44px_-26px_color-mix(in_srgb,var(--cc-accent)_55%,transparent)]"
          : "border-[var(--border)] bg-[color-mix(in_srgb,var(--cc-surface)_72%,transparent)] hover:-translate-y-0.5 hover:border-[var(--cc-accent-border)] hover:bg-[var(--cc-surface)] hover:shadow-[0_14px_32px_-24px_color-mix(in_srgb,var(--cc-accent)_45%,transparent)]",
      )}
    >
      <div className={cn("flex items-center gap-2.5", large ? "" : "flex-col items-start gap-2")}>
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl transition-colors",
            large ? "size-10" : "size-8",
            chipClass,
          )}
        >
          <Icon className={large ? "h-[18px] w-[18px]" : "h-4 w-4"} />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate font-bold",
              large ? "text-[15px]" : "text-[13px]",
              isActive ? "text-[var(--cc-text)]" : "text-[var(--cc-text)]",
            )}
          >
            {card.title}
          </span>
          <span
            className={cn(
              "block truncate font-semibold text-[var(--cc-text-secondary)]",
              large ? "text-[11px]" : "text-[10px]",
            )}
          >
            {card.badge}
          </span>
        </span>
      </div>

      {large ? (
        <span className="line-clamp-2 text-[12px] leading-snug text-[var(--cc-text-secondary)]">
          {card.desc}
        </span>
      ) : null}

      {isActive && autoPlaying && (
        <span className="absolute inset-x-0 bottom-0 h-[3px] bg-[color-mix(in_srgb,var(--cc-accent)_18%,transparent)]">
          <span
            key={card.id}
            className="block h-full origin-left bg-[var(--cc-accent)]"
            style={{ animation: `cc-feature-progress ${AUTO_ADVANCE_MS}ms linear forwards` }}
          />
        </span>
      )}
    </button>
  )
}

/** Section kept as `FeaturesCarousel` for page compatibility — interactive feature spotlight. */
export function FeaturesCarousel({ className }: { className?: string }) {
  const effectsEnabled = useLandingMotionEnabled()
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [isPaused, setIsPaused] = React.useState(false)
  const [hasInteracted, setHasInteracted] = React.useState(false)

  const autoPlaying = effectsEnabled && !isPaused && !hasInteracted

  React.useEffect(() => {
    if (!autoPlaying) return
    const timer = setInterval(() => {
      setActiveIndex((i) => (i + 1) % FEATURE_CARDS.length)
    }, AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [autoPlaying])

  const selectCard = (index: number) => {
    setActiveIndex(index)
    setHasInteracted(true)
  }

  const activeCard = FEATURE_CARDS[activeIndex]
  const ActiveIcon = activeCard.icon

  return (
    <section id="features" className={cn(landingSectionClass, className)}>
      <style>{`@keyframes cc-feature-progress { from { transform: scaleX(0) } to { transform: scaleX(1) } }`}</style>
      <div className={cn(landingSectionInnerClass)}>
        <motion.div
          className={landingSectionHeaderClass}
          variants={sectionHeader}
          initial={effectsEnabled ? "hidden" : false}
          whileInView={effectsEnabled ? "show" : undefined}
          viewport={LANDING_VIEWPORT}
        >
          <div className={`${landingEyebrowClass} hidden sm:mb-4 sm:inline-flex`}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            POWERFUL FEATURES
          </div>
          <h2 className={landingSectionTitleClass}>
            <span className="sm:hidden">All-in-one intelligent platform</span>
            <span className="hidden sm:inline">
              Everything you need,
              <br />
              all in one <span className="text-[var(--cc-accent)]">intelligent platform</span>
            </span>
          </h2>
          <p className={landingSectionDescClass}>
            <span className="sm:hidden">Cora AI, practice tools, and more.</span>
            <span className="hidden sm:inline">
              Pick a feature and see it in action — on mobile and on the web.
            </span>
          </p>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial={effectsEnabled ? "hidden" : false}
          whileInView={effectsEnabled ? "show" : undefined}
          viewport={LANDING_VIEWPORT}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Mobile selector — horizontal chips */}
          <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FEATURE_CARDS.map((card, index) => {
              const Icon = card.icon
              const isActive = index === activeIndex
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => selectCard(index)}
                  className={cn(
                    "inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors",
                    isActive
                      ? "border-transparent bg-[var(--cc-accent)] text-white"
                      : "border-[var(--border)] bg-[var(--cc-surface)] text-[var(--cc-text-secondary)]",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {card.title}
                </button>
              )
            })}
          </div>

          {/* Bento mosaic. Three tile weights — hero, flagship, supporting —
              so nine features read as a composition rather than a list. Below
              lg the tiles are dropped entirely and the chip row above drives
              the hero, which keeps the mobile page from growing by ~9 rows. */}
          <div className="grid gap-3 lg:grid-cols-12">
            {/* Hero: the active feature, at size */}
            <div className="relative flex min-h-[348px] flex-col overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[color-mix(in_srgb,var(--cc-accent-soft)_60%,var(--cc-surface))] p-4 shadow-[0_24px_60px_-32px_color-mix(in_srgb,var(--cc-accent)_45%,transparent)] sm:min-h-[460px] sm:rounded-[1.5rem] sm:p-6 lg:col-span-7 lg:min-h-[496px]">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-[color-mix(in_srgb,var(--cc-accent)_16%,transparent)] blur-3xl"
              />
              <div className="relative mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--cc-accent)] text-white">
                    <ActiveIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--cc-text)] sm:text-base">
                      {activeCard.title}
                    </h3>
                    <p className="text-[11px] font-semibold text-[var(--cc-accent)]">
                      {activeCard.badge}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {/* Position in the set — turns an unlabelled auto-advance into
                      something the visitor can orient against. */}
                  <span className="hidden font-mono text-[11px] font-bold tabular-nums text-[var(--cc-text-secondary)] sm:inline">
                    {String(activeIndex + 1).padStart(2, "0")}
                    <span className="opacity-40"> / {String(FEATURE_CARDS.length).padStart(2, "0")}</span>
                  </span>
                  <span className="hidden items-center gap-1 rounded-full bg-[var(--cc-surface)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--cc-text-secondary)] sm:inline-flex">
                    In the app
                  </span>
                </div>
              </div>
              <p className="relative mb-5 max-w-[46ch] text-[13px] leading-relaxed text-[var(--cc-text-secondary)] sm:mb-6 sm:text-[15px] sm:leading-[1.65] lg:text-[17px] lg:leading-[1.6]">
                {activeCard.desc}
              </p>
              {/* Phones: bleed past the card padding so a 16:10 laptop — short and wide —
                  fills the width instead of leaving the card mostly empty. */}
              <div className="relative -mx-3 flex flex-1 items-center sm:-mx-2">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeCard.id}
                    className="flex w-full items-end justify-center"
                    initial={effectsEnabled ? { opacity: 0, y: 20 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={effectsEnabled ? { opacity: 0, y: -12 } : undefined}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                  >
                    <FeatureMediaStage media={activeCard.media} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Flagship column — the three Cora products, beside the hero */}
            <div className="hidden lg:col-span-5 lg:grid lg:grid-rows-3 lg:gap-3">
              {FLAGSHIP_TILES.map(({ card, index }) => (
                <FeatureTile
                  key={card.id}
                  card={card}
                  large
                  isActive={index === activeIndex}
                  autoPlaying={autoPlaying}
                  onSelect={() => selectCard(index)}
                />
              ))}
            </div>

            {/* Supporting strip — six compact tiles across the full width */}
            <div className="hidden lg:col-span-12 lg:grid lg:grid-cols-6 lg:gap-3">
              {SUPPORTING_TILES.map(({ card, index }) => (
                <FeatureTile
                  key={card.id}
                  card={card}
                  isActive={index === activeIndex}
                  autoPlaying={autoPlaying}
                  onSelect={() => selectCard(index)}
                />
              ))}
            </div>
          </div>
        </motion.div>

        <div className="mt-6 hidden text-center sm:mt-10 md:block">
          <a
            href="#how-it-works"
            className="inline-flex animate-bounce flex-col items-center gap-1 text-sm font-semibold text-[var(--cc-accent)] transition-opacity hover:opacity-80 hover:underline"
          >
            See how it works
            <ChevronDown className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  )
}
