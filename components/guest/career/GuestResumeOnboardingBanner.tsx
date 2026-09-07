"use client"

import Link from "next/link"
import { FileUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EMBED_INNER_PANEL } from "@/components/student/dashboard-v2/embed-module-ui"
import { cn } from "@/lib/utils"

export function GuestResumeOnboardingBanner({ className }: { className?: string }) {
  return (
    <div className={cn(EMBED_INNER_PANEL, "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
          <FileUp className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--cc-text)]">Add your master résumé</p>
          <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">
            Cora uses it for quick scans, cover letters, and chat — and re-reads the file every time, not just memory.
          </p>
        </div>
      </div>
      <Button className="shrink-0 rounded-xl" asChild>
        <Link href="/guest/settings?section=cora">Upload résumé</Link>
      </Button>
    </div>
  )
}
