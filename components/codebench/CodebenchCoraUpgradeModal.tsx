"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { STUDENT_CORA_MONTHLY } from "@/lib/cora/credits/economy"

type Props = {
  open: boolean
  onClose: () => void
  actionLabel?: string
}

export function CodebenchCoraUpgradeModal({
  open,
  onClose,
  actionLabel = "this Cora action",
}: Props) {
  const explorerCredits = STUDENT_CORA_MONTHLY.Explorer.toLocaleString()
  const trailblazerCredits = STUDENT_CORA_MONTHLY.Trailblazer.toLocaleString()

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--cc-accent)_8%,var(--card))] px-5 py-4">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--cc-accent)] text-white shadow-sm">
                <Sparkles className="size-4" />
              </span>
              <div>
                <DialogTitle className="text-base">Cora for CodeBench</DialogTitle>
                <DialogDescription className="text-xs">
                  Understand errors, debug your code, and get personalized programming help with Cora.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>
        <div className="space-y-3 px-5 py-4">
          <p className="text-sm leading-relaxed text-[var(--cc-text-muted)]">
            {actionLabel} is available with Explorer and Trailblazer. Your code and terminal stay right here.
          </p>
          <ul className="space-y-1.5 text-sm text-[var(--cc-text)]">
            <li>Explorer — {explorerCredits} Cora Credits / month</li>
            <li>Trailblazer — {trailblazerCredits} Cora Credits / month</li>
          </ul>
        </div>
        <DialogFooter className="gap-2 border-t border-[var(--border)] bg-[var(--muted)]/20 px-5 py-3 sm:justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Keep coding
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href="/student/dashboard-v2/membership" onClick={onClose}>
              Compare plans
            </Link>
          </Button>
          <Button type="button" size="sm" asChild>
            <Link href="/student/dashboard-v2/membership?plan=Explorer" onClick={onClose}>
              Upgrade to Explorer
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
