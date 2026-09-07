"use client"

import { Info } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CORA_MIN_PREMIUM_CREDITS } from "@/lib/cora/credits/economy"

/**
 * User-facing credit explainer. Per-action estimates appear only when backed by
 * telemetry — until then, describe the model without inventing production numbers.
 */
export function CoraCreditsInfoSheet({ triggerClassName }: { triggerClassName?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className={triggerClassName ?? "h-8 rounded-lg text-xs text-[var(--cc-accent-dark)]"}>
          <Info className="mr-1.5 size-3.5" />
          How Cora Credits work
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>How Cora Credits work</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2 text-sm text-[var(--cc-text-muted)]">
              <p>
                Cora Credits are CourseCollab&apos;s usage units for AI-powered actions. They are{" "}
                <span className="font-medium text-[var(--cc-text)]">not</span> the same as AI tokens.
                Different Cora actions may use different amounts depending on complexity, model
                rounds, and tools involved.
              </p>
              <p>
                <span className="font-medium text-[var(--cc-text)]">Lifetime access</span> unlocks
                Cora Career features permanently. Credits fund ongoing AI compute — when your balance
                reaches zero, features stay unlocked but AI actions that require credits are paused
                until you add more.
              </p>
              <p>
                Purchased credits <span className="font-medium text-[var(--cc-text)]">never expire</span>.
                Cached results (same résumé + same opportunity) are reused without charging again for
                the original analysis.
              </p>
              <p className="text-xs">
                Typical premium actions start at about {CORA_MIN_PREMIUM_CREDITS} credits minimum.
                Multi-step agent workflows (match + tailor + cover letter in one request) consume
                credits based on actual usage across the full run.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
