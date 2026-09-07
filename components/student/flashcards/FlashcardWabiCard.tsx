"use client"

import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { FlashcardDifficulty } from "@/lib/flashcards-types"
import { flashcardWabiThemeFromRaw, type FlashcardWabiFace } from "@/lib/flashcard-wabi-theme"
import { FlashcardDifficultyBadge } from "@/components/student/flashcards/flashcard-difficulty-badge"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { useFlashcardChrome } from "@/hooks/use-flashcard-chrome"

const FLASHCARD_MATH_CLASS =
  "text-center text-xl font-semibold leading-snug sm:text-[1.65rem] [&_.question-text-content]:text-inherit [&_.question-text-content]:text-center [&_.katex-display]:my-2 [&_.katex-display]:text-[1.05rem] [&_.katex-display]:overflow-x-auto"

const FLASHCARD_BODY_MATH_CLASS =
  "text-center text-base leading-relaxed [&_.question-text-content]:text-inherit [&_.question-text-content]:text-center [&_.katex-display]:my-1.5 [&_.katex-display]:text-[0.95rem]"

type Props = {
  frontText: string
  backText: string
  flipped: boolean
  onFlip: () => void
  difficulty?: FlashcardDifficulty | string | null
  badge?: ReactNode
  className?: string
  disabled?: boolean
}

/** Glossy pearl — soft specular only, no hard discs (those read as a pupil). */
function PearlOrb({ color }: { color: string }) {
  return (
    <div
      className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full sm:h-[88px] sm:w-[88px]"
      style={{
        background: [
          `radial-gradient(circle at 30% 26%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.35) 18%, transparent 42%)`,
          `radial-gradient(circle at 72% 74%, rgba(255,255,255,0.28) 0%, transparent 22%)`,
          `radial-gradient(circle at 50% 50%, ${color} 0%, ${color} 100%)`,
        ].join(", "),
        boxShadow: [
          "inset 0 0 0 1px rgba(255,255,255,0.35)",
          "inset 6px 8px 14px rgba(255,255,255,0.28)",
          "0 10px 20px -8px rgba(0,0,0,0.28)",
        ].join(", "),
      }}
    />
  )
}

function WabiFace({
  face,
  label,
  title,
  body,
  badge,
  isBack,
}: {
  face: FlashcardWabiFace
  label: string
  title: string
  body?: string
  badge?: ReactNode
  isBack?: boolean
}) {
  return (
    <div
      className="absolute inset-0 flex flex-col rounded-[28px] border-2 p-6 sm:p-8"
      style={{
        backgroundColor: face.background,
        borderColor: face.border,
        boxShadow: `0 22px 44px -18px ${face.shadow}`,
        backfaceVisibility: "hidden",
        transform: isBack ? "rotateY(180deg)" : undefined,
      }}
    >
      <div className="flex w-full items-center justify-between gap-2">
        {badge ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider opacity-80">
            {badge}
          </span>
        ) : (
          <span />
        )}
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70" style={{ color: face.title }}>
          {label}
        </span>
      </div>

      <div className="mt-5 mb-5 flex justify-center">
        <PearlOrb color={face.orb} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-1">
        <div style={{ color: face.title }}>
          <QuestionTextRenderer text={title} className={FLASHCARD_MATH_CLASS} />
        </div>
        {body ? (
          <div className="mt-3" style={{ color: face.body }}>
            <QuestionTextRenderer text={body} className={FLASHCARD_BODY_MATH_CLASS} />
          </div>
        ) : null}
      </div>

      <p className="mt-5 text-center text-xs font-medium" style={{ color: face.footer }}>
        {isBack ? "Tap to flip back" : "Tap to reveal the answer"}
      </p>
    </div>
  )
}

/** Mobile-inspired Wabi flashcard — Appearance family chrome for faces + stack. */
export function FlashcardWabiCard({
  frontText,
  backText,
  flipped,
  onFlip,
  difficulty,
  badge,
  className,
  disabled,
}: Props) {
  const chrome = useFlashcardChrome()
  const theme = flashcardWabiThemeFromRaw(difficulty, chrome.isDark, chrome)

  return (
    <div className={cn("relative mx-auto w-full max-w-[560px] px-8 pb-10 pt-2", className)}>
      <div
        className="pointer-events-none absolute inset-x-8 inset-y-2 -z-10 overflow-hidden rounded-[36px]"
        aria-hidden
      >
        <span
          className="absolute top-4 left-8 h-28 w-28 rounded-full blur-3xl"
          style={{ backgroundColor: `${chrome.study.gold}55` }}
        />
        <span
          className="absolute right-6 bottom-8 h-32 w-32 rounded-full blur-3xl"
          style={{ backgroundColor: `${chrome.study.magenta}40` }}
        />
        <span
          className="absolute top-1/2 left-1/3 h-24 w-24 rounded-full blur-3xl"
          style={{ backgroundColor: `${chrome.study.cyan}30` }}
        />
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-0 z-0">
          {theme.stack.map((layer, index) => (
            <div
              key={index}
              className="absolute inset-0 rounded-[28px]"
              style={{
                backgroundColor: layer.background,
                transform: `translate(${layer.offsetX}px, ${layer.offsetY}px) rotate(${layer.rotate}) scale(${layer.scale})`,
              }}
            />
          ))}
        </div>

        <motion.div
          className="relative z-10 min-h-[380px] w-full sm:min-h-[440px]"
          whileHover={disabled ? undefined : { scale: 1.015, rotate: flipped ? 0 : -0.4 }}
          whileTap={disabled ? undefined : { scale: 0.985 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={onFlip}
            className="absolute inset-0 z-20 rounded-[28px] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]/50"
            aria-label={flipped ? "Show question" : "Show answer"}
          >
            <motion.div
              className="relative h-full w-full"
              style={{ transformStyle: "preserve-3d" }}
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
            >
              <WabiFace
                face={theme.front}
                label="Question"
                title={frontText}
                badge={
                  difficulty ? (
                    <FlashcardDifficultyBadge difficulty={difficulty} compact />
                  ) : badge ? (
                    badge
                  ) : null
                }
              />
              <WabiFace
                face={theme.back}
                label="Answer"
                title={backText}
                isBack
                badge={badge}
              />
            </motion.div>
          </button>
        </motion.div>
      </div>
    </div>
  )
}
