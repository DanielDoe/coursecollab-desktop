"use client"

import { X } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  senderName: string | null
  excerpt: string
  /** Quote sits inside an outgoing bubble that is already filled with the accent. */
  mine?: boolean
  /** The quoted message was sent by the person looking at the thread. */
  quotingSelf?: boolean
  onDismiss?: () => void
}

/** Quoted reply kept apart from the message being written. */
export function MessageQuoteCard({ senderName, excerpt, mine = false, quotingSelf = false, onDismiss }: Props) {
  const label = quotingSelf ? "You" : senderName?.trim() || "Quoted message"
  return (
    <div
      className={cn(
        "flex min-h-11 overflow-hidden rounded-xl border",
        mine
          ? "border-transparent bg-black/20"
          : "border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)]",
      )}
      role="group"
      aria-label={`Replying to ${label}. ${excerpt}`}
    >
      <div className={cn("w-[3px] shrink-0", mine ? "bg-white" : "bg-[var(--cc-accent)]")} />
      <div className="min-w-0 flex-1 px-2.5 py-1.5">
        <p className={cn("truncate text-[13px] font-bold leading-4", mine ? "text-white" : "text-[var(--cc-accent-dark)]")}>
          {label}
        </p>
        <p className={cn("line-clamp-2 text-[13px] leading-[17px]", mine ? "text-white/90" : "text-slate-600 dark:text-slate-300")}>
          {excerpt}
        </p>
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className={cn(
            "inline-flex shrink-0 items-center px-2",
            mine ? "text-white/85 hover:text-white" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-100",
          )}
          aria-label="Remove quoted reply"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  )
}
