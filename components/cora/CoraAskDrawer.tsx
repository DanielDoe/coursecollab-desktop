"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { MessageSquare, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CodebenchAskCoraPanel } from "@/components/codebench/CodebenchAskCoraPanel"
import { CORA_NAME } from "@/lib/cora/constants"
import type { CoraProblemContext } from "@/lib/cora/types"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onClose: () => void
  problem: CoraProblemContext | null
  studentId: string | null
  title?: string
  subtitle?: string
  theme?: "light" | "dark"
  /**
   * `panel` — third column beside quiz content (nothing covered).
   * `overlay` — fixed slide-over (e.g. lecture workspace).
   */
  variant?: "panel" | "overlay"
  topOffsetPx?: number
  className?: string
}

function useOverlayTopPx(open: boolean, topOffsetPx?: number) {
  const [topPx, setTopPx] = useState(topOffsetPx ?? 0)

  useEffect(() => {
    if (!open) return
    if (topOffsetPx !== undefined) {
      setTopPx(topOffsetPx)
      return
    }
    const measure = () => {
      const chrome = document.querySelector("[data-quiz-chrome]")
      setTopPx(chrome ? Math.round(chrome.getBoundingClientRect().height) : 0)
    }
    measure()
    const chrome = document.querySelector("[data-quiz-chrome]")
    const ro = chrome ? new ResizeObserver(measure) : null
    ro?.observe(chrome as Element)
    window.addEventListener("resize", measure)
    return () => {
      ro?.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [open, topOffsetPx])

  return topPx
}

function CoraAskDrawerBody({
  title,
  subtitle,
  onClose,
  problem,
  studentId,
  theme,
  panelKey,
  importedLabel,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  problem: CoraProblemContext | null
  studentId: string | null
  theme: "light" | "dark"
  panelKey: string
  importedLabel: string | null
}) {
  return (
    <>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--cc-text)]">{title}</p>
            {subtitle ? (
              <p className="truncate text-xs text-[var(--cc-text-muted)]">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-full" onClick={onClose}>
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
        {problem ? (
          <CodebenchAskCoraPanel
            key={panelKey}
            code=""
            studentId={studentId}
            theme={theme}
            learningMode="intermediate"
            assessmentEmbed
            skipHandoffConsume
            retainImportedQuestion
            initialImportedQuestion={problem}
            initialImportedLabel={importedLabel}
            className="h-full min-h-0"
          />
        ) : null}
      </div>
    </>
  )
}

export function CoraAskDrawer({
  open,
  onClose,
  problem,
  studentId,
  title = `Ask ${CORA_NAME}`,
  subtitle,
  theme = "dark",
  variant = "panel",
  topOffsetPx,
  className,
}: Props) {
  const [mounted, setMounted] = useState(false)
  const topPx = useOverlayTopPx(open, topOffsetPx)
  const importedLabel = problem?.title ?? subtitle ?? null
  const panelKey = problem
    ? `${problem.source}-${problem.questionId ?? problem.quizId ?? "q"}-${problem.questionText.slice(0, 32)}`
    : "empty"

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const body = (
    <CoraAskDrawerBody
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      problem={problem}
      studentId={studentId}
      theme={theme}
      panelKey={panelKey}
      importedLabel={importedLabel}
    />
  )

  if (variant === "panel") {
    return (
      <motion.aside
        role="complementary"
        aria-label={title}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
        className={cn(
          "flex min-h-0 w-[min(100%,26rem)] shrink-0 flex-col self-stretch overflow-hidden border-l border-[var(--border)] bg-[var(--cc-background)] text-[var(--cc-text)]",
          "max-lg:w-[min(100%,22rem)] max-md:h-[min(44dvh,440px)] max-md:w-full max-md:border-l-0 max-md:border-t",
          className,
        )}
      >
        {body}
      </motion.aside>
    )
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      <motion.aside
        key="cora-ask-overlay"
        role="dialog"
        aria-modal="false"
        aria-label={title}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        className={cn(
          "fixed right-0 z-[10040] flex flex-col border-l border-[var(--border)] bg-[var(--cc-background)] text-[var(--cc-text)] shadow-2xl",
          "w-[min(100vw,28rem)] sm:w-[min(100vw,30rem)]",
          className,
        )}
        style={{
          top: topPx,
          height: `calc(100dvh - ${topPx}px)`,
        }}
      >
        {body}
      </motion.aside>
    </AnimatePresence>,
    document.body,
  )
}
