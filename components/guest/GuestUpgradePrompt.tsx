"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatGuestAccessPrice } from "@/lib/guest/membership-config"
import { portalCard } from "@/lib/appearance/portal-shell-theme"
import { cn } from "@/lib/utils"

type Props = {
  title: string
  description: string
  onDismiss?: () => void
  className?: string
}

export function GuestUpgradePrompt({ title, description, onDismiss, className }: Props) {
  return (
    <div className={cn(portalCard, "p-5 sm:p-6 space-y-4", className)}>
      <div className="flex gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
          <Sparkles className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <h3 className="font-semibold text-[var(--cc-text)]">{title}</h3>
          <p className="text-sm text-[var(--cc-text-muted)] leading-relaxed">{description}</p>
          <p className="text-xs text-[var(--cc-text-muted)]">
            Included with the {formatGuestAccessPrice("cora_career")}.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="rounded-xl" asChild>
          <Link href="/guest/cora-career/access">Unlock Cora Career</Link>
        </Button>
        {onDismiss ? (
          <Button type="button" variant="ghost" className="rounded-xl" onClick={onDismiss}>
            Not now
          </Button>
        ) : null}
      </div>
    </div>
  )
}
