"use client"

import Link from "next/link"
import { Lock, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatGuestAccessPrice } from "@/lib/guest/membership-config"
import { cn } from "@/lib/utils"

export function CareerUnlockBanner({
  className,
  title = "Unlock full match report",
  description = "See missing keywords, résumé evidence, ATS fixes, and tailored improvements.",
}: {
  className?: string
  title?: string
  description?: string
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/30",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
            <Sparkles className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--cc-text)]">{title}</p>
            <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">{description}</p>
            <p className="mt-1 text-[11px] text-[var(--cc-text-muted)]">
              Lifetime access · {formatGuestAccessPrice("cora_career")}
            </p>
          </div>
        </div>
        <Button className="shrink-0 rounded-xl" asChild>
          <Link href="/guest/cora-career/access">Unlock Cora Career</Link>
        </Button>
      </div>
    </div>
  )
}

export function CareerUnlockRowButton({ className }: { className?: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("h-7 rounded-lg border-violet-200 px-2.5 text-[11px] text-violet-700", className)}
      asChild
    >
      <Link href="/guest/cora-career/access">
        <Lock className="mr-1 size-3" />
        Unlock
      </Link>
    </Button>
  )
}

export function CareerLockedLabel({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block min-w-[8rem] select-none rounded bg-[var(--muted)]/60 px-2 py-0.5 text-sm text-transparent blur-[6px]",
        className,
      )}
      aria-hidden
    >
      keyword hidden
    </span>
  )
}
