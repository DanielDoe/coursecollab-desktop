"use client"

import { ArrowRight, Copy, KeyRound } from "lucide-react"
import { cn } from "@/lib/utils"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

const playgroundChrome = facultyEmbedChrome("playground")

export function PlaygroundPasscodeBanner({
  sessionCode,
  label,
  passcode,
  gameStarted,
  onCopy,
  onOpen,
}: {
  sessionCode: string
  label: string
  passcode: string
  gameStarted?: boolean
  onCopy: () => void
  onOpen: () => void
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex flex-wrap items-center gap-3 p-3 sm:p-3.5">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm",
            playgroundChrome.p.softBg,
          )}
        >
          <KeyRound className={cn("h-5 w-5", playgroundChrome.p.iconText)} strokeWidth={2.2} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn("truncate text-sm font-semibold", PORTAL_TEXT)}>{label}</h3>
            {gameStarted ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Waiting
              </span>
            )}
          </div>
          <p className={cn("mt-0.5 font-mono text-xs", PORTAL_TEXT_MUTED)}>{sessionCode}</p>
          <p className={cn("mt-1 text-[11px]", PORTAL_TEXT_MUTED)}>
            {gameStarted
              ? "Share this passcode so late students can join."
              : "Students enter this passcode to join the waiting room."}
          </p>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="rounded-xl bg-muted/70 px-3 py-1.5 font-mono text-lg font-bold tracking-[0.28em] text-[var(--cc-text)] sm:text-xl">
            {passcode}
          </span>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border)] px-2.5 text-xs font-medium text-[var(--cc-text)] transition-colors hover:bg-[var(--cc-accent-soft)]/45"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </button>
          <button
            type="button"
            onClick={onOpen}
            className={cn(
              "inline-flex h-9 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold",
              playgroundChrome.p.softBg,
              playgroundChrome.p.iconText,
            )}
          >
            Open
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </article>
  )
}
