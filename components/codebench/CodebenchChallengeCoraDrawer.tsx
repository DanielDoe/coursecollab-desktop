"use client"

import { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MessageSquare, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CodebenchAskCoraPanel } from "@/components/codebench/CodebenchAskCoraPanel"
import { useCoraContentPalette } from "@/hooks/use-cora-content-palette"
import {
  challengeToCoraProblem,
  type CodebenchChallengeHandoff,
} from "@/lib/codebench-challenge-handoff"

type Props = {
  open: boolean
  onClose: () => void
  challenge: CodebenchChallengeHandoff
  studentId: string | null
  /** challenge = import daily challenge; general = plain Ask Cora chat */
  mode?: "challenge" | "general"
}

export function CodebenchChallengeCoraDrawer({
  open,
  onClose,
  challenge,
  studentId,
  mode = "challenge",
}: Props) {
  const { soft, accent } = useCoraContentPalette()
  const problem = mode === "challenge" ? challengeToCoraProblem(challenge) : null
  const isChallenge = mode === "challenge"

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="codebench-cora-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[55] bg-black/20 backdrop-blur-sm"
          />
          <motion.div
            key="codebench-cora-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-16 z-[70] flex h-[calc(100vh-4rem)] w-full flex-col shadow-2xl md:w-[min(100%,28rem)] lg:w-[min(100%,32rem)]"
            style={{ background: "var(--cc-background)", color: "var(--cc-text)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <header
              className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-5"
              style={{ background: soft, boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.06)" }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "rgba(255,255,255,0.55)", color: accent }}
                >
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--cc-text-muted)]">
                    Ask Cora
                  </p>
                  <h2 className="truncate text-base font-semibold tracking-tight">
                    {isChallenge ? "Daily challenge" : "CodeBench"}
                  </h2>
                  <p className="truncate text-xs text-[var(--cc-text-muted)]">{challenge.title}</p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </header>

            <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4">
              <CodebenchAskCoraPanel
                code=""
                studentId={studentId}
                theme="light"
                learningMode="intermediate"
                initialImportedQuestion={problem}
                initialImportedLabel={
                  isChallenge ? `Daily challenge · ${challenge.title}` : null
                }
                skipHandoffConsume
                className="h-full min-h-0 rounded-2xl border border-[var(--border)]"
              />
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
